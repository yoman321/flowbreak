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

type DeliveryNodeKind = "client" | "api" | "workers" | "db";
type DeliveryResult = {
  passed: boolean;
  apiAcknowledged: boolean;
  clientReceivedResponse: boolean;
  backgroundDelivery: boolean;
  apiLatencyMs: number;
  deliveryDurationMs: number;
  feedback: string;
};

const components: Array<{ kind: DeliveryNodeKind; icon: string; name: string; detail: string }> = [
  { kind: "client", icon: "◎", name: "Client", detail: "Publishes a post" },
  { kind: "api", icon: "◈", name: "API service", detail: "Acknowledges receipt" },
  { kind: "workers", icon: "⚙", name: "Worker pool", detail: "Delivers to followers" },
  { kind: "db", icon: "▣", name: "Database", detail: "Stores post state" },
];

const starterGraph = createGraphSnapshot([
  { id: "client-1", kind: "client", attributes: { position: { left: 7, top: 40 } } },
  { id: "api-1", kind: "api", attributes: { position: { left: 41, top: 40 } } },
  { id: "db-1", kind: "db", attributes: { position: { left: 76, top: 40 } } },
], [
  { id: "client-1:right-out->api-1:left-in", source: { nodeId: "client-1", portId: "right-out" }, target: { nodeId: "api-1", portId: "left-in" } },
  { id: "api-1:left-out->client-1:right-in", source: { nodeId: "api-1", portId: "left-out" }, target: { nodeId: "client-1", portId: "right-in" } },
]);

const nodeDescriptions: Record<DeliveryNodeKind, { description: string; sourceSection: string }> = {
  client: { description: "A client begins an interaction by sending a request and receiving a response.", sourceSection: "HTTP · System Design Primer" },
  api: { description: "An API service receives the request and can acknowledge it without waiting for expensive work to finish.", sourceSection: "Application layer · System Design Primer" },
  workers: { description: "Workers enable asynchronous work, so a time-consuming job can continue after the request is acknowledged.", sourceSection: "Asynchronism · System Design Primer" },
  db: { description: "A database is the durable store for the post and its delivery state.", sourceSection: "Database · System Design Primer" },
};

function isDeliveryNodeKind(kind: NodeKind): kind is DeliveryNodeKind {
  return kind === "client" || kind === "api" || kind === "workers" || kind === "db";
}

function evaluateDelivery(graph: ArchitectureGraph): DeliveryResult {
  const requestReachesApi = graph.hasKindConnection("client", "api");
  const responseReachesClient = graph.hasKindConnection("api", "client");
  const workerReceivesDelivery = graph.hasKindConnection("api", "workers");
  const workerRecordsDelivery = graph.hasKindConnection("workers", "db");
  const apiAcknowledged = requestReachesApi && responseReachesClient;
  const clientReceivedResponse = apiAcknowledged;
  const backgroundDelivery = workerReceivesDelivery && workerRecordsDelivery;
  const passed = clientReceivedResponse && backgroundDelivery;

  return {
    passed,
    apiAcknowledged,
    clientReceivedResponse,
    backgroundDelivery,
    apiLatencyMs: apiAcknowledged ? 45 : 0,
    deliveryDurationMs: backgroundDelivery ? 8000 : 0,
    feedback: passed
      ? "The API acknowledged the post immediately. Follower delivery continued in the worker after the client response."
      : !requestReachesApi
        ? "The Client needs a request path to the API before the post can be acknowledged."
        : !responseReachesClient
          ? "The API needs a return edge to the Client before it can acknowledge the post."
          : !workerReceivesDelivery
            ? "The API received the post, but no worker has the background delivery job yet."
            : "The worker needs a path to record that background delivery completed.",
  };
}

function deliveryNodeTooltip(node: ArchitectureNode, graph: ArchitectureGraph): CanvasNodeTooltip {
  const description = nodeDescriptions[node.kind as DeliveryNodeKind];
  const liveStat = node.kind === "api"
    ? { label: "RESPONSE", value: "FAST ACK" }
    : node.kind === "workers"
      ? { label: "DELIVERY", value: "ASYNC WORK" }
      : node.kind === "client"
        ? { label: "REQUEST", value: "1 POST" }
        : { label: "STATE", value: "POST RECORD" };
  return {
    description: description.description,
    sourceSection: description.sourceSection,
    stats: [liveStat, { label: "CONNECTIONS", value: `${graph.incoming(node.id).length} IN · ${graph.outgoing(node.id).length} OUT` }],
  };
}

function presentationFor(node: ArchitectureNode, result: DeliveryResult | null): NodePresentation {
  const component = components.find((candidate) => candidate.kind === node.kind)!;
  return {
    icon: component.icon,
    label: component.name,
    detail: node.kind === "api" && result?.apiAcknowledged
      ? "202 ACCEPTED · RECEIVED"
      : node.kind === "workers" && result?.backgroundDelivery
        ? "DELIVERY COMPLETE · ASYNC"
        : component.detail,
  };
}

