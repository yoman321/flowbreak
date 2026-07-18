"use client";

import { useState } from "react";
import { ArchitectureCanvas } from "../components/architecture-canvas";
import { ArchitectureGraphCanvas, startTrayNodeDrag } from "../components/architecture-graph-canvas";
import { ArchitectureHeader } from "../components/architecture-header";
import { ComponentTray } from "../components/component-tray";
import { LevelIntroModal } from "../components/level-intro-modal";
import { MissionControlPanel } from "../components/mission-control-panel";
import { RunResultModal } from "../components/run-result-modal";
import { CanvasNodeTooltip } from "../components/canvas-node";
import { ArchitectureGraph, createGraphSnapshot } from "../lib/architecture/graph";
import { ArchitectureNode, NodeKind } from "../lib/architecture/nodes";
import { useArchitectureGraph } from "../lib/architecture/use-architecture-graph";

type TutorialNodeKind = "client" | "api" | "workers" | "db";
type TutorialStep = { title: string; instruction: string; complete: boolean; target?: TutorialNodeKind };
type TutorialRunResult = { passed: boolean; clientReceivedResponse: boolean; nodes: number; flows: number; nextAction: string };
type NodeExplainer = { question: string; description: string; placement: string; sourceSection: string; sourceHref: string };

const components: Array<{ kind: TutorialNodeKind; icon: string; name: string; detail: string }> = [
  { kind: "client", icon: "◎", name: "Client", detail: "Starts traffic" },
  { kind: "api", icon: "◈", name: "API request", detail: "Accepts requests" },
  { kind: "workers", icon: "⚙", name: "Worker pool", detail: "Processes work" },
  { kind: "db", icon: "▣", name: "Database", detail: "Stores data" },
];

