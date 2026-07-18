export type NodeKind = "client" | "api" | "queue" | "workers" | "db" | "external-api";
export type NodePosition = { left: number; top: number };
export type NodeAttributes = { position: NodePosition; [attribute: string]: unknown };
export type NodeSnapshot = { id: string; kind: NodeKind; attributes: NodeAttributes };
export const nodePortSides = ["top", "right", "bottom", "left"] as const;
export type NodePortSide = typeof nodePortSides[number];
export type NodePortId = `${NodePortSide}-${"in" | "out"}`;
export type NodePort = { id: NodePortId; side: NodePortSide; direction: "input" | "output"; label: string };
export type NodePresentation = { icon: string; label: string; detail: string };

export abstract class ArchitectureNode {
  abstract readonly kind: NodeKind;
  abstract readonly presentation: NodePresentation;

  constructor(readonly id: string, readonly attributes: NodeAttributes) {}

  get position() {
    return this.attributes.position;
  }

  get ports(): readonly NodePort[] {
    return nodePortSides.flatMap((side) => [
      { id: `${side}-in` as NodePortId, side, direction: "input" as const, label: this.kind === "client" ? "Receive a response" : "Receive data" },
      { id: `${side}-out` as NodePortId, side, direction: "output" as const, label: this.kind === "api" ? "Send work or a response" : "Send data" },
    ]);
  }

  getPort(portId: NodePortId) {
    return this.ports.find((port) => port.id === portId);
  }

  toSnapshot(): NodeSnapshot {
    return { id: this.id, kind: this.kind, attributes: this.attributes };
  }
}

export class ClientNode extends ArchitectureNode {
  readonly kind = "client" as const;
  readonly presentation = { icon: "◎", label: "Client", detail: "Starts traffic" };
}

export class ApiServiceNode extends ArchitectureNode {
  readonly kind = "api" as const;
  readonly presentation = { icon: "◈", label: "API service", detail: "Accepts requests" };
}

export class QueueNode extends ArchitectureNode {
  readonly kind = "queue" as const;
  readonly presentation = { icon: "≋", label: "Queue", detail: "Buffers work" };
}

export class WorkerPoolNode extends ArchitectureNode {
  readonly kind = "workers" as const;
  readonly presentation = { icon: "⚙", label: "Worker pool", detail: "Processes work" };
}

export class DatabaseNode extends ArchitectureNode {
  readonly kind = "db" as const;
  readonly presentation = { icon: "▣", label: "Database", detail: "Stores data" };
}

export class ExternalApiNode extends ArchitectureNode {
  readonly kind = "external-api" as const;
  readonly presentation = { icon: "↗", label: "External API", detail: "Calls a partner service" };
}

export const nodeKinds: readonly NodeKind[] = ["client", "api", "queue", "workers", "db", "external-api"];

export function isNodeKind(value: string): value is NodeKind {
  return nodeKinds.includes(value as NodeKind);
}

export function createArchitectureNode(snapshot: NodeSnapshot): ArchitectureNode {
  switch (snapshot.kind) {
    case "client": return new ClientNode(snapshot.id, snapshot.attributes);
    case "api": return new ApiServiceNode(snapshot.id, snapshot.attributes);
    case "queue": return new QueueNode(snapshot.id, snapshot.attributes);
    case "workers": return new WorkerPoolNode(snapshot.id, snapshot.attributes);
    case "db": return new DatabaseNode(snapshot.id, snapshot.attributes);
    case "external-api": return new ExternalApiNode(snapshot.id, snapshot.attributes);
  }
}
