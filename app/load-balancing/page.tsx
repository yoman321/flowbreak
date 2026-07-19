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
  API_REPLICA_BURST_CAPACITY,
  LOAD_BALANCE_BURST,
  LoadBalancingResult,
  evaluateLoadBalancing,
  getLoadBalancingTopology,
} from "../lib/simulations/load-balancing";
import { useArchitectureGraph } from "../lib/architecture/use-architecture-graph";

type LoadBalanceNodeKind = "client" | "load-balancer" | "api" | "queue" | "workers" | "db";

const components: Array<{ kind: LoadBalanceNodeKind; icon: string; name: string; detail: string }> = [
  { kind: "client", icon: "◎", name: "Client", detail: "Starts the burst" },
  { kind: "load-balancer", icon: "⇄", name: "Load balancer", detail: "Shares incoming requests" },
  { kind: "api", icon: "◈", name: "API service", detail: "Accepts part of the burst" },
  { kind: "queue", icon: "≋", name: "Queue", detail: "Retains waiting jobs" },
  { kind: "workers", icon: "⚙", name: "Worker pool", detail: "Processes one job at a time" },
  { kind: "db", icon: "▣", name: "Database", detail: "Persists completed jobs" },
];

const starterGraph = createGraphSnapshot([
  { id: "client-1", kind: "client", attributes: { position: { left: 5, top: 40 } } },
  { id: "api-1", kind: "api", attributes: { position: { left: 29, top: 20 } } },
  { id: "queue-1", kind: "queue", attributes: { position: { left: 48, top: 55 } } },
  { id: "workers-1", kind: "workers", attributes: { position: { left: 56, top: 20 } } },
  { id: "db-1", kind: "db", attributes: { position: { left: 77, top: 40 } } },
], [
  { id: "client-1:right-out->api-1:left-in", source: { nodeId: "client-1", portId: "right-out" }, target: { nodeId: "api-1", portId: "left-in" } },
  { id: "api-1:bottom-out->queue-1:top-in", source: { nodeId: "api-1", portId: "bottom-out" }, target: { nodeId: "queue-1", portId: "top-in" } },
  { id: "queue-1:top-out->workers-1:bottom-in", source: { nodeId: "queue-1", portId: "top-out" }, target: { nodeId: "workers-1", portId: "bottom-in" } },
  { id: "workers-1:right-out->db-1:left-in", source: { nodeId: "workers-1", portId: "right-out" }, target: { nodeId: "db-1", portId: "left-in" } },
  { id: "api-1:left-out->client-1:right-in", source: { nodeId: "api-1", portId: "left-out" }, target: { nodeId: "client-1", portId: "right-in" } },
]);

const nodeDescriptions: Record<LoadBalanceNodeKind, { description: string; sourceSection: string }> = {
  client: { description: "A client begins the interaction with a system by sending a request and receiving a response.", sourceSection: "HTTP · System Design Primer" },
  "load-balancer": { description: "A load balancer distributes incoming requests across computing resources and returns the selected resource's response to the client.", sourceSection: "Load balancer · System Design Primer" },
  api: { description: "An API service receives client requests, applies application logic, and sends work to the next component.", sourceSection: "Application layer · System Design Primer" },
  queue: { description: "A queue receives, holds, and delivers messages so producers and workers can operate at different rates.", sourceSection: "Asynchronism · System Design Primer" },
  workers: { description: "Workers enable asynchronous work outside the request path. Each worker in this level takes only one job at a time.", sourceSection: "Asynchronism · System Design Primer" },
  db: { description: "A database is the durable data store where an application reads and writes its records.", sourceSection: "Database · System Design Primer" },
};

function isLoadBalanceNodeKind(kind: NodeKind): kind is LoadBalanceNodeKind {
  return kind === "client" || kind === "load-balancer" || kind === "api" || kind === "queue" || kind === "workers" || kind === "db";
}

