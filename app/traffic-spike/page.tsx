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
import {
  API_BURST_CAPACITY,
  QUEUE_CAPACITY,
  TRAFFIC_SPIKE_BURST,
  TrafficSpikeResult,
  evaluateTrafficSpike,
  getTrafficSpikeTopology,
} from "../lib/simulations/traffic-spike";
import { useArchitectureGraph } from "../lib/architecture/use-architecture-graph";

type TrafficNodeKind = "client" | "api" | "queue" | "workers" | "db";

const components: Array<{ kind: TrafficNodeKind; icon: string; name: string; detail: string }> = [
  { kind: "client", icon: "◎", name: "Client", detail: "Starts the 500-job burst" },
  { kind: "api", icon: "◈", name: "API service", detail: "Receives the burst" },
  { kind: "queue", icon: "≋", name: "Queue", detail: "Retains waiting jobs" },
  { kind: "workers", icon: "⚙", name: "Worker pool", detail: "Processes one job at a time" },
  { kind: "db", icon: "▣", name: "Database", detail: "Persists completed jobs" },
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
  workers: { description: "Workers enable asynchronous work outside the request path. Each worker in this level takes only one job at a time.", sourceSection: "Asynchronism · System Design Primer" },
  db: { description: "A database is the durable data store where an application reads and writes its records.", sourceSection: "Database · System Design Primer" },
};

function isTrafficNodeKind(kind: NodeKind): kind is TrafficNodeKind {
  return kind === "client" || kind === "api" || kind === "queue" || kind === "workers" || kind === "db";
}

function trafficNodeTooltip(node: ArchitectureNode, graph: ArchitectureGraph): CanvasNodeTooltip {
  const description = nodeDescriptions[node.kind as TrafficNodeKind];
  const topology = getTrafficSpikeTopology(graph);
  const liveStat = node.kind === "client"
    ? { label: "BURST", value: `${TRAFFIC_SPIKE_BURST} jobs` }
    : node.kind === "api"
      ? { label: "INTAKE", value: `${API_BURST_CAPACITY} jobs / burst` }
      : node.kind === "queue"
        ? { label: "STORAGE", value: `${QUEUE_CAPACITY} jobs` }
        : node.kind === "workers"
          ? { label: "CONCURRENCY", value: "1 job" }
          : { label: "STORAGE", value: "PERSISTENT" };

  return {
    description: description.description,
    sourceSection: description.sourceSection,
    stats: [
      liveStat,
      { label: "CONNECTIONS", value: `${graph.incoming(node.id).length} IN · ${graph.outgoing(node.id).length} OUT` },
      ...(node.kind === "queue" ? [{ label: "ROUTE", value: topology.queueInFlow ? "RETENTION ACTIVE" : "NOT IN FLOW", tone: topology.queueInFlow ? "green" as const : "amber" as const }] : []),
    ],
  };
}

function presentationFor(node: ArchitectureNode, result: TrafficSpikeResult | null): NodePresentation {
  const component = components.find((candidate) => candidate.kind === node.kind)!;
  return {
    icon: component.icon,
    label: component.name,
    detail: node.kind === "client"
      ? `${TRAFFIC_SPIKE_BURST} jobs arrive`
      : node.kind === "api"
        ? `${API_BURST_CAPACITY} jobs / burst`
        : node.kind === "workers"
          ? "1 job at a time"
          : node.kind === "queue" && result?.queueInFlow
            ? `${result.maxBacklog} jobs waiting`
            : component.detail,
  };
}

function formatDuration(durationMs: number) {
  return durationMs ? `${durationMs / 1000} sec` : "—";
}

function formatClock(durationMs: number) {
  const totalSeconds = Math.round(durationMs / 1000);
  return `${String(Math.floor(totalSeconds / 60)).padStart(2, "0")}:${String(totalSeconds % 60).padStart(2, "0")}`;
}

