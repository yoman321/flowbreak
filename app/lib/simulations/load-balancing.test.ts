import { describe, expect, it } from "vitest";
import { ArchitectureGraph, createGraphSnapshot } from "../architecture/graph";
import { evaluateLoadBalancing } from "./load-balancing";

function createLoadBalanceGraph(edges: ReturnType<typeof createGraphSnapshot>["edges"]) {
  return new ArchitectureGraph(createGraphSnapshot([
    { id: "client-1", kind: "client", attributes: { position: { left: 5, top: 40 } } },
    { id: "load-balancer-1", kind: "load-balancer", attributes: { position: { left: 24, top: 40 } } },
    { id: "api-1", kind: "api", attributes: { position: { left: 45, top: 20 } } },
    { id: "api-2", kind: "api", attributes: { position: { left: 45, top: 62 } } },
    { id: "queue-1", kind: "queue", attributes: { position: { left: 63, top: 40 } } },
    { id: "workers-1", kind: "workers", attributes: { position: { left: 78, top: 20 } } },
    { id: "db-1", kind: "db", attributes: { position: { left: 88, top: 55 } } },
  ], edges));
}

const workerPath = [
  { id: "queue-worker", source: { nodeId: "queue-1", portId: "right-out" as const }, target: { nodeId: "workers-1", portId: "left-in" as const } },
  { id: "worker-db", source: { nodeId: "workers-1", portId: "right-out" as const }, target: { nodeId: "db-1", portId: "left-in" as const } },
];

const directStarter = [
  { id: "client-api", source: { nodeId: "client-1", portId: "right-out" as const }, target: { nodeId: "api-1", portId: "left-in" as const } },
  { id: "api-client", source: { nodeId: "api-1", portId: "left-out" as const }, target: { nodeId: "client-1", portId: "right-in" as const } },
  { id: "api-queue", source: { nodeId: "api-1", portId: "right-out" as const }, target: { nodeId: "queue-1", portId: "left-in" as const } },
  ...workerPath,
];

const fullLoadBalancedRoute = [
  { id: "client-load-balancer", source: { nodeId: "client-1", portId: "right-out" as const }, target: { nodeId: "load-balancer-1", portId: "left-in" as const } },
  { id: "load-balancer-api-1", source: { nodeId: "load-balancer-1", portId: "top-out" as const }, target: { nodeId: "api-1", portId: "left-in" as const } },
  { id: "load-balancer-api-2", source: { nodeId: "load-balancer-1", portId: "bottom-out" as const }, target: { nodeId: "api-2", portId: "left-in" as const } },
  { id: "api-1-queue", source: { nodeId: "api-1", portId: "right-out" as const }, target: { nodeId: "queue-1", portId: "top-in" as const } },
  { id: "api-2-queue", source: { nodeId: "api-2", portId: "right-out" as const }, target: { nodeId: "queue-1", portId: "bottom-in" as const } },
  ...workerPath,
  { id: "api-1-load-balancer", source: { nodeId: "api-1", portId: "left-out" as const }, target: { nodeId: "load-balancer-1", portId: "top-in" as const } },
  { id: "api-2-load-balancer", source: { nodeId: "api-2", portId: "left-out" as const }, target: { nodeId: "load-balancer-1", portId: "bottom-in" as const } },
  { id: "load-balancer-client", source: { nodeId: "load-balancer-1", portId: "left-out" as const }, target: { nodeId: "client-1", portId: "right-in" as const } },
];

describe("load balancing simulation", () => {
  it("shows the Level 02 starter route rejecting half the burst at one API", () => {
    const result = evaluateLoadBalancing(createLoadBalanceGraph(directStarter));

    expect(result).toMatchObject({
      passed: false,
      loadBalanced: false,
      processed: 250,
      dropped: 250,
      acceptedResponses: 250,
      rejectedResponses: 250,
      maxBacklog: 249,
    });
  });

  it("still fails when the load balancer reaches only one complete API route", () => {
    const result = evaluateLoadBalancing(createLoadBalanceGraph(fullLoadBalancedRoute.filter((edge) => !edge.id.includes("api-2"))));

    expect(result).toMatchObject({
      passed: false,
      loadBalanced: true,
      apiReplicaCount: 1,
      completeApiCount: 1,
      processed: 250,
      dropped: 250,
      acceptedResponses: 250,
      rejectedResponses: 250,
    });
  });

  it("round robins the burst across two complete API replicas and drains the queue", () => {
    const result = evaluateLoadBalancing(createLoadBalanceGraph(fullLoadBalancedRoute));

    expect(result).toMatchObject({
      passed: true,
      loadBalanced: true,
      processed: 500,
      dropped: 0,
      acceptedResponses: 500,
      rejectedResponses: 0,
      unansweredRequests: 0,
      apiReplicaCount: 2,
      completeApiCount: 2,
      maxBacklog: 499,
      averageLatencyMs: 250500,
      peakLatencyMs: 500000,
      drainDurationMs: 500000,
    });
    expect(result.apiAssignments).toEqual([
      { apiId: "api-1", assigned: 250, accepted: 250 },
      { apiId: "api-2", assigned: 250, accepted: 250 },
    ]);
  });

  it("does not pass when a selected API cannot return through the load balancer", () => {
    const result = evaluateLoadBalancing(createLoadBalanceGraph(fullLoadBalancedRoute.filter((edge) => edge.id !== "api-2-load-balancer")));

    expect(result).toMatchObject({
      passed: false,
      processed: 500,
      clientResponses: 250,
      unansweredRequests: 250,
      acceptedResponses: 250,
    });
  });

  it("requires the original direct request and response route to be removed", () => {
    const result = evaluateLoadBalancing(createLoadBalanceGraph([...fullLoadBalancedRoute, ...directStarter.slice(0, 2)]));

    expect(result).toMatchObject({
      passed: false,
      loadBalanced: true,
      processed: 500,
      dropped: 0,
      feedback: "The direct API request or response route still bypasses the load balancer.",
    });
  });

  it("rejects work sent to an API that does not reach the worker path", () => {
    const result = evaluateLoadBalancing(createLoadBalanceGraph(fullLoadBalancedRoute.filter((edge) => edge.id !== "api-2-queue")));

    expect(result).toMatchObject({
      passed: false,
      processed: 250,
      dropped: 250,
      clientResponses: 500,
      acceptedResponses: 250,
      rejectedResponses: 250,
    });
  });
});