function loadBalanceNodeTooltip(node: ArchitectureNode, graph: ArchitectureGraph): CanvasNodeTooltip {
  const topology = getLoadBalancingTopology(graph);
  const liveStat = node.kind === "client"
    ? { label: "BURST", value: `${LOAD_BALANCE_BURST} jobs` }
    : node.kind === "load-balancer"
      ? { label: "POLICY", value: "ROUND ROBIN" }
      : node.kind === "api"
        ? { label: "INTAKE", value: `${API_REPLICA_BURST_CAPACITY} jobs / burst` }
        : node.kind === "queue"
          ? { label: "STORAGE", value: `${LOAD_BALANCE_BURST} jobs` }
          : node.kind === "workers"
            ? { label: "CONCURRENCY", value: "1 job" }
            : { label: "STORAGE", value: "PERSISTENT" };

  return {
    description: nodeDescriptions[node.kind as LoadBalanceNodeKind].description,
    sourceSection: nodeDescriptions[node.kind as LoadBalanceNodeKind].sourceSection,
    stats: [
      liveStat,
      { label: "CONNECTIONS", value: `${graph.incoming(node.id).length} IN · ${graph.outgoing(node.id).length} OUT` },
      ...(node.kind === "load-balancer" ? [{ label: "API ROUTES", value: `${topology.completeApiCount} COMPLETE`, tone: topology.completeApiCount >= 2 ? "green" as const : "amber" as const }] : []),
    ],
  };
}

