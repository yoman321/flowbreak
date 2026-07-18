"use client";

import { DragEvent, useLayoutEffect, useRef, useState } from "react";

type Result = {
  passed: boolean; processed: number; dropped: number; maxBacklog: number;
  averageLatencyMs: number; feedback: string;
};

type NodeType = "client" | "api" | "queue" | "workers" | "db";
type SandboxNode = { id: string; type: NodeType };
type Connection = { source: string; target: string };
type Position = { left: number; top: number };
type NodeRect = { x: number; y: number; width: number; height: number };

const nodeTypes: NodeType[] = ["client", "api", "queue", "workers", "db"];

const components = [
  { type: "client" as const, icon: "◎", name: "Client", detail: "Starts traffic" },
  { type: "api" as const, icon: "◈", name: "API service", detail: "Accepts burst requests" },
  { type: "queue" as const, icon: "≋", name: "Queue", detail: "Buffers burst traffic" },
  { type: "workers" as const, icon: "⚙", name: "Worker pool", detail: "Drains queued work" },
  { type: "db" as const, icon: "▣", name: "Database", detail: "Persists processed jobs" },
];

const starterNodes: SandboxNode[] = [
  { id: "client-1", type: "client" },
  { id: "api-1", type: "api" },
  { id: "workers-1", type: "workers" },
  { id: "db-1", type: "db" },
];

const starterConnections: Connection[] = [
  { source: "client-1", target: "api-1" },
  { source: "api-1", target: "workers-1" },
  { source: "workers-1", target: "db-1" },
];

const starterPositions: Record<string, Position> = {
  "client-1": { left: 5, top: 40 }, "api-1": { left: 29, top: 20 },
  "workers-1": { left: 53, top: 20 }, "db-1": { left: 77, top: 40 },
};

function isNodeType(value: string): value is NodeType {
  return nodeTypes.includes(value as NodeType);
}

