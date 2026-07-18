"use client";

import { ReactNode } from "react";

export type RunResultMetric = { label: string; value: string; tone?: "green" | "red" };

export function RunResultModal({ passed, eyebrow, successTitle, failureTitle, summary, highlightLabel, highlightValue, metrics, actions, onClose }: {
  passed: boolean;
  eyebrow: string;
  successTitle: string;
  failureTitle: string;
  summary: string;
  highlightLabel: string;
  highlightValue: string;
  metrics: RunResultMetric[];
  actions?: ReactNode;
  onClose: () => void;
}) {
  return <div className="run-result-modal" role="presentation" onClick={onClose}>
    <section className={`run-result-card ${passed ? "pass" : "fail"}`} role="dialog" aria-modal="true" aria-labelledby="run-result-title" onClick={(event) => event.stopPropagation()}>
      <button className="run-result-close" aria-label="Close run report" onClick={onClose}>×</button>
      <p className="eyebrow">{eyebrow}</p>
      <h2 id="run-result-title">{passed ? successTitle : failureTitle}</h2>
      <p>{summary}</p>
      <div className="run-result-status"><span>{highlightLabel}</span><b>{highlightValue}</b></div>
      <div className="metrics run-result-metrics" aria-label="Run result metrics">
        {metrics.map((metric) => <div key={metric.label} className="metric"><span>{metric.label}</span><b className={metric.tone ?? ""}>{metric.value}</b></div>)}
      </div>
      {actions && <div className="run-result-actions">{actions}</div>}
    </section>
  </div>;
}