function presentationFor(node: ArchitectureNode, result: LoadBalancingResult | null): NodePresentation {
  const component = components.find((candidate) => candidate.kind === node.kind)!;
  return {
    icon: component.icon,
    label: component.name,
    detail: node.kind === "client"
      ? `${LOAD_BALANCE_BURST} jobs arrive`
      : node.kind === "api"
        ? `${API_REPLICA_BURST_CAPACITY} jobs / burst`
        : node.kind === "load-balancer" && result?.loadBalanced
          ? `${result.apiReplicaCount} API routes`
          : node.kind === "queue" && result
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

function formatLoadSplit(result: LoadBalancingResult) {
  return result.apiAssignments.length
    ? result.apiAssignments.map((assignment) => `${assignment.apiId.replace("api-", "API ")} · ${assignment.assigned}`).join(" | ")
    : "—";
}

export default function LoadBalancing() {
  const { graph, snapshot, addNode, moveNode, connect, removeEdge, removeNode } = useArchitectureGraph(starterGraph);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<LoadBalancingResult | null>(null);
  const [runReportOpen, setRunReportOpen] = useState(false);
  const [introOpen, setIntroOpen] = useState(true);
  const [saved, setSaved] = useState(false);
  const topology = getLoadBalancingTopology(graph);
  const responseRouteReady = Boolean(topology.activeLoadBalancerId && topology.clientResponseConnected && topology.completeApiCount >= 1 && !topology.directBypassPresent);
  const objectives = [
    { title: "1 · Return a response to every request", done: responseRouteReady, active: !responseRouteReady },
    { title: "2 · Spread the incoming pressure", done: topology.apiReplicaCount >= 2, active: responseRouteReady && topology.apiReplicaCount < 2 },
    { title: "3 · Keep every job safe", done: topology.completeApiCount >= 2, active: topology.apiReplicaCount >= 2 && topology.completeApiCount < 2 },
  ];

  async function runSimulation() {
    setRunning(true);
    setSaved(false);
    setResult(null);
    await new Promise((resolve) => setTimeout(resolve, 650));
    setResult(evaluateLoadBalancing(graph));
    setRunReportOpen(true);
    setRunning(false);
  }

  async function saveSolution() {
    await fetch("/api/solutions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        level: "load-balancing",
        graph: snapshot,
        burst: LOAD_BALANCE_BURST,
        apiReplicaCapacity: API_REPLICA_BURST_CAPACITY,
        result,
      }),
    });
    setSaved(true);
  }

  const timeline = running
    ? "00:00 — Load balancer assigning the burst…"
    : result?.unansweredRequests
      ? `00:00 — ${result.unansweredRequests} jobs received no client response`
      : result?.passed
        ? `00:00 — ${result.acceptedResponses} jobs received 202 Accepted · ${formatClock(result.drainDurationMs)} — final queued job completed`
        : result
          ? `00:00 — ${result.acceptedResponses} accepted · ${result.rejectedResponses} rejected before safe storage`
          : "00:00 — A 500-job burst is ready. One API cannot safely receive it all.";

  return <main>
    <header className="topbar">
      <a className="brand" href="/">FLOW<span>BREAK</span></a>
      <div className="level-pill"><i /> LEVEL 03 · LOAD BALANCING</div>
      <a className="ghost" href="/">LEVEL SELECT</a>
    </header>

    <section className="workspace">
      <ComponentTray title="Share the incoming pressure" description="The queue protects waiting jobs, but a single API can only admit part of this burst. Give incoming traffic enough safe paths before it reaches the queue.">
        <div className="component-list">
          {components.map((component) => <div key={component.kind} className="component draggable-component" draggable onDragStart={(event) => startTrayNodeDrag(event, component.kind)}>
            <b>{component.icon}</b><span>{component.name}<small>{component.detail} · drag to add</small></span>
          </div>)}
        </div>
      </ComponentTray>

      <ArchitectureCanvas header={<ArchitectureHeader title="Share the burst before capacity breaks" runLabel="RUN LOAD BALANCE" onRun={runSimulation} onShowLastRun={result ? () => setRunReportOpen(true) : undefined} running={running} passed={result?.passed ?? null} />}>
        <ArchitectureGraphCanvas
          graph={graph}
          markerPrefix="load-balance"
          note={!topology.activeLoadBalancerId ? "One API still receives the whole burst. Where should incoming requests be shared?" : topology.directBypassPresent ? "The original direct request or response route bypasses the load balancer. Remove it before sharing traffic." : topology.completeApiCount < 2 ? "The load balancer needs more than one complete API route before the burst can be shared safely." : "Round robin can now divide the burst while the queue retains waiting work."}
          nodePresentation={(node) => presentationFor(node, result)}
          nodeTooltip={loadBalanceNodeTooltip}
          nodeResponse={(node) => node.kind === "client" && result ? result.unansweredRequests ? { label: "SOME REQUESTS UNANSWERED", detail: `${result.unansweredRequests} jobs have no response`, tone: "failure" } : result.rejectedResponses ? { label: "CAPACITY REACHED", detail: `${result.acceptedResponses} accepted · ${result.rejectedResponses} rejected`, tone: "failure" } : { label: "202 ACCEPTED RECEIVED", detail: `${result.acceptedResponses} jobs acknowledged` } : undefined}
          onAddNode={(kind, position) => { if (isLoadBalanceNodeKind(kind)) addNode(kind, position); }}
          onMoveNode={moveNode}
          onConnect={connect}
          onRemoveEdge={removeEdge}
          onRemoveNode={removeNode}
        />
      </ArchitectureCanvas>

      <MissionControlPanel title="Where does request pressure go?" description="The worker and queue can finish work in the background, but they only help after an API receives the request. Keep the request path responsive when traffic arrives all at once." objectives={objectives} objectivesLabel="Load balancing objectives">
        <div className="goal"><span>SUCCESS CRITERIA</span><b>Every client request receives a response and every job is retained for completion.</b></div>
      </MissionControlPanel>
    </section>
    <footer><span>LIVE TIMELINE</span><p>{timeline}</p><em>DETERMINISTIC BROWSER SIMULATION · NO LLM REQUIRED</em></footer>
    {result && runReportOpen && <RunResultModal
      passed={result.passed}
      eyebrow="LOAD BALANCING REPORT"
      successTitle="The burst is shared safely"
      failureTitle="Request pressure is still concentrated"
      summary={result.feedback}
      highlightLabel={result.passed ? "SYSTEM STATUS" : "NEXT FIX"}
      highlightValue={result.passed ? `${result.acceptedResponses} jobs shared across ${result.completeApiCount} API routes` : result.feedback}
      metrics={[
        { label: "LOAD SPLIT", value: formatLoadSplit(result) },
        { label: "CLIENT RESPONSES", value: result.unansweredRequests ? `${result.unansweredRequests} MISSING` : `${result.acceptedResponses} ACCEPTED${result.rejectedResponses ? ` · ${result.rejectedResponses} REJECTED` : ""}`, tone: result.unansweredRequests || result.rejectedResponses ? "red" : "green" },
        { label: "PROCESSED", value: `${result.processed} jobs` },
        { label: "MAX BACKLOG", value: `${result.maxBacklog} jobs` },
        { label: "PEAK LATENCY", value: formatDuration(result.peakLatencyMs) },
        { label: "WORKER ROUTES", value: `${result.workerCount}` },
      ]}
      actions={<><button className="run-result-action" onClick={saveSolution}>{saved ? "SAVED ✓" : "SAVE THIS SOLUTION"}</button>{result.passed ? <a className="run-result-action secondary" href="/">RETURN TO LEVEL SELECT →</a> : <button className="run-result-action secondary" onClick={() => setRunReportOpen(false)}>KEEP BUILDING</button>}</>}
      onClose={() => setRunReportOpen(false)}
    />}
    {introOpen && <LevelIntroModal level="LEVEL 03" title="Share the request path" problem="The queue protects work after an API receives it, but one API can only admit part of a sudden burst. The rest of the requests are rejected before they can reach the queue." approach="A load balancer can distribute incoming requests across API services, keeping any one service from taking the entire burst while still returning the selected service's response to the client." sourceHref="https://github.com/donnemartin/system-design-primer#load-balancer" onClose={() => setIntroOpen(false)} />}
  </main>;
}
