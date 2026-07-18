"use client";

import { useState } from "react";
import { ArchitectureCanvas } from "../components/architecture-canvas";
import { ArchitectureGraphCanvas, startTrayNodeDrag } from "../components/architecture-graph-canvas";
import { ArchitectureHeader } from "../components/architecture-header";
import { CanvasNodeTooltip } from "../components/canvas-node";
import { ComponentTray } from "../components/component-tray";
import { LevelIntroModal } from "../components/level-intro-modal";
import { MissionControlPanel } from "../components/mission-control-panel";
import { RunResultModal } from "../components/run-result-modal";
import { ArchitectureGraph, createGraphSnapshot } from "../lib/architecture/graph";
import { ArchitectureNode, NodeKind, NodePresentation } from "../lib/architecture/nodes";
import { useArchitectureGraph } from "../lib/architecture/use-architecture-graph";

type Result = {
  passed: boolean; processed: number; dropped: number; maxBacklog: number;
  averageLatencyMs: number; acceptedResponses: number; rejectedResponses: number; clientResponses: number; unansweredRequests: number; feedback: string;
};
type TrafficNodeKind = "client" | "api" | "queue" | "workers" | "db";

const components: Array<{ kind: TrafficNodeKind; icon: string; name: string; detail: string }> = [
  { kind: "client", icon: "◎", name: "Client", detail: "Starts traffic" },
  { kind: "api", icon: "◈", name: "API service", detail: "Accepts burst requests" },
  { kind: "queue", icon: "≋", name: "Queue", detail: "Buffers burst traffic" },
  { kind: "workers", icon: "⚙", name: "Worker pool", detail: "Drains queued work" },
  { kind: "db", icon: "▣", name: "Database", detail: "Persists processed jobs" },
];

const starterGraph = createGraphSnapshot([
  { id: "client-1", kind: "client", attributes: { position: { left: 5, top: 40 } } },
  { id: "api-1", kind: "api", attributes: { position: { left: 29, top: 20 } } },
  { id: "workers-1", kind: "workers", attributes: { position: { left: 53, top: 20 } } },
  { id: "db-1", kind: "db", attributes: { position: { left: 77, top: 40 } } },
], [
  { id: "client-1:right-out->api-1:left-in", source: { nodeId: "client-1", portId: "right-out" }, target: { nodeId: "api-1", portId: "left-in" } },
  { id: "api-1:right-out->workers-1:left-in", source: { nodeId: "api-1", portId: "right-out" }, target: { nodeId: "workers-1", portId: "left-in" } },
  { id: "api-1:left-out->client-1:right-in", source: { nodeId: "api-1", portId: "left-out" }, target: { nodeId: "client-1", portId: "right-in" } },
  { id: "workers-1:right-out->db-1:left-in", source: { nodeId: "workers-1", portId: "right-out" }, target: { nodeId: "db-1", portId: "left-in" } },
]);

const nodeDescriptions: Record<TrafficNodeKind, { description: string; sourceSection: string }> = {
  client: { description: "A client begins the interaction with a system by sending a request and receiving a response.", sourceSection: "HTTP · System Design Primer" },
  api: { description: "An API service receives client requests, applies application logic or routing, and sends work to the next component.", sourceSection: "Application layer · System Design Primer" },
  queue: { description: "A queue receives, holds, and delivers messages so producers and workers can operate at different rates.", sourceSection: "Asynchronism · System Design Primer" },
  workers: { description: "A worker pool processes work outside the request path and can scale its processing capacity with more workers.", sourceSection: "Asynchronism · System Design Primer" },
  db: { description: "A database is the durable data store where an application reads and writes its records.", sourceSection: "Database · System Design Primer" },
};

function isTrafficNodeKind(kind: NodeKind): kind is TrafficNodeKind {
  return kind === "client" || kind === "api" || kind === "queue" || kind === "workers" || kind === "db";
}

