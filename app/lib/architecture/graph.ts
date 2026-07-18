import { ArchitectureNode, NodeAttributes, NodeKind, NodePort, NodePosition, NodeSnapshot, createArchitectureNode } from "./nodes";

export type PortReference = { nodeId: string; portId: NodePort["id"] };
export type GraphEdge = { id: string; source: PortReference; target: PortReference };
export type GraphSnapshot = { version: 1; nodes: NodeSnapshot[]; edges: GraphEdge[] };
export type EdgePresentation = "flow" | "response";

export class ArchitectureGraph {
  readonly nodes: readonly ArchitectureNode[];
  readonly edges: readonly GraphEdge[];
  private readonly nodeById: Map<string, ArchitectureNode>;

  constructor(readonly snapshot: GraphSnapshot) {
    this.nodes = snapshot.nodes.map(createArchitectureNode);
    this.edges = snapshot.edges;
    this.nodeById = new Map(this.nodes.map((node) => [node.id, node]));
  }

  getNode(nodeId: string) {
    return this.nodeById.get(nodeId);
  }

  incoming(nodeId: string) {
    return this.edges.filter((edge) => edge.target.nodeId === nodeId);
  }

  outgoing(nodeId: string) {
    return this.edges.filter((edge) => edge.source.nodeId === nodeId);
  }

  hasConnection(sourceId: string, targetId: string) {
    return this.edges.some((edge) => edge.source.nodeId === sourceId && edge.target.nodeId === targetId);
  }

  hasKindConnection(sourceKind: NodeKind, targetKind: NodeKind) {
    return this.edges.some((edge) => this.getNode(edge.source.nodeId)?.kind === sourceKind && this.getNode(edge.target.nodeId)?.kind === targetKind);
  }

  hasKindPath(kinds: readonly NodeKind[]) {
    if (kinds.length === 0) return false;

    let candidates = this.nodes.filter((node) => node.kind === kinds[0]).map((node) => node.id);
    for (const kind of kinds.slice(1)) {
      candidates = candidates.flatMap((nodeId) => this.outgoing(nodeId)
        .map((edge) => edge.target.nodeId)
        .filter((nodeId) => this.getNode(nodeId)?.kind === kind));
      if (candidates.length === 0) return false;
    }

    return true;
  }

  edgePresentation(edge: GraphEdge): EdgePresentation {
    return this.getNode(edge.source.nodeId)?.kind === "api" && this.getNode(edge.target.nodeId)?.kind === "client"
      ? "response"
      : "flow";
  }

  moveNode(nodeId: string, position: NodePosition) {
    const node = this.getNode(nodeId);
    if (!node) return this;
    return this.withSnapshot({
      ...this.snapshot,
      nodes: this.snapshot.nodes.map((candidate) => candidate.id === nodeId
        ? { ...candidate, attributes: { ...candidate.attributes, position } }
        : candidate),
    });
  }

  addNode(kind: NodeKind, position: NodePosition, attributes: Omit<NodeAttributes, "position"> = {}) {
    const id = this.nextNodeId(kind);
    return this.withSnapshot({
      ...this.snapshot,
      nodes: [...this.snapshot.nodes, { id, kind, attributes: { ...attributes, position } }],
    });
  }

  connect(source: PortReference, target: PortReference) {
    const sourceNode = this.getNode(source.nodeId);
    const targetNode = this.getNode(target.nodeId);
    if (!sourceNode || !targetNode || source.nodeId === target.nodeId) return this;
    if (sourceNode.getPort(source.portId)?.direction !== "output" || targetNode.getPort(target.portId)?.direction !== "input") return this;
    if (this.edges.some((edge) => edge.source.nodeId === source.nodeId && edge.source.portId === source.portId && edge.target.nodeId === target.nodeId && edge.target.portId === target.portId)) return this;

    const edge: GraphEdge = {
      id: `${source.nodeId}:${source.portId}->${target.nodeId}:${target.portId}`,
      source,
      target,
    };
    return this.withSnapshot({ ...this.snapshot, edges: [...this.snapshot.edges, edge] });
  }

  removeEdge(edgeId: string) {
    return this.withSnapshot({ ...this.snapshot, edges: this.snapshot.edges.filter((edge) => edge.id !== edgeId) });
  }

  removeNode(nodeId: string) {
    if (!this.getNode(nodeId)) return this;
    return this.withSnapshot({
      ...this.snapshot,
      nodes: this.snapshot.nodes.filter((node) => node.id !== nodeId),
      edges: this.snapshot.edges.filter((edge) => edge.source.nodeId !== nodeId && edge.target.nodeId !== nodeId),
    });
  }

  private nextNodeId(kind: NodeKind) {
    const prefix = kind === "external-api" ? "external-api" : kind;
    const largestExistingNumber = this.snapshot.nodes
      .filter((node) => node.kind === kind)
      .map((node) => Number(node.id.slice(prefix.length + 1)))
      .filter(Number.isFinite)
      .reduce((largest, current) => Math.max(largest, current), 0);
    return `${prefix}-${largestExistingNumber + 1}`;
  }

  private withSnapshot(snapshot: GraphSnapshot) {
    return new ArchitectureGraph(snapshot);
  }
}

export function createGraphSnapshot(nodes: NodeSnapshot[], edges: GraphEdge[] = []): GraphSnapshot {
  return { version: 1, nodes, edges };
}
