import type { ReactNode } from "react";

export function ArchitectureCanvas({ header, children }: {
  header: ReactNode;
  children: ReactNode;
}) {
  return <section className="canvas-panel">
    {header}
    {children}
  </section>;
}
