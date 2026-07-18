const levels = [
  { number: "00", title: "Tutorial", detail: "Build your first request flow.", href: "/tutorial", state: "AVAILABLE" },
  { number: "01", title: "Background Delivery", detail: "Keep slow follower delivery off the request path.", href: "/background-delivery", state: "AVAILABLE" },
  { number: "03", title: "Traffic Spike", detail: "Protect workers from a burst.", href: "/traffic-spike", state: "AVAILABLE" },
];

export default function LevelSelect() {
  return (
    <main className="level-select">
      <header className="topbar">
        <a className="brand" href="/">FLOW<span>BREAK</span></a>
        <div className="level-pill"><i /> SELECT A LEVEL</div>
      </header>
      <section className="level-select-panel" aria-labelledby="level-select-title">
        <div className="launch-briefing">
          <p className="eyebrow">MISSION CONTROL · LEARNING PATH</p>
          <h1 id="level-select-title">Choose a flow<br />to break.</h1>
          <p className="select-lede">Build intuition by watching a system bend under pressure, then repair it one constraint at a time.</p>
          <div className="launch-rule"><span>AVAILABLE NOW</span><b>03 levels</b></div>
        </div>
        <div className="level-cards">
          {levels.map((level) => <a key={level.number} className={`level-card level-${level.number}`} href={level.href}>
            <div className="level-card-head"><span className="level-number">LEVEL {level.number}</span><span className="level-state">{level.state}</span></div>
            <h2>{level.title}</h2>
            <p>{level.detail}</p>
            <em>OPEN LEVEL <span>→</span></em>
          </a>)}
        </div>
      </section>
    </main>
  );
}
