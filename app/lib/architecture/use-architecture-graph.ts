"use client";

import { useMemo, useState } from "react";
import { ArchitectureGraph, GraphSnapshot, PortReference } from "./graph";
import { NodeAttributes, NodeKind, NodePosition } from "./nodes";

export function useArchitectureGraph(initialSnapshot: GraphSnapshot) {
  const [snapshot, setSnapshot] = useState<GraphSnapshot>(() => initialSnapshot);
  const graph = useMemo(() => new ArchitectureGraph(snapshot), [snapshot]);

  function update(transform: (current: ArchitectureGraph) => ArchitectureGraph) {
    setSnapshot((current) => transform(new ArchitectureGraph(current)).snapshot);
  }

  return {
    graph,
    snapshot,
    addNode: (kind: NodeKind, position: NodePosition, attributes?: Omit<NodeAttributes, "position">) => update((current) => current.addNode(kind, position, attributes)),
    moveNode: (nodeId: string, position: NodePosition) => update((current) => current.moveNode(nodeId, position)),
    connect: (source: PortReference, target: PortReference) => update((current) => current.connect(source, target)),
    removeEdge: (edgeId: string) => update((current) => current.removeEdge(edgeId)),
    removeNode: (nodeId: string) => update((current) => current.removeNode(nodeId)),
  };
}