export default function BackgroundDelivery() {
  const { graph, addNode, moveNode, connect, removeEdge, removeNode } = useArchitectureGraph(starterGraph);
  const [running, setRunning] = useState(false);
  const [introOpen, setIntroOpen] = useState(true);
  const [lastRun, setLastRun] = useState<DeliveryResult | null>(null);
  const [runReportOpen, setRunReportOpen] = useState(false);
  const requestReachesApi = graph.hasKindConnection("client", "api");
  const responseReachesClient = graph.hasKindConnection("api", "client");
  const workerReceivesDelivery = graph.hasKindConnection("api", "workers");
  const workerRecordsDelivery = graph.hasKindConnection("workers", "db");
  const objectives = [
    { title: "1 · Acknowledge the request", done: requestReachesApi && responseReachesClient, active: !requestReachesApi || !responseReachesClient },
    { title: "2 · Move delivery to background", done: workerReceivesDelivery, active: requestReachesApi && responseReachesClient && !workerReceivesDelivery },
    { title: "3 · Confirm delivery completes", done: workerRecordsDelivery, active: workerReceivesDelivery && !workerRecordsDelivery },
  ];

  async function runDelivery() {
    setRunning(true);
    setLastRun(null);
    await new Promise((resolve) => setTimeout(resolve, 650));
    setLastRun(evaluateDelivery(graph));
    setRunReportOpen(true);
    setRunning(false);
  }

  return <main>
    <header className="topbar">
      <a className="brand" href="/">FLOW<span>BREAK</span></a>
      <div className="level-pill"><i /> LEVEL 01 · BACKGROUND DELIVERY</div>
      <a className="ghost" href="/">LEVEL SELECT</a>
    </header>

    <section className="workspace">
      <ComponentTray title="Build an async flow" description="A follower delivery takes time. Keep the request fast, then let a worker finish delivery after the API has acknowledged receipt.">
        <div className="component-list">
          {components.map((component) => <div key={component.kind} className="component draggable-component" draggable onDragStart={(event) => startTrayNodeDrag(event, component.kind)}>
            <b>{component.icon}</b><span>{component.name}<small>{component.detail} · drag to add</small></span>
          </div>)}
        </div>
      </ComponentTray>

      <ArchitectureCanvas header={<ArchitectureHeader title="Deliver without blocking the post" runLabel="RUN DELIVERY" onRun={runDelivery} onShowLastRun={lastRun ? () => setRunReportOpen(true) : undefined} running={running} passed={lastRun?.passed ?? null} />}>
        <ArchitectureGraphCanvas
          graph={graph}
          markerPrefix="delivery"
          note="The API returns 202 Accepted to the Client while delivery continues."
          nodePresentation={(node) => presentationFor(node, lastRun)}
          nodeTooltip={deliveryNodeTooltip}
          nodeResponse={(node) => node.kind === "client" && lastRun ? lastRun.clientReceivedResponse ? { label: "202 ACCEPTED RECEIVED", detail: "Post acknowledged in 45 ms" } : { label: "NO RESPONSE RECEIVED", detail: "The API has not acknowledged the post", tone: "failure" } : undefined}
          onAddNode={(kind, position) => { if (isDeliveryNodeKind(kind)) addNode(kind, position); }}
          onMoveNode={moveNode}
          onConnect={connect}
          onRemoveEdge={removeEdge}
          onRemoveNode={removeNode}
        />
      </ArchitectureCanvas>

      <MissionControlPanel title="Keep delivery off the request path" description="Follower delivery is slow. The API should confirm that it received the post, while workers finish the delivery asynchronously." objectives={objectives} objectivesLabel="Background Delivery objectives">
        <div className="goal"><span>REQUEST OUTCOME</span><b>202 Accepted now · follower delivery later</b></div>
      </MissionControlPanel>
    </section>
    <footer><span>LIVE TIMELINE</span><p>{running ? "00:00 — API received the post…" : lastRun?.passed ? "00:00 — Client received 202 Accepted · 00:08 — Worker finished follower delivery." : "00:00 — Route a post, then move delivery off the request path."}</p><em>DETERMINISTIC SIMULATION · NO LLM REQUIRED</em></footer>
    {lastRun && runReportOpen && <RunResultModal
      passed={lastRun.passed}
      eyebrow="BACKGROUND DELIVERY REPORT"
      successTitle="Delivery is asynchronous"
      failureTitle="Request path is still blocked"
      summary={lastRun.feedback}
      highlightLabel={lastRun.passed ? "API RESPONSE" : "NEXT FIX"}
      highlightValue={lastRun.passed ? "202 Accepted · request received" : lastRun.feedback}
      metrics={[
        { label: "API ACK", value: lastRun.apiAcknowledged ? "202 ACCEPTED" : "MISSING", tone: lastRun.apiAcknowledged ? "green" : "red" },
        { label: "CLIENT RESPONSE", value: lastRun.clientReceivedResponse ? "RECEIVED" : "MISSING", tone: lastRun.clientReceivedResponse ? "green" : "red" },
        { label: "ACK TIME", value: lastRun.apiAcknowledged ? `${lastRun.apiLatencyMs} ms` : "—" },
        { label: "WORKER", value: lastRun.backgroundDelivery ? "COMPLETE" : "NOT ROUTED", tone: lastRun.backgroundDelivery ? "green" : "red" },
        { label: "DELIVERY", value: lastRun.backgroundDelivery ? `${lastRun.deliveryDurationMs / 1000} sec` : "—" },
      ]}
      actions={lastRun.passed ? <a className="run-result-action" href="/">RETURN TO LEVEL SELECT →</a> : <button className="run-result-action" onClick={() => setRunReportOpen(false)}>KEEP BUILDING</button>}
      onClose={() => setRunReportOpen(false)}
    />}
    {introOpen && <LevelIntroModal level="LEVEL 01" title="Keep slow delivery out of the request" problem="Follower delivery can take far longer than publishing a post. Waiting for that work would make the client wait on every request." approach="The API acknowledges the received post, then hands follower delivery to workers that finish it in the background." sourceHref="https://github.com/donnemartin/system-design-primer#asynchronism" onClose={() => setIntroOpen(false)} />}
  </main>;
}
