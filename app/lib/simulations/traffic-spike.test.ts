import { describe, expect, it } from "vitest";
import { ArchitectureGraph, createGraphSnapshot } from "../architecture/graph";
import { evaluateTrafficSpike } from "./traffic-spike";

function createTrafficGraph(edges: ReturnType<typeof createGraphSnapshot>["edges"]) {
  return new ArchitectureGraph(createGraphSnapshot([
    { id: "client-1", kind: "client", attributes: { position: { left: 5, top: 40 } } },
    { id: "api-1", kind: "api", attributes: { position: { left: 29, top: 20 } } },
    { id: "queue-1", kind: "queue", attributes: { position: { left: 48, top: 55 } } },
    { id: "workers-1", kind: "workers", attributes: { position: { left: 56, top: 20 } } },
    { id: "db-1", kind: "db", attributes: { position: { left: 77, top: 40 } } },
  ], edges));
}

const requestAndResponse = [
  { id: "client-api", source: { nodeId: "client-1", portId: "right-out" as const }, target: { nodeId: "api-1", portId: "left-in" as const } },
  { id: "api-client", source: { nodeId: "api-1", portId: "left-out" as const }, target: { nodeId: "client-1", portId: "right-in" as const } },
];

describe("traffic spike simulation", () => {
  it("rejects the waiting work when a serial worker is connected directly", () => {
    const result = evaluateTrafficSpike(createTrafficGraph([
      ...requestAndResponse,
      { id: "api-worker", source: { nodeId: "api-1", portId: "right-out" }, target: { nodeId: "workers-1", portId: "left-in" } },
      { id: "worker-db", source: { nodeId: "workers-1", portId: "right-out" }, target: { nodeId: "db-1", portId: "left-in" } },
    ]));

    expect(result).toMatchObject({ passed: false, processed: 1, dropped: 499, acceptedResponses: 1, rejectedResponses: 499, maxBacklog: 0 });
  });

  it("stores a 500-job burst and drains it one job at a time through a queue", () => {
    const result = evaluateTrafficSpike(createTrafficGraph([
      ...requestAndResponse,
      { id: "api-queue", source: { nodeId: "api-1", portId: "right-out" }, target: { nodeId: "queue-1", portId: "left-in" } },
      { id: "queue-worker", source: { nodeId: "queue-1", portId: "right-out" }, target: { nodeId: "workers-1", portId: "left-in" } },
      { id: "worker-db", source: { nodeId: "workers-1", portId: "right-out" }, target: { nodeId: "db-1", portId: "left-in" } },
    ]));

    expect(result).toMatchObject({
      passed: true,
      processed: 500,
      dropped: 0,
      acceptedResponses: 500,
      rejectedResponses: 0,
      maxBacklog: 499,
      averageLatencyMs: 250500,
      peakLatencyMs: 500000,
      drainDurationMs: 500000,
    });
  });

  it("fails a queue-backed route when the client has no API response edge", () => {
    const result = evaluateTrafficSpike(createTrafficGraph([
      requestAndResponse[0],
      { id: "api-queue", source: { nodeId: "api-1", portId: "right-out" }, target: { nodeId: "queue-1", portId: "left-in" } },
      { id: "queue-worker", source: { nodeId: "queue-1", portId: "right-out" }, target: { nodeId: "workers-1", portId: "left-in" } },
      { id: "worker-db", source: { nodeId: "workers-1", portId: "right-out" }, target: { nodeId: "db-1", portId: "left-in" } },
    ]));

    expect(result).toMatchObject({ passed: false, acceptedResponses: 0, unansweredRequests: 500 });
  });

  it("gives every connected worker its own single-job slot", () => {
    const graph = createTrafficGraph([
      ...requestAndResponse,
      { id: "api-queue", source: { nodeId: "api-1", portId: "right-out" }, target: { nodeId: "queue-1", portId: "left-in" } },
      { id: "queue-worker", source: { nodeId: "queue-1", portId: "right-out" }, target: { nodeId: "workers-1", portId: "left-in" } },
      { id: "worker-db", source: { nodeId: "workers-1", portId: "right-out" }, target: { nodeId: "db-1", portId: "left-in" } },
    ]).addNode("workers", { left: 56, top: 60 })
      .connect({ nodeId: "queue-1", portId: "bottom-out" }, { nodeId: "workers-2", portId: "top-in" })
      .connect({ nodeId: "workers-2", portId: "right-out" }, { nodeId: "db-1", portId: "bottom-in" });

    const result = evaluateTrafficSpike(graph);

    expect(result).toMatchObject({ workerCount: 2, maxBacklog: 498, drainDurationMs: 250000, peakLatencyMs: 250000 });
  });
});
