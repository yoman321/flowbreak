"use client";

import { DragEvent, ReactNode, useLayoutEffect, useRef, useState } from "react";
import { ArchitectureGraph, PortReference } from "../lib/architecture/graph";
import { ArchitectureNode, NodeKind, NodePortId, NodePortSide, NodePosition, NodePresentation, isNodeKind } from "../lib/architecture/nodes";
import { CanvasNode, CanvasNodeResponse, CanvasNodeTooltip } from "./canvas-node";
import { CanvasTrashTarget } from "./canvas-trash-target";

type NodeRect = { x: number; y: number; width: number; height: number };
type ConnectionPreview = { source: PortReference; x: number; y: number };

const nodeTransferType = "flowbreak-node";
const connectionTransferType = "flowbreak-connection";

function portSide(portId: NodePortId): NodePortSide {
  return portId.split("-")[0] as NodePortSide;
}

function portAnchor(rect: NodeRect, side: NodePortSide) {
  switch (side) {
    case "top": return { x: rect.x + rect.width / 2, y: rect.y - 2 };
    case "right": return { x: rect.x + rect.width + 2, y: rect.y + rect.height / 2 };
    case "bottom": return { x: rect.x + rect.width / 2, y: rect.y + rect.height + 2 };
    case "left": return { x: rect.x - 2, y: rect.y + rect.height / 2 };
  }
}

export function startTrayNodeDrag(event: DragEvent<HTMLElement>, kind: NodeKind) {
  event.dataTransfer.setData(nodeTransferType, kind);
  event.dataTransfer.effectAllowed = "move";
}

