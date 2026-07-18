export type LevelObjective = {
  title: string;
  done: boolean;
  active?: boolean;
};

export function ObjectiveChecklist({ objectives, ariaLabel, className = "" }: {
  objectives: LevelObjective[];
  ariaLabel: string;
  className?: string;
}) {
  return <div className={`checkpoints ${className}`.trim()} aria-label={ariaLabel}>
    {objectives.map((objective) => <div key={objective.title} className={`checkpoint ${objective.done ? "done" : "pending"} ${objective.active ? "active" : ""}`}>
      <span className="checkpoint-mark" aria-hidden="true">{objective.done ? "✓" : objective.active ? "→" : "○"}</span>
      <b>{objective.title}</b>
    </div>)}
  </div>;
}
