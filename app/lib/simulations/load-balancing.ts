import { ArchitectureGraph } from "../architecture/graph";
import { QUEUE_CAPACITY, TRAFFIC_SPIKE_BURST, WORKER_CONCURRENCY, WORKER_JOB_DURATION_MS } from "./traffic-spike";

export const LOAD_BALANCE_BURST = TRAFFIC_SPIKE_BURST;
export const API_REPLICA_BURST_CAPACITY = 250;

export type ApiLoadAssignment = {
  apiId: string;
  assigned: number;
  accepted: number;
};

type ApiRoute = {
  apiId: string;
  queueIds: string[];
  workerIds: string[];
  returnsThroughLoadBalancer: boolean;
};

export type LoadBalancingTopology = {
  activeLoadBalancerId: string | null;
  clientRequestConnected: boolean;
  clientResponseConnected: boolean;
  apiReplicaCount: number;
  completeApiCount: number;
  queueIds: string[];
  workerIds: string[];
  directApiId: string | null;
  directApiCanProcess: boolean;
  directApiResponds: boolean;
  directBypassPresent: boolean;
};

export type LoadBalancingResult = {
  passed: boolean;
  processed: number;
  dropped: number;
  maxBacklog: number;
  averageLatencyMs: number;
  peakLatencyMs: number;
  drainDurationMs: number;
  acceptedResponses: number;
  rejectedResponses: number;
  clientResponses: number;
  unansweredRequests: number;
  workerCount: number;
  apiReplicaCount: number;
  completeApiCount: number;
  loadBalanced: boolean;
  apiAssignments: ApiLoadAssignment[];
  feedback: string;
};

function unique(values: readonly string[]) {
  return [...new Set(values)];
}

function workerIdsForQueue(graph: ArchitectureGraph, queueId: string) {
  return graph.outgoing(queueId)
    .map((edge) => graph.getNode(edge.target.nodeId))
    .filter((node) => node?.kind === "workers")
    .filter((worker) => worker && graph.outgoing(worker.id).some((edge) => graph.getNode(edge.target.nodeId)?.kind === "db"))
    .map((worker) => worker!.id);
}

function apiRoute(graph: ArchitectureGraph, apiId: string, loadBalancerId: string | null): ApiRoute {
  const queueIds = graph.outgoing(apiId)
    .map((edge) => graph.getNode(edge.target.nodeId))
    .filter((node) => node?.kind === "queue")
    .map((queue) => queue!.id);

  return {
    apiId,
    queueIds,
    workerIds: unique(queueIds.flatMap((queueId) => workerIdsForQueue(graph, queueId))),
    returnsThroughLoadBalancer: Boolean(loadBalancerId && graph.hasConnection(apiId, loadBalancerId)),
  };
}

function latencyMetrics(processed: number, workerCount: number) {
  if (processed === 0 || workerCount === 0) {
    return { averageLatencyMs: 0, peakLatencyMs: 0, drainDurationMs: 0 };
  }

  const completionTimes = Array.from({ length: processed }, (_, index) => (Math.floor(index / workerCount) + 1) * WORKER_JOB_DURATION_MS);
  const drainDurationMs = completionTimes.at(-1) ?? 0;

  return {
    averageLatencyMs: Math.round(completionTimes.reduce((sum, duration) => sum + duration, 0) / processed),
    peakLatencyMs: drainDurationMs,
    drainDurationMs,
  };
}

function buildAssignments(apiIds: readonly string[], routes: ReadonlyMap<string, ApiRoute>) {
  const assigned = new Map(apiIds.map((apiId) => [apiId, 0]));
  for (let job = 0; job < LOAD_BALANCE_BURST; job += 1) {
    const apiId = apiIds[job % apiIds.length];
    assigned.set(apiId, (assigned.get(apiId) ?? 0) + 1);
  }

  return apiIds.map((apiId) => {
    const assignedJobs = assigned.get(apiId) ?? 0;
    const route = routes.get(apiId);
    return {
      apiId,
      assigned: assignedJobs,
      accepted: route && route.workerIds.length > 0 ? Math.min(assignedJobs, API_REPLICA_BURST_CAPACITY) : 0,
    };
  });
}

export function getLoadBalancingTopology(graph: ArchitectureGraph): LoadBalancingTopology {
  const activeLoadBalancerId = graph.nodes
    .filter((node) => node.kind === "load-balancer")
    .find((loadBalancer) => graph.incoming(loadBalancer.id).some((edge) => graph.getNode(edge.source.nodeId)?.kind === "client"))?.id ?? null;
  const clientResponseConnected = Boolean(activeLoadBalancerId && graph.outgoing(activeLoadBalancerId)
    .some((edge) => graph.getNode(edge.target.nodeId)?.kind === "client"));
  const apiIds = activeLoadBalancerId
    ? unique(graph.outgoing(activeLoadBalancerId)
      .map((edge) => graph.getNode(edge.target.nodeId))
      .filter((node) => node?.kind === "api")
      .map((api) => api!.id))
    : [];
  const routes = apiIds.map((apiId) => apiRoute(graph, apiId, activeLoadBalancerId));
  const directApiId = graph.nodes
    .filter((node) => node.kind === "api")
    .find((api) => graph.incoming(api.id).some((edge) => graph.getNode(edge.source.nodeId)?.kind === "client"))?.id ?? null;
  const directRoute = directApiId ? apiRoute(graph, directApiId, null) : null;
  const directApiResponds = Boolean(directApiId && graph.outgoing(directApiId)
    .some((edge) => graph.getNode(edge.target.nodeId)?.kind === "client"));

  return {
    activeLoadBalancerId,
    clientRequestConnected: Boolean(activeLoadBalancerId),
    clientResponseConnected,
    apiReplicaCount: apiIds.length,
    completeApiCount: routes.filter((route) => route.workerIds.length > 0 && route.returnsThroughLoadBalancer).length,
    queueIds: unique(routes.flatMap((route) => route.queueIds)),
    workerIds: unique(routes.flatMap((route) => route.workerIds)),
    directApiId,
    directApiCanProcess: Boolean(directRoute && directRoute.workerIds.length > 0),
    directApiResponds,
    directBypassPresent: graph.hasKindConnection("client", "api") || graph.hasKindConnection("api", "client"),
  };
}

