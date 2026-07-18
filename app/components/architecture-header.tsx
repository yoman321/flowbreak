export function ArchitectureHeader({ title, runLabel, onRun, onShowLastRun, running = false, passed = null }: {
  title: string;
  runLabel: string;
  onRun: () => void;
  onShowLastRun?: () => void;
  running?: boolean;
  passed?: boolean | null;
}) {
  const outcome = passed === null || !onShowLastRun ? null : passed ? "success" : "failure";

  return <div className="canvas-head">
    <div>
      <p className="eyebrow">ARCHITECTURE</p>
      <h1>{title}</h1>
    </div>
    <div className="canvas-head-actions">
      {outcome && <button type="button" className={`last-run ${outcome}`} onClick={onShowLastRun} aria-label={`Show last run result: ${outcome === "success" ? "passed" : "failed"}`} title="Show last run result">
        {outcome === "success" ? "✓" : "×"}
      </button>}
      <button className="run canvas-run" onClick={onRun} disabled={running}>{running ? "SIMULATING…" : `▶ ${runLabel}`}</button>
    </div>
  </div>;
}