export function ArchitectureGraphCanvas({
  graph,
  markerPrefix,
  note,
  nodePresentation,
  nodeTooltip,
  nodeResponse,
  onAddNode,
  onMoveNode,
  onConnect,
  onRemoveEdge,
  onRemoveNode,
  onNodeAdded,
}: {
  graph: ArchitectureGraph;
  markerPrefix: string;
  note: ReactNode;
  nodePresentation: (node: ArchitectureNode) => NodePresentation;
  nodeTooltip: (node: ArchitectureNode, graph: ArchitectureGraph) => CanvasNodeTooltip;
  nodeResponse?: (node: ArchitectureNode) => CanvasNodeResponse | undefined;
  onAddNode: (kind: NodeKind, position: NodePosition) => void;
  onMoveNode: (nodeId: string, position: NodePosition) => void;
  onConnect: (source: PortReference, target: PortReference) => void;
  onRemoveEdge: (edgeId: string) => void;
  onRemoveNode: (nodeId: string) => void;
  onNodeAdded?: (kind: NodeKind) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [connectionPreview, setConnectionPreview] = useState<ConnectionPreview | null>(null);
  const [nodeRects, setNodeRects] = useState<Record<string, NodeRect>>({});
  const canvasRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Record<string, HTMLDivElement | undefined>>({});
  const previewSource = connectionPreview ? nodeRects[connectionPreview.source.nodeId] : undefined;

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const updateNodeRects = () => {
      const canvasRect = canvas.getBoundingClientRect();
      const nextRects: Record<string, NodeRect> = {};
      Object.entries(nodeRefs.current).forEach(([id, node]) => {
        if (!node) return;
        const rect = node.getBoundingClientRect();
        nextRects[id] = { x: rect.left - canvasRect.left, y: rect.top - canvasRect.top, width: rect.width, height: rect.height };
      });
      setNodeRects(nextRects);
    };

    updateNodeRects();
    const observer = new ResizeObserver(updateNodeRects);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [graph]);

  function finishDrag() {
    setDragging(false);
    setDraggedNodeId(null);
    setConnectionPreview(null);
  }

  function dragOverCanvas(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    setDragging(true);
    setConnectionPreview((current) => current ? { ...current, x: event.clientX - rect.left, y: event.clientY - rect.top } : current);
  }

  function dropOnCanvas(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (event.dataTransfer.getData(connectionTransferType)) {
      finishDrag();
      return;
    }

    const kind = event.dataTransfer.getData(nodeTransferType);
    const draggedNode = event.dataTransfer.getData("text/plain");
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const existingNode = nodeRefs.current[draggedNode] ?? Object.values(nodeRefs.current).find(Boolean);
    const nodeWidth = existingNode?.offsetWidth ?? 126;
    const nodeHeight = existingNode?.offsetHeight ?? 48;
    const leftPx = Math.min(Math.max(0, canvas.clientWidth - nodeWidth), Math.max(0, event.clientX - rect.left - canvas.clientLeft - nodeWidth / 2));
    const topPx = Math.min(Math.max(0, canvas.clientHeight - nodeHeight), Math.max(0, event.clientY - rect.top - canvas.clientTop - nodeHeight / 2));
    const position = { left: (leftPx / canvas.clientWidth) * 100, top: (topPx / canvas.clientHeight) * 100 };

    if (isNodeKind(kind)) {
      onAddNode(kind, position);
      onNodeAdded?.(kind);
    } else if (draggedNode && graph.getNode(draggedNode)) {
      onMoveNode(draggedNode, position);
    }
    finishDrag();
  }

  function startNodeDrag(event: DragEvent<HTMLElement>, item: string) {
    const nodeId = item.slice("node:".length);
    event.dataTransfer.setData("text/plain", nodeId);
    event.dataTransfer.effectAllowed = "move";
    setDragging(true);
    setDraggedNodeId(nodeId);
  }

  function startConnection(event: DragEvent<HTMLButtonElement>, sourceId: string, sourcePortId: NodePortId) {
    event.stopPropagation();
    const source: PortReference = { nodeId: sourceId, portId: sourcePortId };
    event.dataTransfer.setData(connectionTransferType, JSON.stringify(source));
    event.dataTransfer.effectAllowed = "link";
    setDragging(true);
    setConnectionPreview({ source, x: 0, y: 0 });
  }

  function completeConnection(event: DragEvent<HTMLButtonElement>, targetId: string, targetPortId: NodePortId) {
    event.preventDefault();
    event.stopPropagation();
    const rawSource = event.dataTransfer.getData(connectionTransferType);
    try {
      const source = JSON.parse(rawSource) as PortReference;
      if (source?.nodeId && source.nodeId !== targetId) onConnect(source, { nodeId: targetId, portId: targetPortId });
    } catch {
      // An invalid drop simply ends the connection drag.
    }
    finishDrag();
  }

  function deleteNode(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    const nodeId = event.dataTransfer.getData("text/plain");
    if (nodeId && graph.getNode(nodeId)) onRemoveNode(nodeId);
    finishDrag();
  }

  return <div ref={canvasRef} className={`canvas ${dragging ? "drop-target" : ""}`} onDragOver={dragOverCanvas} onDrop={dropOnCanvas}>
    <svg className="connections" viewBox={`0 0 ${canvasRef.current?.clientWidth ?? 0} ${canvasRef.current?.clientHeight ?? 0}`} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <marker id={`${markerPrefix}-flow-arrow`} markerUnits="userSpaceOnUse" markerWidth="8" markerHeight="8" refX="8" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" /></marker>
        <marker id={`${markerPrefix}-flow-arrow-preview`} markerUnits="userSpaceOnUse" markerWidth="8" markerHeight="8" refX="8" refY="4" orient="auto"><path className="preview-arrowhead" d="M0,0 L8,4 L0,8 Z" /></marker>
        <marker id={`${markerPrefix}-response-arrow`} markerUnits="userSpaceOnUse" markerWidth="8" markerHeight="8" refX="8" refY="4" orient="auto"><path className="response-arrowhead" d="M0,0 L8,4 L0,8 Z" /></marker>
      </defs>
      {connectionPreview && previewSource && (() => {
        const source = portAnchor(previewSource, portSide(connectionPreview.source.portId));
        return <path className="connection-preview" markerEnd={`url(#${markerPrefix}-flow-arrow-preview)`} d={`M ${source.x} ${source.y} L ${connectionPreview.x} ${connectionPreview.y}`} />;
      })()}
      {graph.edges.map((edge) => {
        const source = nodeRects[edge.source.nodeId];
        const target = nodeRects[edge.target.nodeId];
        if (!source || !target) return null;
        const start = portAnchor(source, portSide(edge.source.portId));
        const end = portAnchor(target, portSide(edge.target.portId));
        const startX = start.x;
        const startY = start.y;
        const endX = end.x;
        const endY = end.y;
        const hasReturnEdge = graph.hasConnection(edge.target.nodeId, edge.source.nodeId);
        const path = hasReturnEdge
          ? `M ${startX} ${startY} Q ${(startX + endX) / 2} ${((startY + endY) / 2) + (source.x < target.x ? -30 : 30)} ${endX} ${endY}`
          : `M ${startX} ${startY} L ${endX} ${endY}`;
        const presentation = graph.edgePresentation(edge);
        return <g key={edge.id}>
          <path className="connection-hit" d={path} onClick={() => onRemoveEdge(edge.id)} />
          <path className={`connection ${presentation === "response" ? "response-connection" : ""}`} markerEnd={`url(#${markerPrefix}-${presentation === "response" ? "response" : "flow"}-arrow)`} d={path} />
        </g>;
      })}
    </svg>
    {graph.nodes.map((node) => <CanvasNode key={node.id} node={node} nodeRef={(element) => { nodeRefs.current[node.id] = element ?? undefined; }} presentation={nodePresentation(node)} tooltip={nodeTooltip(node, graph)} response={nodeResponse?.(node)} onDragStart={startNodeDrag} onDragEnd={finishDrag} onConnectionStart={startConnection} onConnectionEnd={completeConnection} />)}
    <div className="canvas-note">{note}</div>
    {draggedNodeId && <CanvasTrashTarget onDrop={deleteNode} />}
  </div>;
}
