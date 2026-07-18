import type { ReactNode } from "react";
import { ObjectiveChecklist, type LevelObjective } from "./objective-checklist";

export function MissionControlPanel({ title, description, objectives, objectivesLabel, objectivesClassName = "", className = "", children }: {
  title: string;
  description: string;
  objectives: LevelObjective[];
  objectivesLabel: string;
  objectivesClassName?: string;
  className?: string;
  children: ReactNode;
}) {
  return <aside className={`mission ${className}`.trim()}>
    <p className="eyebrow">MISSION CONTROL</p>
    <h2>{title}</h2>
    <p className="muted">{description}</p>
    <ObjectiveChecklist objectives={objectives} ariaLabel={objectivesLabel} className={objectivesClassName} />
    {children}
  </aside>;
}
