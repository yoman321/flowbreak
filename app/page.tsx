"use client";

import { DragEvent, useState } from "react";

type Result = {
  passed: boolean; processed: number; dropped: number; maxBacklog: number;
  averageLatencyMs: number; feedback: string;
};

const components = [
  { id: "api", icon: "◈", name: "API service", detail: "100 req/s capacity" },
  { id: "queue", icon: "≋", name: "Queue", detail: "Buffers burst traffic" },
  { id: "workers", icon: "⚙", name: "Worker pool", detail: "Drains queued work" },
  { id: "database", icon: "▣", name: "Database", detail: "Persists processed jobs" },
];

export default function Home() {
  const [hasQueue, setHasQueue] = useState(false);
  const [workers, setWorkers] = useState(1);
  const [burst, setBurst] = useState(500);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [saved, setSaved] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [positions, setPositions] = useState<Record<string, { left: string; top: string }>>({
    client: { left: "5%", top: "38%" }, api: { left: "26%", top: "20%" },
    queue: { left: "44%", top: "58%" }, workers: { left: "63%", top: "20%" }, db: { left: "78%", top: "58%" },
  });

  const canPass = hasQueue && workers >= 3;

  function dragStart(event: DragEvent<HTMLElement>, item: string) {
    event.dataTransfer.setData("sandbox-item", item);
    event.dataTransfer.effectAllowed = "move";
    setDragging(true);
  }

  function dropOnCanvas(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const item = event.dataTransfer.getData("sandbox-item");
    const rect = event.currentTarget.getBoundingClientRect();
    const left = `${Math.min(82, Math.max(2, ((event.clientX - rect.left) / rect.width) * 100))}%`;
    const top = `${Math.min(76, Math.max(5, ((event.clientY - rect.top) / rect.height) * 100))}%`;
    if (item.startsWith("tray:")) {
      const node = item.slice(5);
      if (node === "queue") setHasQueue(true);
      setPositions((current) => ({ ...current, [node]: { left, top } }));
    }
    if (item.startsWith("node:")) setPositions((current) => ({ ...current, [item.slice(5)]: { left, top } }));
    setDragging(false);
  }

  function removeQueue(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    if (event.dataTransfer.getData("sandbox-item") === "node:queue") setHasQueue(false);
    setDragging(false);
  }

  async function runSimulation() {
    setRunning(true); setSaved(false);
    await new Promise((resolve) => setTimeout(resolve, 650));
    const response = await fetch("/api/simulate", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workers, queue: hasQueue, burst }),
    });
    setResult(await response.json()); setRunning(false);
  }

  async function saveSolution() {
    await fetch("/api/solutions", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ level: "traffic-spike", hasQueue, workers, burst, result }),
    });
    setSaved(true);
  }

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#">FLOW<span>BREAK</span></a>
        <div className="level-pill"><i /> LEVEL 01 · TRAFFIC SPIKE</div>
        <button className="ghost">How it works</button>
      </header>

      <section className="workspace">
        <aside className="tray">
          <p className="eyebrow">COMPONENT KIT</p>
          <h2>Build a path</h2>
          <p className="muted">Drag any component onto the canvas. Drag canvas nodes to reposition them.</p>
          <div className="component-list">
            {components.map((component) => {
              const isQueue = component.id === "queue";
              return <div key={component.id} className={`component draggable-component ${isQueue && hasQueue ? "selected" : ""}`} draggable onDragStart={(event) => dragStart(event, `tray:${component.id}`)} onDragEnd={() => setDragging(false)}>
                <b>{component.icon}</b><span>{component.name}<small>{isQueue ? (hasQueue ? "On canvas — drag again to add" : "Drag to canvas") : component.detail}</small></span>
              </div>;
            })}
          </div>
          <div className="control-block">
            <label>WORKER INSTANCES <strong>{workers}</strong></label>
            <input aria-label="Worker instances" type="range" min="1" max="6" value={workers} onChange={(e) => setWorkers(Number(e.target.value))} />
            <label>BURST SIZE <strong>{burst} jobs</strong></label>
            <input aria-label="Burst size" type="range" min="200" max="1000" step="100" value={burst} onChange={(e) => setBurst(Number(e.target.value))} />
          </div>
        </aside>

        <section className="canvas-panel">
          <div className="canvas-head"><div><p className="eyebrow">ARCHITECTURE</p><h1>Absorb the traffic spike</h1></div><span className={canPass ? "ready" : "warning"}>{canPass ? "READY TO TEST" : "NEEDS PROTECTION"}</span></div>
          <div className={`canvas ${dragging ? "drop-target" : ""}`} onDragOver={(event) => event.preventDefault()} onDrop={dropOnCanvas}>
            <div className="flow-line" />
            <div draggable onDragStart={(event) => dragStart(event, "node:client")} onDragEnd={() => setDragging(false)} style={positions.client} className="node client"><b>◎</b><span>CLIENT<small>{burst} jobs arrive</small></span></div>
            <div draggable onDragStart={(event) => dragStart(event, "node:api")} onDragEnd={() => setDragging(false)} style={positions.api} className="node api"><b>◈</b><span>API SERVICE<small>100 req/s</small></span></div>
            {hasQueue && <div draggable onDragStart={(event) => dragStart(event, "node:queue")} onDragEnd={() => setDragging(false)} style={positions.queue} className="node queue"><b>≋</b><span>QUEUE<small>backpressure buffer</small></span></div>}
            <div draggable onDragStart={(event) => dragStart(event, "node:workers")} onDragEnd={() => setDragging(false)} style={positions.workers} className="node workers"><b>⚙</b><span>WORKERS<small>{workers} × 100 jobs/s</small></span></div>
            <div draggable onDragStart={(event) => dragStart(event, "node:db")} onDragEnd={() => setDragging(false)} style={positions.db} className="node db"><b>▣</b><span>DATABASE<small>job storage</small></span></div>
            <div className="canvas-note">{hasQueue ? "Queue decouples the burst from processing." : "No queue: the API is directly exposed to the burst."}</div>
          </div>
          {hasQueue && <button className="remove" onDragOver={(event) => event.preventDefault()} onDrop={removeQueue}>DROP QUEUE HERE TO REMOVE</button>}
          <button className="run" onClick={runSimulation} disabled={running}>{running ? "SIMULATING BURST…" : "▶ RUN TRAFFIC SPIKE"}</button>
        </section>

        <aside className="mission">
          <p className="eyebrow">MISSION CONTROL</p>
          <h2>Keep every job alive.</h2>
          <p className="muted">A 500-job burst hits in one second. Add a queue and enough workers to process it safely.</p>
          <div className="goal"><span>SUCCESS CRITERIA</span><b>0 dropped jobs</b><b>Drain backlog with 3+ workers</b></div>
          <div className="metrics">
            <Metric label="STATUS" value={result ? (result.passed ? "PASS" : "FAIL") : "STANDBY"} tone={result?.passed ? "green" : result ? "red" : ""} />
            <Metric label="MAX BACKLOG" value={result ? `${result.maxBacklog} jobs` : "—"} />
            <Metric label="DROPPED" value={result ? `${result.dropped} jobs` : "—"} tone={result?.dropped ? "red" : result ? "green" : ""} />
            <Metric label="AVG LATENCY" value={result ? `${result.averageLatencyMs} ms` : "—"} />
          </div>
          {result && <div className={`feedback ${result.passed ? "pass" : "fail"}`}><b>{result.passed ? "SYSTEM RESOLVED" : "BOTTLENECK DETECTED"}</b><p>{result.feedback}</p>{<button onClick={saveSolution}>{saved ? "SAVED ✓" : "SAVE THIS SOLUTION"}</button>}</div>}
        </aside>
      </section>
      <footer><span>LIVE TIMELINE</span><p>{running ? "00:01 — Burst entering API…" : result ? `00:10 — ${result.processed} jobs processed · ${result.dropped} dropped` : "00:00 — Configure a design, then run the simulation."}</p><em>DETERMINISTIC SIMULATION · NO LLM REQUIRED</em></footer>
    </main>
  );
}

function Metric({ label, value, tone = "" }: { label: string; value: string; tone?: string }) {
  return <div className="metric"><span>{label}</span><b className={tone}>{value}</b></div>;
}