function trafficNodeTooltip(node: ArchitectureNode, graph: ArchitectureGraph, burst: number, workers: number, apiLimitEnabled: boolean, apiLimit: number, queueIsInFlow: boolean): CanvasNodeTooltip {
  const description = nodeDescriptions[node.kind as TrafficNodeKind];
  const liveStat = node.kind === "client"
    ? { label: "BURST", value: `${burst} jobs` }
    : node.kind === "api"
      ? { label: "INTAKE", value: apiLimitEnabled ? `${apiLimit} req/s` : "OPEN" }
      : node.kind === "queue"
        ? { label: "BUFFER", value: queueIsInFlow ? "IN FLOW" : "NOT IN FLOW", tone: queueIsInFlow ? "green" as const : "amber" as const }
        : node.kind === "workers"
          ? { label: "CAPACITY", value: `${workers} × 100 jobs/s` }
          : { label: "STORAGE", value: "PERSISTENT" };
  return {
    description: description.description,
    sourceSection: description.sourceSection,
    stats: [liveStat, { label: "CONNECTIONS", value: `${graph.incoming(node.id).length} IN · ${graph.outgoing(node.id).length} OUT` }],
  };
}

function presentationFor(node: ArchitectureNode, burst: number, workers: number, apiLimitEnabled: boolean, apiLimit: number): NodePresentation {
  const component = components.find((candidate) => candidate.kind === node.kind)!;
  return {
    icon: component.icon,
    label: component.name,
    detail: node.kind === "client"
      ? `${burst} jobs arrive`
      : node.kind === "workers"
        ? `${workers} × 100 jobs/s`
        : node.kind === "api" && apiLimitEnabled
          ? `${apiLimit} req/s intake limit`
          : component.detail,
  };
}

