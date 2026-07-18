"use client";

import { DragEvent, useLayoutEffect, useRef, useState } from "react";

type NodeType = "client" | "api" | "workers" | "db";
type SandboxNode = { id: string; type: NodeType };
type Connection = { source: string; target: string };
type Position = { left: number; top: number };
type NodeRect = { x: number; y: number; width: number; height: number };
type TutorialStep = { title: string; instruction: string; complete: boolean; target?: NodeType };
type NodeExplainer = { question: string; description: string; placement: string; sourceSection: string; sourceHref: string };

const nodeTypes: NodeType[] = ["client", "api", "workers", "db"];

const components = [
  { type: "client" as const, icon: "◎", name: "Client", detail: "Starts traffic" },
  { type: "api" as const, icon: "◈", name: "API request", detail: "Accepts requests" },
  { type: "workers" as const, icon: "⚙", name: "Worker pool", detail: "Processes work" },
  { type: "db" as const, icon: "▣", name: "Database", detail: "Stores data" },
];

const nodeExplainers: Record<NodeType, NodeExplainer> = {
  client: {
    question: "What is a Client?",
    description: "A client is what starts an interaction with a system: for example, a browser, mobile app, or another service. It sends a request and receives a response.",
    placement: "In this flow, the Client is where the request begins.",
    sourceSection: "HTTP · System Design Primer",
    sourceHref: "https://github.com/donnemartin/system-design-primer#hypertext-transfer-protocol-http",
  },
  api: {
    question: "What is an API request?",
    description: "In this board, the API request node represents the API-facing application service. It receives the client's HTTP request, applies application logic or routing, then responds or passes work onward.",
    placement: "In this flow, it is the system's first stop after the Client.",
    sourceSection: "Application layer · System Design Primer",
    sourceHref: "https://github.com/donnemartin/system-design-primer#application-layer",
  },
  workers: {
    question: "What is a Worker pool?",
    description: "A worker pool is a group of application workers that process work. In asynchronous systems, workers can take jobs and finish them in the background instead of making the client wait.",
    placement: "A Worker pool is optional in this first request. Add one later when work should not stay inline with the API request.",
    sourceSection: "Asynchronism · System Design Primer",
    sourceHref: "https://github.com/donnemartin/system-design-primer#asynchronism",
  },
  db: {
    question: "What is a Database?",
    description: "A database is the system's durable data store. For example, a relational database organizes data into tables and supports reliable transactions.",
    placement: "In this flow, the Database stores the result of the work.",
    sourceSection: "Database · System Design Primer",
    sourceHref: "https://github.com/donnemartin/system-design-primer#database",
  },
};

function isNodeType(value: string): value is NodeType {
  return nodeTypes.includes(value as NodeType);
}

function hasFirstRequestPath(nodes: SandboxNode[], connections: Connection[]) {
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const targetsBySource = new Map<string, string[]>();
  connections.forEach(({ source, target }) => {
    targetsBySource.set(source, [...(targetsBySource.get(source) ?? []), target]);
  });

  return nodes.some((client) => client.type === "client" && (targetsBySource.get(client.id) ?? []).some((apiId) => nodesById.get(apiId)?.type === "api" && (targetsBySource.get(apiId) ?? []).some((databaseId) => nodesById.get(databaseId)?.type === "db")));
}

