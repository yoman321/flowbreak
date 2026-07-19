import { describe, expect, it } from "vitest";
import { ApiServiceNode, ClientNode, DatabaseNode, LoadBalancerNode } from "./nodes";
import { ArchitectureGraph, createGraphSnapshot } from "./graph";

function graphWithCoreNodes() {
  return new ArchitectureGraph(createGraphSnapshot([
    { id: "client-1", kind: "client", attributes: { position: { left: 5, top: 40 } } },
    { id: "load-balancer-1", kind: "load-balancer", attributes: { position: { left: 20, top: 40 } } },
    { id: "api-1", kind: "api", attributes: { position: { left: 35, top: 40 } } },
    { id: "db-1", kind: "db", attributes: { position: { left: 65, top: 40 } } },
    { id: "workers-1", kind: "workers", attributes: { position: { left: 65, top: 65 } } },
  ]));
}

describe("ArchitectureGraph", () => {
  it("hydrates each snapshot kind into its concrete node class", () => {
    const graph = graphWithCoreNodes();

    expect(graph.getNode("client-1")).toBeInstanceOf(ClientNode);
    expect(graph.getNode("load-balancer-1")).toBeInstanceOf(LoadBalancerNode);
    expect(graph.getNode("api-1")).toBeInstanceOf(ApiServiceNode);
    expect(graph.getNode("db-1")).toBeInstanceOf(DatabaseNode);
    expect(graph.getNode("api-1")?.toSnapshot()).toEqual({
      id: "api-1",
      kind: "api",
      attributes: { position: { left: 35, top: 40 } },
    });
  });

  it("connects any node side to any receiving side and exposes per-node adjacency", () => {
    const graph = graphWithCoreNodes()
      .connect({ nodeId: "client-1", portId: "top-out" }, { nodeId: "api-1", portId: "bottom-in" })
      .connect({ nodeId: "api-1", portId: "left-out" }, { nodeId: "client-1", portId: "right-in" })
      .connect({ nodeId: "api-1", portId: "right-out" }, { nodeId: "db-1", portId: "left-in" })
      .connect({ nodeId: "api-1", portId: "bottom-out" }, { nodeId: "workers-1", portId: "top-in" });

    expect(graph.edges).toHaveLength(4);
    expect(graph.outgoing("api-1")).toHaveLength(3);
    expect(graph.incoming("client-1")).toHaveLength(1);
    expect(graph.hasKindConnection("api", "client")).toBe(true);
    expect(graph.edgePresentation(graph.edges[1])).toBe("response");
  });

  it("marks direct and load-balanced return paths as response edges", () => {
    const graph = graphWithCoreNodes()
      .connect({ nodeId: "api-1", portId: "left-out" }, { nodeId: "load-balancer-1", portId: "right-in" })
      .connect({ nodeId: "load-balancer-1", portId: "left-out" }, { nodeId: "client-1", portId: "right-in" });

    expect(graph.edgePresentation(graph.edges[0])).toBe("response");
    expect(graph.edgePresentation(graph.edges[1])).toBe("response");
  });

  it("rejects self-links, reversed ports, and duplicate edges", () => {
    const graph = graphWithCoreNodes();
    const selfLink = graph.connect({ nodeId: "client-1", portId: "top-out" }, { nodeId: "client-1", portId: "bottom-in" });
    const reversedPorts = graph.connect({ nodeId: "client-1", portId: "left-in" }, { nodeId: "api-1", portId: "right-out" });
    const connected = graph.connect({ nodeId: "client-1", portId: "top-out" }, { nodeId: "api-1", portId: "bottom-in" });

    expect(selfLink).toBe(graph);
    expect(reversedPorts).toBe(graph);
    expect(connected.connect({ nodeId: "client-1", portId: "top-out" }, { nodeId: "api-1", portId: "bottom-in" })).toBe(connected);
  });

  it("moves nodes, assigns the next kind-specific id, and removes incident edges", () => {
    const graph = graphWithCoreNodes()
      .connect({ nodeId: "client-1", portId: "right-out" }, { nodeId: "api-1", portId: "left-in" })
      .connect({ nodeId: "api-1", portId: "right-out" }, { nodeId: "db-1", portId: "left-in" })
      .moveNode("api-1", { left: 42, top: 18 })
      .addNode("api", { left: 42, top: 66 });

    expect(graph.getNode("api-1")?.position).toEqual({ left: 42, top: 18 });
    expect(graph.getNode("api-2")).toBeInstanceOf(ApiServiceNode);
    expect(graph.removeNode("api-1").edges).toEqual([]);
  });
});