function directResult(graph: ArchitectureGraph, topology: LoadBalancingTopology): LoadBalancingResult {
  const directRoute = topology.directApiId ? apiRoute(graph, topology.directApiId, null) : null;
  const assigned = topology.directApiId ? LOAD_BALANCE_BURST : 0;
  const accepted = directRoute?.workerIds.length ? Math.min(assigned, API_REPLICA_BURST_CAPACITY, QUEUE_CAPACITY) : 0;
  const clientResponses = topology.directApiResponds ? assigned : 0;
  const metrics = latencyMetrics(accepted, directRoute?.workerIds.length ?? 0);

  return {
    passed: false,
    processed: accepted,
    dropped: LOAD_BALANCE_BURST - accepted,
    maxBacklog: Math.max(0, accepted - (directRoute?.workerIds.length ?? 0) * WORKER_CONCURRENCY),
    ...metrics,
    acceptedResponses: topology.directApiResponds ? accepted : 0,
    rejectedResponses: topology.directApiResponds ? assigned - accepted : 0,
    clientResponses,
    unansweredRequests: LOAD_BALANCE_BURST - clientResponses,
    workerCount: directRoute?.workerIds.length ?? 0,
    apiReplicaCount: topology.directApiId ? 1 : 0,
    completeApiCount: 0,
    loadBalanced: false,
    apiAssignments: topology.directApiId ? [{ apiId: topology.directApiId, assigned, accepted }] : [],
    feedback: !topology.directApiId
      ? "The Client needs a route into the system before the burst can be handled."
      : !topology.directApiResponds
        ? "The Client has no response path back from the API."
        : !topology.directApiCanProcess
          ? "The direct API route does not reach a queue, worker, and database."
          : `One API can safely accept only ${API_REPLICA_BURST_CAPACITY} of the ${LOAD_BALANCE_BURST} jobs. The rest are rejected before they can wait in the queue.`,
  };
}

export function evaluateLoadBalancing(graph: ArchitectureGraph): LoadBalancingResult {
  const topology = getLoadBalancingTopology(graph);
  if (!topology.activeLoadBalancerId) return directResult(graph, topology);

  const apiIds = unique(graph.outgoing(topology.activeLoadBalancerId)
    .map((edge) => graph.getNode(edge.target.nodeId))
    .filter((node) => node?.kind === "api")
    .map((api) => api!.id));
  const routes = new Map(apiIds.map((apiId) => [apiId, apiRoute(graph, apiId, topology.activeLoadBalancerId)]));
  const apiAssignments = apiIds.length > 0 ? buildAssignments(apiIds, routes) : [];
  const processed = apiAssignments.reduce((total, assignment) => total + assignment.accepted, 0);
  const responseEligibleAssignments = topology.clientResponseConnected
    ? apiAssignments.filter((assignment) => routes.get(assignment.apiId)?.returnsThroughLoadBalancer)
    : [];
  const clientResponses = responseEligibleAssignments.reduce((total, assignment) => total + assignment.assigned, 0);
  const acceptedResponses = responseEligibleAssignments.reduce((total, assignment) => total + assignment.accepted, 0);
  const metrics = latencyMetrics(processed, topology.workerIds.length);
  const passed = topology.clientResponseConnected
    && !topology.directBypassPresent
    && topology.completeApiCount >= 2
    && processed === LOAD_BALANCE_BURST
    && clientResponses === LOAD_BALANCE_BURST;

  const feedback = !topology.clientResponseConnected
    ? "The load balancer needs a return edge to the Client so every request receives a response."
    : topology.directBypassPresent
      ? "The direct API request or response route still bypasses the load balancer."
    : apiIds.length === 0
      ? "The load balancer has no API route to receive the burst."
      : topology.completeApiCount < 2
        ? "One complete API route still has only half the burst capacity. Add another complete route for the load balancer to use."
        : clientResponses < LOAD_BALANCE_BURST
          ? "At least one selected API cannot return its response through the load balancer."
          : processed < LOAD_BALANCE_BURST
            ? "The selected API routes cannot safely retain the entire burst."
            : "Round robin split the burst across API replicas, so every job reached the queue and every Client request received a response.";

  return {
    passed,
    processed,
    dropped: LOAD_BALANCE_BURST - processed,
    maxBacklog: Math.max(0, processed - topology.workerIds.length * WORKER_CONCURRENCY),
    ...metrics,
    acceptedResponses,
    rejectedResponses: clientResponses - acceptedResponses,
    clientResponses,
    unansweredRequests: LOAD_BALANCE_BURST - clientResponses,
    workerCount: topology.workerIds.length,
    apiReplicaCount: topology.apiReplicaCount,
    completeApiCount: topology.completeApiCount,
    loadBalanced: true,
    apiAssignments,
    feedback,
  };
}
