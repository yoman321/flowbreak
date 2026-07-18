export function LevelIntroModal({ level, title, problem, approach, sourceHref, onClose }: {
  level: string;
  title: string;
  problem: string;
  approach: string;
  sourceHref: string;
  onClose: () => void;
}) {
  return <div className="level-intro-modal" role="presentation">
    <section className="level-intro-card" role="dialog" aria-modal="true" aria-labelledby="level-intro-title">
      <p className="eyebrow">{level} · MISSION BRIEFING</p>
      <h2 id="level-intro-title">{title}</h2>
      <div className="level-intro-section problem"><span>THE PROBLEM</span><p>{problem}</p></div>
      <div className="level-intro-section approach"><span>COMMON APPROACH</span><p>{approach}</p></div>
      <a href={sourceHref} target="_blank" rel="noreferrer" className="level-intro-source">ADAPTED FROM · SYSTEM DESIGN PRIMER ↗</a>
      <button className="level-intro-start" onClick={onClose}>BEGIN LEVEL</button>
    </section>
  </div>;
}