export default function TrafficSpike() {
  const { graph, snapshot, addNode, moveNode, connect, removeEdge, removeNode } = useArchitectureGraph(starterGraph);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<TrafficSpikeResult | null>(null);
  const [runReportOpen, setRunReportOpen] = useState(false);
  const [introOpen, setIntroOpen] = useState(true);
  const [saved, setSaved] = useState(false);
  const topology = getTrafficSpikeTopology(graph);
  const clientConnected = topology.clientRequestConnected && topology.clientResponseConnected;
  const objectives = [
    { title: "1 · Respond to the burst", done: clientConnected, active: !clientConnected },
    { title: "2 · Preserve waiting work", done: topology.queueInFlow, active: clientConnected && !topology.queueInFlow },
    { title: "3 · Drain every job safely", done: topology.queueInFlow && topology.queueWorkerCount > 0, active: topology.queueInFlow && topology.queueWorkerCount === 0 },
  ];

  async function runSimulation() {
    setRunning(true);
    setSaved(false);
    setResult(null);
    await new Promise((resolve) => setTimeout(resolve, 650));
    setResult(evaluateTrafficSpike(graph));
    setRunReportOpen(true);
    setRunning(false);
  }

  async function saveSolution() {
    await fetch("/api/solutions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        level: "traffic-spike",
        graph: snapshot,
        burst: TRAFFIC_SPIKE_BURST,
        apiBurstCapacity: API_BURST_CAPACITY,
        workerCount: topology.queueWorkerCount || topology.directWorkerCount,
        result,
      }),
    });
    setSaved(true);
  }

  const timeline = running
    ? "00:00 — API receiving the burst…"
    : result?.unansweredRequests
      ? `00:00 — Client received no response for ${result.unansweredRequests} jobs`
      : result?.passed
        ? `00:00 — ${result.acceptedResponses} jobs received 202 Accepted · ${formatClock(result.drainDurationMs)} — final queued job completed`
        : result
          ? `00:00 — ${result.acceptedResponses} accepted · ${result.rejectedResponses} rejected because there was nowhere safe to wait`
          : "00:00 — A 500-job burst is ready. Decide where waiting work belongs.";

  return <main>
    <header className="topbar">
      <a className="brand" href="/">FLOW<span>BREAK</span></a>
      <div className="level-pill"><i /> LEVEL 02 · TRAFFIC SPIKE</div>
      <a className="ghost" href="/">LEVEL SELECT</a>
    </header>

    <section className="workspace">
      <ComponentTray title="Protect waiting jobs" description="A 500-job burst reaches the API at once. Each worker can only process one job at a time, so waiting work needs somewhere safe to remain.">
        <div className="component-list">
          {components.map((component) => <div key={component.kind} className="component draggable-component" draggable onDragStart={(event) => startTrayNodeDrag(event, component.kind)}>
            <b>{component.icon}</b><span>{component.name}<small>{component.detail} · drag to add</small></span>
          </div>)}
        </div>
      </ComponentTray>

      <ArchitectureCanvas header={<ArchitectureHeader title="Keep jobs safe while work is in progress" runLabel="RUN TRAFFIC SPIKE" onRun={runSimulation} onShowLastRun={result ? () => setRunReportOpen(true) : undefined} running={running} passed={result?.passed ?? null} />}>
        <ArchitectureGraphCanvas
          graph={graph}
          markerPrefix="traffic"
          note={!clientConnected ? "The Client needs a request edge and an API response edge." : !topology.queueInFlow ? "A worker is busy after starting one job. Where should the remaining work wait?" : "The queue retains waiting jobs while each worker completes them one at a time."}
          nodePresentation={(node) => presentationFor(node, result)}
          nodeTooltip={trafficNodeTooltip}
          nodeResponse={(node) => node.kind === "client" && result ? result.unansweredRequests ? { label: "NO RESPONSE RECEIVED", detail: `${result.unansweredRequests} jobs are unanswered`, tone: "failure" } : result.rejectedResponses ? { label: "SOME JOBS REJECTED", detail: `${result.acceptedResponses} accepted · ${result.rejectedResponses} rejected`, tone: "failure" } : { label: "202 ACCEPTED RECEIVED", detail: `${result.acceptedResponses} jobs acknowledged` } : undefined}
          onAddNode={(kind, position) => { if (isTrafficNodeKind(kind)) addNode(kind, position); }}
          onMoveNode={moveNode}
          onConnect={connect}
          onRemoveEdge={removeEdge}
          onRemoveNode={removeNode}
        />
      </ArchitectureCanvas>

      <MissionControlPanel title="Where do jobs wait?" description="The API can receive this burst, but a worker cannot start another job until it finishes the current one. Preserve every job while work drains." objectives={objectives} objectivesLabel="Traffic Spike objectives">
        <div className="goal"><span>SUCCESS CRITERIA</span><b>Every accepted job is retained and eventually completed.</b></div>
      </MissionControlPanel>
    </section>
    <footer><span>LIVE TIMELINE</span><p>{timeline}</p><em>DETERMINISTIC BROWSER SIMULATION · NO LLM REQUIRED</em></footer>
    {result && runReportOpen && <RunResultModal
      passed={result.passed}
      eyebrow="TRAFFIC SPIKE REPORT"
      successTitle="The burst is safely queued"
      failureTitle="Waiting work is not protected"
      summary={result.feedback}
      highlightLabel={result.passed ? "SYSTEM STATUS" : "NEXT FIX"}
      highlightValue={result.passed ? `${result.acceptedResponses} jobs accepted · ${formatDuration(result.drainDurationMs)} drain` : result.feedback}
      metrics={[
        { label: "API INTAKE", value: `${API_BURST_CAPACITY} JOBS` },
        { label: "CLIENT RESPONSES", value: result.unansweredRequests ? "MISSING" : `${result.acceptedResponses} ACCEPTED${result.rejectedResponses ? ` · ${result.rejectedResponses} REJECTED` : ""}`, tone: result.unansweredRequests || result.rejectedResponses ? "red" : "green" },
        { label: "PROCESSED", value: `${result.processed} jobs` },
        { label: "MAX BACKLOG", value: `${result.maxBacklog} jobs` },
        { label: "AVG LATENCY", value: formatDuration(result.averageLatencyMs) },
        { label: "PEAK LATENCY", value: formatDuration(result.peakLatencyMs) },
      ]}
      actions={<><button className="run-result-action" onClick={saveSolution}>{saved ? "SAVED ✓" : "SAVE THIS SOLUTION"}</button>{result.passed ? <a className="run-result-action secondary" href="/">RETURN TO LEVEL SELECT →</a> : <button className="run-result-action secondary" onClick={() => setRunReportOpen(false)}>KEEP BUILDING</button>}</>}
      onClose={() => setRunReportOpen(false)}
    />}
    {introOpen && <LevelIntroModal level="LEVEL 02" title="Keep a burst from disappearing" problem="Five hundred jobs arrive together, but a worker can process only one job at a time. Sending the burst straight to that worker leaves most jobs with nowhere safe to wait." approach="Let the API acknowledge received jobs while a bounded queue retains the waiting work and workers drain it in the background." sourceHref="https://github.com/donnemartin/system-design-primer#asynchronism" onClose={() => setIntroOpen(false)} />}
  </main>;
}
