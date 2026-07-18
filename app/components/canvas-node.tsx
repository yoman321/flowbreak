"use client";

import { DragEvent, useEffect, useRef, useState } from "react";
import { ArchitectureNode, NodePortId, NodePortSide, NodePresentation, nodePortSides } from "../lib/architecture/nodes";

export type CanvasNodeStat = { label: string; value: string; tone?: "green" | "amber" };
export type CanvasNodeTooltip = {
  description: string;
  sourceSection: string;
  stats: CanvasNodeStat[];
};

export type CanvasNodeResponse = {
  label: string;
  detail: string;
  tone?: "success" | "failure";
};

export function CanvasNode({ node, nodeRef, presentation = node.presentation, tooltip, response, onDragStart, onDragEnd, onConnectionStart, onConnectionEnd }: {
  node: ArchitectureNode;
  nodeRef: (element: HTMLDivElement | null) => void;
  presentation?: NodePresentation;
  tooltip: CanvasNodeTooltip;
  response?: CanvasNodeResponse;
  onDragStart: (event: DragEvent<HTMLElement>, item: string) => void;
  onDragEnd: () => void;
  onConnectionStart: (event: DragEvent<HTMLButtonElement>, source: string, portId: NodePortId) => void;
  onConnectionEnd: (event: DragEvent<HTMLButtonElement>, target: string, portId: NodePortId) => void;
}) {
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tooltipId = `node-tooltip-${node.id}`;
  const verticalPlacement = node.position.top < 40 ? "below" : "above";
  const horizontalPlacement = node.position.left > 65 ? "end" : "start";

  function clearHoverTimer() {
    if (!hoverTimer.current) return;
    clearTimeout(hoverTimer.current);
    hoverTimer.current = null;
  }

  function scheduleTooltip() {
    clearHoverTimer();
    hoverTimer.current = setTimeout(() => setTooltipOpen(true), 1000);
  }

  function hideTooltip() {
    clearHoverTimer();
    setTooltipOpen(false);
  }

  useEffect(() => () => clearHoverTimer(), []);

  function directionalPort(side: NodePortSide) {
    const inputPortId = `${side}-in` as NodePortId;
    const outputPortId = `${side}-out` as NodePortId;
    const inputLabel = node.getPort(inputPortId)?.label ?? "Receive data";
    const outputLabel = node.getPort(outputPortId)?.label ?? "Send data";
    return <button key={side} draggable className={`port port-${side}`} aria-label={`${side} side of ${presentation.label}: ${outputLabel}; accepts incoming arrows`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => onConnectionEnd(event, node.id, inputPortId)} onDragStart={(event) => { hideTooltip(); onConnectionStart(event, node.id, outputPortId); }} onDragEnd={onDragEnd} />;
  }

  return <div ref={nodeRef} draggable onPointerEnter={scheduleTooltip} onPointerLeave={hideTooltip} onPointerDown={hideTooltip} onDragStart={(event) => { hideTooltip(); onDragStart(event, `node:${node.id}`); }} onDragEnd={onDragEnd} style={{ left: `${node.position.left}%`, top: `${node.position.top}%` }} className={`node ${node.kind}`} aria-describedby={tooltipOpen ? tooltipId : undefined}>
    <b>{presentation.icon}</b><span>{presentation.label.toUpperCase()}<small>{presentation.detail}</small></span>
    {nodePortSides.map(directionalPort)}
    {response && <div className={`node-response ${response.tone === "failure" ? "failure" : "success"}`} role="status" aria-label={`${presentation.label} received response: ${response.label}. ${response.detail}`}>
      <strong>{response.label}</strong>
      <small>{response.detail}</small>
    </div>}
    {tooltipOpen && <aside id={tooltipId} role="tooltip" className={`node-hover-card node-hover-card--${verticalPlacement} node-hover-card--${horizontalPlacement}`}>
      <p>{tooltip.description}</p>
      <dl>
        {tooltip.stats.map((stat) => <div key={stat.label}><dt>{stat.label}</dt><dd className={stat.tone ?? ""}>{stat.value}</dd></div>)}
      </dl>
      <small>ADAPTED FROM · {tooltip.sourceSection}</small>
    </aside>}
  </div>;
}