export default function Home() {
  const [nodes, setNodes] = useState<SandboxNode[]>(starterNodes);
  const [connections, setConnections] = useState<Connection[]>(starterConnections);
  const [workers, setWorkers] = useState(1);
  const [burst, setBurst] = useState(500);
  const [apiLimitEnabled, setApiLimitEnabled] = useState(false);
  const [apiLimit, setApiLimit] = useState(100);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [saved, setSaved] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [connectionPreview, setConnectionPreview] = useState<{ source: string; x: number; y: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Record<string, HTMLDivElement | undefined>>({});
  const [nodeRects, setNodeRects] = useState<Record<string, NodeRect>>({});
  const [positions, setPositions] = useState<Record<string, Position>>(starterPositions);
  const nextNodeNumber = useRef<Record<NodeType, number>>({ client: 2, api: 2, queue: 1, workers: 2, db: 2 });
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const hasTypeConnection = (sourceType: NodeType, targetType: NodeType) => connections.some(({ source, target }) => nodesById.get(source)?.type === sourceType && nodesById.get(target)?.type === targetType);
  const queueIsInFlow = hasTypeConnection("client", "api")
    && hasTypeConnection("api", "queue")
    && hasTypeConnection("queue", "workers")
    && hasTypeConnection("workers", "db")
    && !connections.some(({ source, target }) => nodesById.get(source)?.type === "client" && nodesById.get(target)?.type !== "api")
    && !connections.some(({ source, target }) => nodesById.get(source)?.type === "api" && nodesById.get(target)?.type !== "queue");
  const workerBottleneckResolved = queueIsInFlow && workers >= 3;
  const apiLimitResolved = !apiLimitEnabled || apiLimit >= burst;
  const canPass = workerBottleneckResolved && apiLimitResolved;
  const previewSource = connectionPreview ? nodeRects[connectionPreview.source] : undefined;

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const updateNodeRects = () => {
      const canvasRect = canvas.getBoundingClientRect();
      const nextRects: Record<string, NodeRect> = {};
      Object.keys(nodeRefs.current).forEach((id) => {
        const node = nodeRefs.current[id];
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
    setConnectionPreview((current) => {
      if (!current) return current;
      return { ...current, x, y };
    });
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
    const left = (leftPx / canvas.clientWidth) * 100;
    const top = (topPx / canvas.clientHeight) * 100;
    if (item.startsWith("tray:")) {
      if (!isNodeType(nodeId)) {
        finishDrag();
        return;
      }
      const id = `${nodeId}-${nextNodeNumber.current[nodeId]++}`;
      setNodes((current) => [...current, { id, type: nodeId }]);
      setPositions((current) => ({ ...current, [id]: { left, top } }));
    }
    if (item.startsWith("node:") && nodesById.has(nodeId)) setPositions((current) => ({ ...current, [nodeId]: { left, top } }));
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

  async function runSimulation() {
    setRunning(true); setSaved(false);
    await new Promise((resolve) => setTimeout(resolve, 650));
    const response = await fetch("/api/simulate", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workers, queue: queueIsInFlow, burst, apiLimit: apiLimitEnabled ? apiLimit : undefined }),
    });
    setResult(await response.json()); setRunning(false);
  }

  async function saveSolution() {
    await fetch("/api/solutions", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ level: "traffic-spike", nodes, connections, workers, burst, apiLimit: apiLimitEnabled ? apiLimit : null, result }),
    });
    setSaved(true);
  }

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="/">FLOW<span>BREAK</span></a>
        <div className="level-pill"><i /> LEVEL 01 · TRAFFIC SPIKE</div>
        <a className="ghost" href="/">LEVEL SELECT</a>
      </header>

      <section className="workspace">
        <aside className="tray">
          <p className="eyebrow">COMPONENT KIT</p>
          <h2>Build a path</h2>
          <p className="muted">Work through the checkpoints: buffer the burst, clear worker capacity, then test API intake capacity. Every tray drop adds an unconnected node. Drag from an output dot to an input dot to route data; click a flow line to disconnect it.</p>
          <div className="component-list">
            {components.map((component) => {
              return <div key={component.type} className="component draggable-component" draggable onDragStart={(event) => dragStart(event, `tray:${component.type}`)} onDragEnd={finishDrag}>
                <b>{component.icon}</b><span>{component.name}<small>Drag to add an unconnected node</small></span>
              </div>;
            })}
          </div>
          <div className="control-block">
            <label>WORKER INSTANCES <strong>{workers}</strong></label>
            <input aria-label="Worker instances" type="range" min="1" max="6" value={workers} onChange={(e) => setWorkers(Number(e.target.value))} />
            {apiLimitEnabled && <><label>API INTAKE LIMIT <strong>{apiLimit} req/s</strong></label>
            <input aria-label="API intake limit" type="range" min="100" max="1000" step="100" value={apiLimit} onChange={(e) => setApiLimit(Number(e.target.value))} /></>}
            <label>BURST SIZE <strong>{burst} jobs</strong></label>
            <input aria-label="Burst size" type="range" min="200" max="1000" step="100" value={burst} onChange={(e) => setBurst(Number(e.target.value))} />
          </div>
        </aside>

        <section className="canvas-panel">
          <div className="canvas-head"><div><p className="eyebrow">ARCHITECTURE</p><h1>Buffer the burst before workers break</h1></div><span className={canPass ? "ready" : "warning"}>{canPass ? "READY TO TEST" : apiLimitEnabled && workerBottleneckResolved ? "RAISE API LIMIT" : "NEEDS PROTECTION"}</span></div>
          <div ref={canvasRef} className={`canvas ${dragging ? "drop-target" : ""}`} onDragOver={dragOverCanvas} onDrop={dropOnCanvas}>
            <svg className="connections" viewBox={`0 0 ${canvasRef.current?.clientWidth ?? 0} ${canvasRef.current?.clientHeight ?? 0}`} preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <marker id="flow-arrow" markerUnits="userSpaceOnUse" markerWidth="8" markerHeight="8" refX="8" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 Z" /></marker>
                <marker id="flow-arrow-preview" markerUnits="userSpaceOnUse" markerWidth="8" markerHeight="8" refX="8" refY="4" orient="auto"><path className="preview-arrowhead" d="M0,0 L8,4 L0,8 Z" /></marker>
              </defs>
              {connectionPreview && previewSource && <path className="connection-preview" markerEnd="url(#flow-arrow-preview)" d={`M ${previewSource.x + previewSource.width} ${previewSource.y + previewSource.height / 2} L ${connectionPreview.x} ${connectionPreview.y}`} />}
              {connections.map((connection) => {
                const source = nodeRects[connection.source];
                const target = nodeRects[connection.target];
                if (!source || !target) return null;
                const path = `M ${source.x + source.width} ${source.y + source.height / 2} L ${target.x - 2} ${target.y + target.height / 2}`;
                return <g key={`${connection.source}:${connection.target}`}>
                  <path className="connection-hit" d={path} onClick={() => removeConnection(connection.source, connection.target)} />
                  <path className="connection" markerEnd="url(#flow-arrow)" d={path} />
                </g>;
              })}
            </svg>
            {nodes.map((node) => {
              const component = node.type === "client"
                ? { icon: "◎", name: "CLIENT", detail: `${burst} jobs arrive` }
                : components.find((item) => item.type === node.type)!;
              const detail = node.type === "workers" ? `${workers} × 100 jobs/s` : node.type === "api" && apiLimitEnabled ? `${apiLimit} req/s intake limit` : component.detail;
              return <CanvasNode key={node.id} id={node.id} nodeType={node.type} nodeRef={(element) => { nodeRefs.current[node.id] = element ?? undefined; }} icon={component.icon} label={component.name.toUpperCase()} detail={detail} position={positions[node.id]} onDragStart={dragStart} onDragEnd={finishDrag} onConnectionStart={startConnection} onConnectionEnd={completeConnection} />;
            })}
            <div className="canvas-note">{!queueIsInFlow ? "The burst still reaches a bottleneck. Rework the flow." : workers < 3 ? "The next bottleneck is processing capacity." : apiLimitEnabled && !apiLimitResolved ? "A new intake constraint is active." : "The API queues the burst while workers process it safely."}</div>
          </div>
        </section>

        <aside className="mission">
          <p className="eyebrow">MISSION CONTROL</p>
          <h2>How do you protect workers from a burst?</h2>
          <p className="muted">A 500-job burst arrives in one second. First decouple the API from workers, then resolve each new bottleneck as it appears.</p>
          <div className="goal"><span>SUCCESS CRITERIA</span><b>Build a safe route, then clear every active bottleneck.</b></div>
          <div className="checkpoints" aria-label="Traffic Spike progress">
            <Checkpoint done={queueIsInFlow} title="1 · Decouple the burst" />
            {queueIsInFlow && <Checkpoint done={workerBottleneckResolved} title="2 · Increase processing capacity" />}
            {workerBottleneckResolved && <Checkpoint done={apiLimitEnabled && apiLimitResolved} title="3 · Handle API intake capacity" />}
          </div>
          {workerBottleneckResolved && !apiLimitEnabled && <button className="advance" onClick={() => setApiLimitEnabled(true)}>ADD API REQUEST LIMIT</button>}
          <div className="metrics">
            <Metric label="STATUS" value={result ? (result.passed ? "PASS" : "FAIL") : "STANDBY"} tone={result?.passed ? "green" : result ? "red" : ""} />
            <Metric label="MAX BACKLOG" value={result ? `${result.maxBacklog} jobs` : "—"} />
            <Metric label="DROPPED" value={result ? `${result.dropped} jobs` : "—"} tone={result?.dropped ? "red" : result ? "green" : ""} />
            <Metric label="AVG LATENCY" value={result ? `${result.averageLatencyMs} ms` : "—"} />
          </div>
          {result && <div className={`feedback ${result.passed ? "pass" : "fail"}`}><b>{result.passed ? "SYSTEM RESOLVED" : "BOTTLENECK DETECTED"}</b><p>{result.feedback}</p><button onClick={saveSolution}>{saved ? "SAVED ✓" : "SAVE THIS SOLUTION"}</button>{result.passed && <a className="completion-prompt" href="/"><span>LEVEL 01 COMPLETE</span><b>All available levels are complete.</b><em>RETURN TO LEVEL SELECT →</em></a>}</div>}
          <button className="run mission-run" onClick={runSimulation} disabled={running}>{running ? "SIMULATING BURST…" : "▶ RUN TRAFFIC SPIKE"}</button>
        </aside>
      </section>
      <footer><span>LIVE TIMELINE</span><p>{running ? "00:01 — Burst entering API…" : result ? `00:10 — ${result.processed} jobs processed · ${result.dropped} dropped` : "00:00 — Configure a design, then run the simulation."}</p><em>DETERMINISTIC SIMULATION · NO LLM REQUIRED</em></footer>
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

function Checkpoint({ done, title }: { done: boolean; title: string }) {
  return <div className={`checkpoint ${done ? "done" : "pending"}`}>
    <span className="checkpoint-mark" aria-hidden="true">{done ? "✓" : "○"}</span>
    <b>{title}</b>
  </div>;
}
