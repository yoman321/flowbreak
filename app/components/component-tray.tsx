import type { ReactNode } from "react";

export function ComponentTray({ title, description, children }: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return <aside className="tray">
    <p className="eyebrow">COMPONENT KIT</p>
    <h2>{title}</h2>
    <p className="muted">{description}</p>
    {children}
  </aside>;
}
