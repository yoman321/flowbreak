import { ArchitectureGraph } from "../architecture/graph";

export const TRAFFIC_SPIKE_BURST = 500;
export const API_BURST_CAPACITY = 500;
export const QUEUE_CAPACITY = 500;
export const WORKER_CONCURRENCY = 1;
export const WORKER_JOB_DURATION_MS = 1000;

export type TrafficSpikeTopology = {
  clientRequestConnected: boolean;
  clientResponseConnected: boolean;
  queueInFlow: boolean;
  directWorkerCount: number;
  queueWorkerCount: number;
};

export type TrafficSpikeResult = {
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
  queueInFlow: boolean;
  feedback: string;
};

function connectedWorkerIds(graph: ArchitectureGraph, sourceNodeIds: ReadonlySet<string>) {
  return graph.nodes
    .filter((node) => node.kind === "workers")
    .filter((worker) => graph.incoming(worker.id).some((edge) => sourceNodeIds.has(edge.source.nodeId)))
    .filter((worker) => graph.outgoing(worker.id).some((edge) => graph.getNode(edge.target.nodeId)?.kind === "db"))
    .map((worker) => worker.id);
}

export function getTrafficSpikeTopology(graph: ArchitectureGraph): TrafficSpikeTopology {
  const apiNodeIds = new Set(graph.nodes.filter((node) => node.kind === "api").map((node) => node.id));
  const queueNodeIds = new Set(graph.nodes
    .filter((node) => node.kind === "queue")
    .filter((queue) => graph.incoming(queue.id).some((edge) => apiNodeIds.has(edge.source.nodeId)))
    .map((queue) => queue.id));
  const queueWorkerCount = connectedWorkerIds(graph, queueNodeIds).length;

  return {
    clientRequestConnected: graph.hasKindConnection("client", "api"),
    clientResponseConnected: graph.hasKindConnection("api", "client"),
    queueInFlow: graph.hasKindPath(["api", "queue", "workers", "db"]),
    directWorkerCount: connectedWorkerIds(graph, apiNodeIds).length,
    queueWorkerCount,
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

export function evaluateTrafficSpike(graph: ArchitectureGraph): TrafficSpikeResult {
  const topology = getTrafficSpikeTopology(graph);
  const clientConnected = topology.clientRequestConnected && topology.clientResponseConnected;

  if (!clientConnected) {
    return {
      passed: false,
      processed: 0,
      dropped: 0,
      maxBacklog: 0,
      averageLatencyMs: 0,
      peakLatencyMs: 0,
      drainDurationMs: 0,
      acceptedResponses: 0,
      rejectedResponses: 0,
      clientResponses: 0,
      unansweredRequests: TRAFFIC_SPIKE_BURST,
      workerCount: 0,
      queueInFlow: topology.queueInFlow,
      feedback: "The Client needs both a request edge to the API and a response edge back before the burst can be acknowledged.",
    };
  }

  if (topology.queueInFlow && topology.queueWorkerCount > 0) {
    const accepted = Math.min(TRAFFIC_SPIKE_BURST, API_BURST_CAPACITY, QUEUE_CAPACITY);
    const processed = accepted;
    const metrics = latencyMetrics(processed, topology.queueWorkerCount);

    return {
      passed: accepted === TRAFFIC_SPIKE_BURST,
      processed,
      dropped: TRAFFIC_SPIKE_BURST - accepted,
      maxBacklog: Math.max(0, accepted - topology.queueWorkerCount * WORKER_CONCURRENCY),
      ...metrics,
      acceptedResponses: accepted,
      rejectedResponses: TRAFFIC_SPIKE_BURST - accepted,
      clientResponses: TRAFFIC_SPIKE_BURST,
      unansweredRequests: 0,
      workerCount: topology.queueWorkerCount,
      queueInFlow: true,
      feedback: accepted === TRAFFIC_SPIKE_BURST
        ? "Every job was stored in the queue. Each worker processes one job at a time while the backlog drains."
        : "The queue filled before the API could safely retain every job.",
    };
  }

  const processed = Math.min(API_BURST_CAPACITY, topology.directWorkerCount * WORKER_CONCURRENCY);
  const metrics = latencyMetrics(processed, topology.directWorkerCount);

  return {
    passed: false,
    processed,
    dropped: TRAFFIC_SPIKE_BURST - processed,
    maxBacklog: 0,
    ...metrics,
    acceptedResponses: processed,
    rejectedResponses: TRAFFIC_SPIKE_BURST - processed,
    clientResponses: TRAFFIC_SPIKE_BURST,
    unansweredRequests: 0,
    workerCount: topology.directWorkerCount,
    queueInFlow: false,
    feedback: topology.directWorkerCount === 0
      ? "The API has no complete worker path to process the burst."
      : `The API received ${TRAFFIC_SPIKE_BURST} jobs, but the direct workers can begin only ${processed} now. Use a queue to retain the rest while work is in progress.`,
  };
}