export default function Tutorial() {
  const [nodes, setNodes] = useState<SandboxNode[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [dragging, setDragging] = useState(false);
  const [connectionPreview, setConnectionPreview] = useState<{ source: string; x: number; y: number } | null>(null);
  const [introducedNodeType, setIntroducedNodeType] = useState<NodeType | null>(null);
  const [runReportOpen, setRunReportOpen] = useState(false);
  const [positions, setPositions] = useState<Record<string, Position>>({});
  const [nodeRects, setNodeRects] = useState<Record<string, NodeRect>>({});
  const canvasRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Record<string, HTMLDivElement | undefined>>({});
  const nextNodeNumber = useRef<Record<NodeType, number>>({ client: 1, api: 1, workers: 1, db: 1 });
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const previewSource = connectionPreview ? nodeRects[connectionPreview.source] : undefined;
  const hasNode = (type: NodeType) => nodes.some((node) => node.type === type);
  const hasTypeConnection = (sourceType: NodeType, targetType: NodeType) => connections.some(({ source, target }) => nodesById.get(source)?.type === sourceType && nodesById.get(target)?.type === targetType);
  const guideSteps: TutorialStep[] = [
    { title: "Place a Client", instruction: "Drag Client from the component kit onto the canvas. It is where a request begins.", complete: hasNode("client"), target: "client" },
    { title: "Place an API request", instruction: "Drag API request onto the canvas. It is the first system component to receive the request.", complete: hasNode("api"), target: "api" },
    { title: "Route Client to API request", instruction: "Drag the Client's output dot to the API request's input dot. The arrow shows where request data flows.", complete: hasTypeConnection("client", "api") },
    { title: "Place a Database", instruction: "Drag Database onto the canvas. It is where the API request will read or store application data.", complete: hasNode("db"), target: "db" },
    { title: "Connect API request to Database", instruction: "Connect the API request output to the Database input. Your first request flow is now complete.", complete: hasTypeConnection("api", "db") },
  ];
  const activeGuideStep = guideSteps.find((step) => !step.complete);
  const completedGuideSteps = guideSteps.filter((step) => step.complete).length;
  const firstRequestComplete = hasFirstRequestPath(nodes, connections);

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
  }, [nodes, positions]);

  function dragStart(event: DragEvent<HTMLElement>, item: string) {
    event.dataTransfer.setData("sandbox-item", item);
    event.dataTransfer.effectAllowed = "move";
    setDragging(true);
  }

  function finishDrag() {
    setDragging(false);
    setConnectionPreview(null);
  }

  function dragOverCanvas(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    setConnectionPreview((current) => current ? { ...current, x, y } : current);
  }

  function dropOnCanvas(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (event.dataTransfer.getData("sandbox-connection")) {
      finishDrag();
      return;
    }

    const item = event.dataTransfer.getData("sandbox-item");
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const nodeId = item.slice(item.indexOf(":") + 1);
    const node = nodeRefs.current[nodeId] ?? Object.values(nodeRefs.current).find(Boolean);
    const nodeWidth = node?.offsetWidth ?? 126;
    const nodeHeight = node?.offsetHeight ?? 48;
    const leftPx = Math.min(Math.max(0, canvas.clientWidth - nodeWidth), Math.max(0, event.clientX - rect.left - canvas.clientLeft - nodeWidth / 2));
    const topPx = Math.min(Math.max(0, canvas.clientHeight - nodeHeight), Math.max(0, event.clientY - rect.top - canvas.clientTop - nodeHeight / 2));
    const position = { left: (leftPx / canvas.clientWidth) * 100, top: (topPx / canvas.clientHeight) * 100 };

    if (item.startsWith("tray:")) {
      if (!isNodeType(nodeId)) {
        finishDrag();
        return;
      }
      const id = `${nodeId}-${nextNodeNumber.current[nodeId]++}`;
      setNodes((current) => [...current, { id, type: nodeId }]);
      setPositions((current) => ({ ...current, [id]: position }));
      setIntroducedNodeType(nodeId);
    }
    if (item.startsWith("node:") && nodesById.has(nodeId)) setPositions((current) => ({ ...current, [nodeId]: position }));
    finishDrag();
  }

  function startConnection(event: DragEvent<HTMLButtonElement>, source: string) {
    event.stopPropagation();
    event.dataTransfer.setData("sandbox-connection", source);
    event.dataTransfer.effectAllowed = "link";
    setDragging(true);
    setConnectionPreview({ source, x: 0, y: 0 });
  }

  function completeConnection(event: DragEvent<HTMLButtonElement>, target: string) {
    event.preventDefault();
    event.stopPropagation();
    const source = event.dataTransfer.getData("sandbox-connection");
    if (!source || source === target || !nodesById.has(source) || !nodesById.has(target)) {
      finishDrag();
      return;
    }
    setConnections((current) => current.some((connection) => connection.source === source && connection.target === target)
      ? current
      : [...current, { source, target }]);
    finishDrag();
  }

  function removeConnection(source: string, target: string) {
    setConnections((current) => current.filter((connection) => connection.source !== source || connection.target !== target));
  }

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="/">FLOW<span>BREAK</span></a>
        <div className="level-pill"><i /> LEVEL 00 · TUTORIAL</div>
        <a className="ghost" href="/">LEVEL SELECT</a>
      </header>

      <section className="workspace">
        <aside className="tray">
          <p className="eyebrow">COMPONENT KIT</p>
          <h2>Build a flow</h2>
          <p className="muted">Follow the guide to build a first request flow, then keep experimenting on this practice board.</p>
          <div className="component-list">
            {components.map((component) => (
              <div key={component.type} className={`component draggable-component ${activeGuideStep?.target === component.type ? "guide-target" : ""}`} draggable onDragStart={(event) => dragStart(event, `tray:${component.type}`)} onDragEnd={finishDrag}>
                <b>{component.icon}</b><span>{component.name}<small>{component.detail} · drag to add</small></span>
              </div>
            ))}
          </div>
        </aside>

        <section className="canvas-panel">
          <div className="canvas-head"><div><p className="eyebrow">ARCHITECTURE</p><h1>Build your flow</h1></div><button className="run canvas-run" onClick={() => setRunReportOpen(true)}>▶ RUN FLOW</button></div>
          <div ref={canvasRef} className={`canvas ${dragging ? "drop-target" : ""}`} onDragOver={dragOverCanvas} onDrop={dropOnCanvas}>
            <svg className="connections" viewBox={`0 0 ${canvasRef.current?.clientWidth ?? 0} ${canvasRef.current?.clientHeight ?? 0}`} preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <marker id="tutorial-flow-arrow" markerUnits="userSpaceOnUse" markerWidth="8" markerHeight="8" refX="8" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" /></marker>
                <marker id="tutorial-flow-arrow-preview" markerUnits="userSpaceOnUse" markerWidth="8" markerHeight="8" refX="8" refY="4" orient="auto"><path className="preview-arrowhead" d="M0,0 L8,4 L0,8 Z" /></marker>
              </defs>
              {connectionPreview && previewSource && <path className="connection-preview" markerEnd="url(#tutorial-flow-arrow-preview)" d={`M ${previewSource.x + previewSource.width} ${previewSource.y + previewSource.height / 2} L ${connectionPreview.x} ${connectionPreview.y}`} />}
              {connections.map((connection) => {
                const source = nodeRects[connection.source];
                const target = nodeRects[connection.target];
                if (!source || !target) return null;
                const path = `M ${source.x + source.width} ${source.y + source.height / 2} L ${target.x - 2} ${target.y + target.height / 2}`;
                return <g key={`${connection.source}:${connection.target}`}>
                  <path className="connection-hit" d={path} onClick={() => removeConnection(connection.source, connection.target)} />
                  <path className="connection" markerEnd="url(#tutorial-flow-arrow)" d={path} />
                </g>;
              })}
            </svg>
            {nodes.map((node) => {
              const component = components.find((item) => item.type === node.type)!;
              return <CanvasNode key={node.id} id={node.id} nodeType={node.type} nodeRef={(element) => { nodeRefs.current[node.id] = element ?? undefined; }} icon={component.icon} label={component.name.toUpperCase()} detail={component.detail} position={positions[node.id] ?? { left: 0, top: 0 }} onDragStart={dragStart} onDragEnd={finishDrag} onConnectionStart={startConnection} onConnectionEnd={completeConnection} />;
            })}
            <div className="canvas-note">Drag an output dot to an input dot to show the direction of data.</div>
          </div>
        </section>

        <aside className="mission tutorial-mission">
          <p className="eyebrow">MISSION CONTROL</p>
          <h2>Build your first request</h2>
          <p className="muted">Use direct manipulation: drag from the kit to add, drag a node to move it, drag an output dot to an input dot to connect, and click a flow line to remove it.</p>
          <div className="goal"><span>FIRST REQUEST PATH</span><b>Client → API request → Database</b></div>
          <div className="tutorial-guide" aria-live="polite">
            <span>{activeGuideStep ? `GUIDED STEP ${completedGuideSteps + 1} OF ${guideSteps.length}` : "FIRST REQUEST COMPLETE"}</span>
            <b>{activeGuideStep?.title ?? "You built a complete request path."}</b>
            <p>{activeGuideStep?.instruction ?? "Keep adding, moving, and reconnecting components to explore different flows."}</p>
          </div>
          <div className="checkpoints tutorial-checkpoints" aria-label="Tutorial progress">
            {guideSteps.map((step, index) => <TutorialCheckpoint key={step.title} done={step.complete} active={activeGuideStep === step} title={`${index + 1} · ${step.title}`} />)}
          </div>
        </aside>
      </section>
      <footer><span>LIVE TIMELINE</span><p>{nodes.length ? `${nodes.length} components placed · ${connections.length} flows routed` : "00:00 — The practice board is ready."}</p><em>TUTORIAL · NO SIMULATION ACTIVE</em></footer>
      {introducedNodeType && <NodeExplainerModal type={introducedNodeType} onClose={() => setIntroducedNodeType(null)} />}
      {runReportOpen && <RunReportModal passed={firstRequestComplete} nodes={nodes.length} flows={connections.length} nextStep={activeGuideStep?.title} onClose={() => setRunReportOpen(false)} />}
    </main>
  );
}

