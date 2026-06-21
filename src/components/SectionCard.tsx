import type { ReactNode } from "react";

export function SectionCard({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow?: string;
  children: ReactNode;
}) {
  return (
    <section className="section-card">
      {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
      <h2>{title}</h2>
      {children}
    </section>
  );
}