export default function TrafficSpike() {
  const { graph, snapshot, addNode, moveNode, connect, removeEdge, removeNode } = useArchitectureGraph(starterGraph);
  const [workers, setWorkers] = useState(1);
  const [burst, setBurst] = useState(500);
  const [apiLimitEnabled, setApiLimitEnabled] = useState(false);
  const [apiLimit, setApiLimit] = useState(100);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [runReportOpen, setRunReportOpen] = useState(false);
  const [introOpen, setIntroOpen] = useState(true);
  const [saved, setSaved] = useState(false);
  const clientRequestConnected = graph.hasKindConnection("client", "api");
  const clientResponseConnected = graph.hasKindConnection("api", "client");
  const queueIsInFlow = clientRequestConnected
    && clientResponseConnected
    && graph.hasKindConnection("api", "queue")
    && graph.hasKindConnection("queue", "workers")
    && graph.hasKindConnection("workers", "db")
    && !graph.edges.some((edge) => graph.getNode(edge.source.nodeId)?.kind === "client" && graph.getNode(edge.target.nodeId)?.kind !== "api")
    && !graph.edges.some((edge) => graph.getNode(edge.source.nodeId)?.kind === "api" && graph.getNode(edge.target.nodeId)?.kind !== "queue" && graph.getNode(edge.target.nodeId)?.kind !== "client");
  const workerBottleneckResolved = queueIsInFlow && workers >= 3;
  const apiLimitResolved = !apiLimitEnabled || apiLimit >= burst;
  const apiIntakeObjectiveResolved = apiLimitEnabled && apiLimitResolved;
  const trafficObjectives = [
    { title: "1 · Decouple the burst", done: queueIsInFlow, active: !queueIsInFlow },
    { title: "2 · Increase processing capacity", done: workerBottleneckResolved, active: queueIsInFlow && !workerBottleneckResolved },
    { title: "3 · Handle API intake capacity", done: apiIntakeObjectiveResolved, active: workerBottleneckResolved && !apiIntakeObjectiveResolved },
  ];

  async function runSimulation() {
    setRunning(true);
    setSaved(false);
    setResult(null);
    await new Promise((resolve) => setTimeout(resolve, 650));
    const response = await fetch("/api/simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workers, queue: queueIsInFlow, burst, apiLimit: apiLimitEnabled ? apiLimit : undefined, clientConnected: clientRequestConnected && clientResponseConnected }),
    });
    setResult(await response.json() as Result);
    setRunReportOpen(true);
    setRunning(false);
  }

  async function saveSolution() {
    await fetch("/api/solutions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ level: "traffic-spike", graph: snapshot, workers, burst, apiLimit: apiLimitEnabled ? apiLimit : null, result }),
    });
    setSaved(true);
  }

  return <main>
    <header className="topbar">
      <a className="brand" href="/">FLOW<span>BREAK</span></a>
      <div className="level-pill"><i /> LEVEL 03 · TRAFFIC SPIKE</div>
      <a className="ghost" href="/">LEVEL SELECT</a>
    </header>

    <section className="workspace">
      <ComponentTray title="Build a path" description="Work through the checkpoints: buffer the burst, clear worker capacity, then test API intake capacity. Every tray drop adds an unconnected node. Drag from any node-side port to route data; click a flow line to disconnect it.">
        <div className="component-list">
          {components.map((component) => <div key={component.kind} className="component draggable-component" draggable onDragStart={(event) => startTrayNodeDrag(event, component.kind)}>
            <b>{component.icon}</b><span>{component.name}<small>Drag to add an unconnected node</small></span>
          </div>)}
        </div>
        <div className="control-block">
          <label>WORKER INSTANCES <strong>{workers}</strong></label>
          <input aria-label="Worker instances" type="range" min="1" max="6" value={workers} onChange={(event) => setWorkers(Number(event.target.value))} />
          {apiLimitEnabled && <><label>API INTAKE LIMIT <strong>{apiLimit} req/s</strong></label><input aria-label="API intake limit" type="range" min="100" max="1000" step="100" value={apiLimit} onChange={(event) => setApiLimit(Number(event.target.value))} /></>}
          <label>BURST SIZE <strong>{burst} jobs</strong></label>
          <input aria-label="Burst size" type="range" min="200" max="1000" step="100" value={burst} onChange={(event) => setBurst(Number(event.target.value))} />
        </div>
      </ComponentTray>

      <ArchitectureCanvas header={<ArchitectureHeader title="Buffer the burst before workers break" runLabel="RUN TRAFFIC SPIKE" onRun={runSimulation} onShowLastRun={result ? () => setRunReportOpen(true) : undefined} running={running} passed={result?.passed ?? null} />}>
        <ArchitectureGraphCanvas
          graph={graph}
          markerPrefix="traffic"
          note={!clientResponseConnected ? "The API needs a return edge to the Client." : !queueIsInFlow ? "The burst still reaches a bottleneck. Rework the flow." : workers < 3 ? "The next bottleneck is processing capacity." : apiLimitEnabled && !apiLimitResolved ? "A new intake constraint is active." : "The API queues the burst while workers process it safely."}
          nodePresentation={(node) => presentationFor(node, burst, workers, apiLimitEnabled, apiLimit)}
          nodeTooltip={(node, currentGraph) => trafficNodeTooltip(node, currentGraph, burst, workers, apiLimitEnabled, apiLimit, queueIsInFlow)}
          nodeResponse={(node) => node.kind === "client" && result ? result.unansweredRequests ? { label: "NO RESPONSE RECEIVED", detail: `${result.unansweredRequests} requests are unanswered`, tone: "failure" } : result.rejectedResponses ? { label: "RESPONSES RECEIVED", detail: `${result.acceptedResponses} accepted · ${result.rejectedResponses} rejected`, tone: "failure" } : { label: "202 ACCEPTED RECEIVED", detail: `${result.acceptedResponses} requests acknowledged` } : undefined}
          onAddNode={(kind, position) => { if (isTrafficNodeKind(kind)) addNode(kind, position); }}
          onMoveNode={moveNode}
          onConnect={connect}
          onRemoveEdge={removeEdge}
          onRemoveNode={removeNode}
        />
      </ArchitectureCanvas>

      <MissionControlPanel title="How do you protect workers from a burst?" description="A 500-job burst arrives in one second. First decouple the API from workers, then resolve each new bottleneck as it appears." objectives={trafficObjectives} objectivesLabel="Traffic Spike objectives">
        <div className="goal"><span>SUCCESS CRITERIA</span><b>Build a safe route, then clear every active bottleneck.</b></div>
        {workerBottleneckResolved && !apiLimitEnabled && <button className="advance" onClick={() => setApiLimitEnabled(true)}>ADD API REQUEST LIMIT</button>}
        <div className="metrics traffic-metrics">
          <Metric label="MAX BACKLOG" value={result ? `${result.maxBacklog} jobs` : "—"} />
          <Metric label="DROPPED" value={result ? `${result.dropped} jobs` : "—"} tone={result?.dropped ? "red" : result ? "green" : ""} />
          <Metric label="AVG LATENCY" value={result ? `${result.averageLatencyMs} ms` : "—"} />
        </div>
      </MissionControlPanel>
    </section>
    <footer><span>LIVE TIMELINE</span><p>{running ? "00:01 — Burst entering API…" : result ? result.unansweredRequests ? `00:01 — Client received no response for ${result.unansweredRequests} requests` : `00:01 — Client received ${result.acceptedResponses} accepted${result.rejectedResponses ? ` · ${result.rejectedResponses} rejected` : ""} · 00:10 — ${result.processed} jobs processed` : "00:00 — Configure a design, then run the simulation."}</p><em>DETERMINISTIC SIMULATION · NO LLM REQUIRED</em></footer>
    {result && runReportOpen && <RunResultModal
      passed={result.passed}
      eyebrow="TRAFFIC SPIKE REPORT"
      successTitle="Burst resolved"
      failureTitle="Bottleneck detected"
      summary={result.feedback}
      highlightLabel={result.passed ? "SYSTEM STATUS" : "NEXT FIX"}
      highlightValue={result.passed ? "Every request was accepted and protected from the burst." : result.feedback}
      metrics={[
        { label: "PROCESSED", value: `${result.processed} jobs` },
        { label: "DROPPED", value: `${result.dropped} jobs`, tone: result.dropped ? "red" : "green" },
        { label: "CLIENT RESPONSES", value: result.unansweredRequests ? "MISSING" : `${result.acceptedResponses} ACCEPTED${result.rejectedResponses ? ` · ${result.rejectedResponses} REJECTED` : ""}`, tone: result.unansweredRequests || result.rejectedResponses ? "red" : "green" },
        { label: "MAX BACKLOG", value: `${result.maxBacklog} jobs` },
        { label: "AVG LATENCY", value: `${result.averageLatencyMs} ms` },
      ]}
      actions={<><button className="run-result-action" onClick={saveSolution}>{saved ? "SAVED ✓" : "SAVE THIS SOLUTION"}</button>{result.passed ? <a className="run-result-action secondary" href="/">RETURN TO LEVEL SELECT →</a> : <button className="run-result-action secondary" onClick={() => setRunReportOpen(false)}>KEEP BUILDING</button>}</>}
      onClose={() => setRunReportOpen(false)}
    />}
    {introOpen && <LevelIntroModal level="LEVEL 03" title="Absorb a traffic spike" problem="A sudden burst can reach workers faster than they can process jobs, causing dropped work or a blocked request path." approach="An API quickly hands work to a queue, which buffers the burst while workers drain jobs at a safe rate." sourceHref="https://github.com/donnemartin/system-design-primer#asynchronism" onClose={() => setIntroOpen(false)} />}
  </main>;
}

function Metric({ label, value, tone = "" }: { label: string; value: string; tone?: string }) {
  return <div className="metric"><span>{label}</span><b className={tone}>{value}</b></div>;
}