function CanvasNode({ id, nodeType, nodeRef, icon, label, detail, position, onDragStart, onDragEnd, onConnectionStart, onConnectionEnd }: {
  id: string; nodeType: NodeType; nodeRef: (element: HTMLDivElement | null) => void; icon: string; label: string; detail: string; position: Position;
  onDragStart: (event: DragEvent<HTMLElement>, item: string) => void; onDragEnd: () => void;
  onConnectionStart: (event: DragEvent<HTMLButtonElement>, source: string) => void;
  onConnectionEnd: (event: DragEvent<HTMLButtonElement>, target: string) => void;
}) {
  return <div ref={nodeRef} draggable onDragStart={(event) => onDragStart(event, `node:${id}`)} onDragEnd={onDragEnd} style={{ left: `${position.left}%`, top: `${position.top}%` }} className={`node ${nodeType}`}>
    <button className="port input-port" aria-label={`Connect data into ${label}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => onConnectionEnd(event, id)} />
    <b>{icon}</b><span>{label}<small>{detail}</small></span>
    <button draggable className="port output-port" aria-label={`Connect data from ${label}`} onDragStart={(event) => onConnectionStart(event, id)} onDragEnd={onDragEnd} />
  </div>;
}

function Metric({ label, value, tone = "" }: { label: string; value: string; tone?: string }) {
  return <div className="metric"><span>{label}</span><b className={tone}>{value}</b></div>;
}

function TutorialCheckpoint({ done, active, title }: { done: boolean; active: boolean; title: string }) {
  return <div className={`checkpoint ${done ? "done" : "pending"} ${active ? "active" : ""}`}>
    <span className="checkpoint-mark" aria-hidden="true">{done ? "✓" : active ? "→" : "○"}</span>
    <b>{title}</b>
  </div>;
}

function NodeExplainerModal({ type, onClose }: { type: NodeType; onClose: () => void }) {
  const explainer = nodeExplainers[type];
  return <div className="tutorial-modal" role="presentation" onClick={onClose}>
    <section className="tutorial-modal-card" role="dialog" aria-modal="true" aria-labelledby="node-explainer-title" onClick={(event) => event.stopPropagation()}>
      <button className="tutorial-modal-close" aria-label="Close explanation" onClick={onClose}>×</button>
      <p className="eyebrow">COMPONENT INTRODUCTION</p>
      <h2 id="node-explainer-title">{explainer.question}</h2>
      <p>{explainer.description}</p>
      <div className="tutorial-modal-placement"><span>IN THIS TUTORIAL</span><b>{explainer.placement}</b></div>
      <a className="tutorial-modal-source" href={explainer.sourceHref} target="_blank" rel="noreferrer">SOURCE · {explainer.sourceSection} ↗</a>
      <button className="tutorial-modal-continue" onClick={onClose}>CONTINUE BUILDING</button>
    </section>
  </div>;
}

function RunReportModal({ passed, nodes, flows, nextStep, onClose }: { passed: boolean; nodes: number; flows: number; nextStep?: string; onClose: () => void }) {
  const nextAction = nextStep ?? "Connect one Client through one API request to a Database.";
  return <div className="tutorial-modal" role="presentation" onClick={onClose}>
    <section className={`tutorial-modal-card tutorial-report ${passed ? "pass" : "fail"}`} role="dialog" aria-modal="true" aria-labelledby="run-report-title" onClick={(event) => event.stopPropagation()}>
      <button className="tutorial-modal-close" aria-label="Close run report" onClick={onClose}>×</button>
      <p className="eyebrow">RUN REPORT</p>
      <h2 id="run-report-title">{passed ? "Flow is correct" : "Flow needs work"}</h2>
      <p>{passed ? "Your diagram contains an uninterrupted Client → API request → Database path. The request can travel through the system in the intended order." : "Your diagram does not yet contain one uninterrupted first-request path."}</p>
      <div className="tutorial-report-status"><span>{passed ? "VALIDATION PASSED" : "NEXT ACTION"}</span><b>{passed ? "Request path is complete." : nextAction}</b></div>
      <div className="metrics tutorial-report-metrics" aria-label="Flow report summary">
        <Metric label="NODES" value={String(nodes)} />
        <Metric label="FLOWS" value={String(flows)} />
        <Metric label="PATH" value={passed ? "VALID" : "INCOMPLETE"} tone={passed ? "green" : "red"} />
        <Metric label="MODE" value="PRACTICE" />
      </div>
      {passed
        ? <a className="tutorial-modal-continue" href="/traffic-spike">CONTINUE TO LEVEL 01 · TRAFFIC SPIKE →</a>
        : <button className="tutorial-modal-continue" onClick={onClose}>KEEP BUILDING</button>}
    </section>
  </div>;
}