const nodeExplainers: Record<TutorialNodeKind, NodeExplainer> = {
  client: {
    question: "What is a Client?",
    description: "A client is what starts an interaction with a system: for example, a browser, mobile app, or another service. It sends a request and receives a response.",
    placement: "In this flow, the Client is where the request begins and returns.",
    sourceSection: "HTTP · System Design Primer",
    sourceHref: "https://github.com/donnemartin/system-design-primer#hypertext-transfer-protocol-http",
  },
  api: {
    question: "What is an API request?",
    description: "In this board, the API request node represents the API-facing application service. It receives the client's HTTP request, applies application logic or routing, then responds or passes work onward.",
    placement: "In this flow, it is the system's first stop after the Client and sends the response back.",
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

function isTutorialNodeKind(kind: NodeKind): kind is TutorialNodeKind {
  return kind === "client" || kind === "api" || kind === "workers" || kind === "db";
}

function hasFirstRequestFlow(graph: ArchitectureGraph) {
  return graph.nodes.some((client) => client.kind === "client" && graph.outgoing(client.id).some((request) => {
    const api = graph.getNode(request.target.nodeId);
    return api?.kind === "api"
      && graph.outgoing(api.id).some((edge) => graph.getNode(edge.target.nodeId)?.kind === "db")
      && graph.hasConnection(api.id, client.id);
  }));
}

function tutorialNodeTooltip(node: ArchitectureNode, graph: ArchitectureGraph): CanvasNodeTooltip {
  const explainer = nodeExplainers[node.kind as TutorialNodeKind];
  const context = node.kind === "client"
    ? "REQUEST + RESPONSE"
    : node.kind === "api"
      ? "INLINE WORK"
      : node.kind === "workers"
        ? "OPTIONAL HERE"
        : "DURABLE STORE";

  return {
    description: explainer.description,
    sourceSection: explainer.sourceSection,
    stats: [
      { label: "CONNECTIONS", value: `${graph.incoming(node.id).length} IN · ${graph.outgoing(node.id).length} OUT` },
      { label: "ROLE", value: context },
    ],
  };
}

export default function Tutorial() {
  const { graph, addNode, moveNode, connect, removeEdge, removeNode } = useArchitectureGraph(createGraphSnapshot([]));
  const [introducedNodeType, setIntroducedNodeType] = useState<TutorialNodeKind | null>(null);
  const [introOpen, setIntroOpen] = useState(true);
  const [runReportOpen, setRunReportOpen] = useState(false);
  const [lastRun, setLastRun] = useState<TutorialRunResult | null>(null);
  const hasNode = (kind: TutorialNodeKind) => graph.nodes.some((node) => node.kind === kind);
  const hasKindConnection = (source: TutorialNodeKind, target: TutorialNodeKind) => graph.hasKindConnection(source, target);
  const guideSteps: TutorialStep[] = [
    { title: "Place a Client", instruction: "Drag Client from the component kit onto the canvas. It is where a request begins.", complete: hasNode("client"), target: "client" },
    { title: "Place an API request", instruction: "Drag API request onto the canvas. It is the first system component to receive the request.", complete: hasNode("api"), target: "api" },
    { title: "Route Client to API request", instruction: "Drag from any Client-side port to any API request-side port. The arrow shows where request data flows.", complete: hasKindConnection("client", "api") },
    { title: "Place a Database", instruction: "Drag Database onto the canvas. It is where the API request will read or store application data.", complete: hasNode("db"), target: "db" },
    { title: "Connect API request to Database", instruction: "Connect the API request output to the Database input so it can store the result.", complete: hasKindConnection("api", "db") },
    { title: "Return a response to Client", instruction: "Drag from any API request-side port to any Client-side port. The return arrow shows that the client receives a response.", complete: hasKindConnection("api", "client") },
  ];
  const activeGuideStep = guideSteps.find((step) => !step.complete);
  const completedGuideSteps = guideSteps.filter((step) => step.complete).length;
  const firstRequestComplete = hasFirstRequestFlow(graph);

  function runFlow() {
    setLastRun({
      passed: firstRequestComplete,
      clientReceivedResponse: firstRequestComplete,
      nodes: graph.nodes.length,
      flows: graph.edges.length,
      nextAction: activeGuideStep?.title ?? "Return the API response to one Client.",
    });
    setRunReportOpen(true);
  }

  return <main>
    <header className="topbar">
      <a className="brand" href="/">FLOW<span>BREAK</span></a>
      <div className="level-pill"><i /> LEVEL 00 · TUTORIAL</div>
      <a className="ghost" href="/">LEVEL SELECT</a>
    </header>

    <section className="workspace">
      <ComponentTray title="Build a flow" description="Follow the guide to build a first request flow, then keep experimenting on this practice board.">
        <div className="component-list">
          {components.map((component) => <div key={component.kind} className={`component draggable-component ${activeGuideStep?.target === component.kind ? "guide-target" : ""}`} draggable onDragStart={(event) => startTrayNodeDrag(event, component.kind)}>
            <b>{component.icon}</b><span>{component.name}<small>{component.detail} · drag to add</small></span>
          </div>)}
        </div>
      </ComponentTray>

      <ArchitectureCanvas header={<ArchitectureHeader title="Build your flow" runLabel="RUN FLOW" onRun={runFlow} onShowLastRun={lastRun ? () => setRunReportOpen(true) : undefined} passed={lastRun?.passed ?? null} />}>
        <ArchitectureGraphCanvas
          graph={graph}
          markerPrefix="tutorial"
          note="Use any API-side port to return a response into any Client-side port."
          nodePresentation={(node) => {
            const component = components.find((candidate) => candidate.kind === node.kind);
            return component ? { icon: component.icon, label: component.name, detail: component.detail } : node.presentation;
          }}
          nodeTooltip={tutorialNodeTooltip}
          nodeResponse={(node) => node.kind === "client" && lastRun ? lastRun.clientReceivedResponse ? { label: "200 OK RECEIVED", detail: "First request completed" } : { label: "NO RESPONSE RECEIVED", detail: "The request path is incomplete", tone: "failure" } : undefined}
          onAddNode={addNode}
          onMoveNode={moveNode}
          onConnect={connect}
          onRemoveEdge={removeEdge}
          onRemoveNode={removeNode}
          onNodeAdded={(kind) => { if (isTutorialNodeKind(kind)) setIntroducedNodeType(kind); }}
        />
      </ArchitectureCanvas>

      <MissionControlPanel className="tutorial-mission" title="Build your first request" description="Use direct manipulation: drag from the kit to add, drag a node to move it, drag from any node-side port to connect, and click a flow line to remove it." objectives={guideSteps.map((step, index) => ({ title: `${index + 1} · ${step.title}`, done: step.complete, active: activeGuideStep === step }))} objectivesLabel="Tutorial objectives" objectivesClassName="tutorial-checkpoints">
        <div className="goal"><span>FIRST REQUEST FLOW</span><b>Client → API request → Database · API request → Client</b></div>
        <div className="tutorial-guide" aria-live="polite">
          <span>{activeGuideStep ? `GUIDED STEP ${completedGuideSteps + 1} OF ${guideSteps.length}` : "FIRST REQUEST COMPLETE"}</span>
          <b>{activeGuideStep?.title ?? "You built a complete request path."}</b>
          <p>{activeGuideStep?.instruction ?? "Keep adding, moving, and reconnecting components to explore different flows."}</p>
        </div>
      </MissionControlPanel>
    </section>
    <footer><span>LIVE TIMELINE</span><p>{lastRun?.clientReceivedResponse ? "00:00 — Client received 200 OK from the completed request." : graph.nodes.length ? `${graph.nodes.length} components placed · ${graph.edges.length} flows routed` : "00:00 — The practice board is ready."}</p><em>TUTORIAL · NO SIMULATION ACTIVE</em></footer>
    {introducedNodeType && <NodeExplainerModal type={introducedNodeType} onClose={() => setIntroducedNodeType(null)} />}
    {lastRun && runReportOpen && <RunResultModal
      passed={lastRun.passed}
      eyebrow="RUN REPORT"
      successTitle="Flow is correct"
      failureTitle="Flow needs work"
      summary={lastRun.passed ? "Your diagram contains an uninterrupted request path and an API → Client return edge. The client receives a 200 OK response after the request completes." : "Your diagram needs both a Client request path and an API → Client response edge."}
      highlightLabel={lastRun.passed ? "VALIDATION PASSED" : "NEXT ACTION"}
      highlightValue={lastRun.passed ? "Request path is complete." : lastRun.nextAction}
      metrics={[
        { label: "NODES", value: String(lastRun.nodes) },
        { label: "FLOWS", value: String(lastRun.flows) },
        { label: "PATH", value: lastRun.passed ? "VALID" : "INCOMPLETE", tone: lastRun.passed ? "green" : "red" },
        { label: "CLIENT RESPONSE", value: lastRun.clientReceivedResponse ? "200 OK" : "MISSING", tone: lastRun.clientReceivedResponse ? "green" : "red" },
        { label: "MODE", value: "PRACTICE" },
      ]}
      actions={lastRun.passed ? <a className="run-result-action" href="/background-delivery">CONTINUE TO LEVEL 01 · BACKGROUND DELIVERY →</a> : <button className="run-result-action" onClick={() => setRunReportOpen(false)}>KEEP BUILDING</button>}
      onClose={() => setRunReportOpen(false)}
    />}
    {introOpen && <LevelIntroModal level="LEVEL 00" title="Build a first request" problem="A request needs a clear path through a system. Without one, the API cannot receive the request or store the result reliably." approach="For short work, the client sends a request to an API service, which performs the needed read or write with a database before responding." sourceHref="https://github.com/donnemartin/system-design-primer#application-layer" onClose={() => setIntroOpen(false)} />}
  </main>;
}

function NodeExplainerModal({ type, onClose }: { type: TutorialNodeKind; onClose: () => void }) {
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
