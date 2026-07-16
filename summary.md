# Flowbreak — Project Summary

## The Hackathon

**OpenAI Build Week** (openai.devpost.com). Build with Codex / GPT-5.6.
- **Submission deadline:** July 21st, 2026, 5:00 PM PT
- **Requirements:** public repo with README + setup instructions, a Codex session ID showing where the core was built, and a 3-minute demo video on YouTube.
- **Tracks:** the project fits "Apps for Your Life" (learning/education).
- **Budget constraint:** ~$100 in Codex credits, so the design must minimize LLM API usage.

---

## The Idea

An **interactive, challenge-driven sandbox for learning system design concepts by consequence.**

Instead of explaining a concept in text (passive) or quizzing a full design (crowded space), each topic is a **playable level**:

1. A short "why this exists" intro, framed around the *failure the concept prevents*.
2. A **challenge with a concrete goal** ("make the queue overflow", "keep latency under 200ms", "survive a node failure").
3. A **live, deterministic simulation** the user manipulates with controls (sliders, buttons).
4. Win/lose detection.
5. A debrief tying what they did back to the real-world principle.

The user builds intuition because they *feel* the tradeoff — they flood a queue and watch it back up — rather than being told about it.

---

## Why This Is Differentiated

### vs. a raw Claude/ChatGPT chat box
A chat box can *describe* a queue; it cannot let you **flood one and watch messages pile up in real time**. The value is:
- **Enforced method** — no "just give me the answer" button; the structure is the product.
- **A real running simulation** — deterministic, visual, instant, honest.
- **Curated progression** — removes the "where do I even start" paralysis.
- (Optional, if extended) persistent tracking of a user's recurring weaknesses across sessions — something a stateless chat box structurally can't do.

### vs. Hello Interview (the main competitor)
Hello Interview simulates the *interview* — you assemble a design you already understand, and get feedback against an answer key **after** you finish. Gaps it leaves open:
- It assumes you already understand the **primitives**. It has no "I don't get *why* a queue exists yet" mode.
- Its feedback is **reactive** (end-of-round), not a live, interactive simulation.
- It's a paid product; this is open, grounded, and free to run.

**Positioning:** *Hello Interview trains you to perform a design you already understand. This trains the understanding itself — by letting you break the concept and watch what happens.*

---

## Source of Truth (Legal)

- **The System Design Primer** (github.com/donnemartin/system-design-primer) is licensed **CC BY 4.0** — free to use, adapt, and redistribute, **including commercially**, with **attribution**.
- **Obligation:** credit the author, link the license, note any changes. Put this in the README and app credits.
- The app's own code can be **MIT-licensed** (encouraged by the hackathon). The two licenses coexist: MIT for your code, CC BY attribution for primer-derived content.
- **Do NOT** embed a copyrighted textbook into the app — that's redistribution and not safe for a published submission.
- Other clean sources: official docs (Redis, Kafka, Postgres), company engineering blogs (link/cite, don't copy wholesale), Wikipedia (CC, attribute).

---

## The Topics (build in this order)

Build **one level fully — intro, builder, simulation, evaluation, debrief, persistence, and polish — before starting the next.** A single polished level is a winning submission; three rough ones are not. Stop when time runs out.

The first learning path stays focused on the **message queue** as a reusable system-design primitive. Each level uses the same guided component kit and deterministic engine, but adds a new constraint:

1. **Traffic spike** (flagship) — absorb a request burst without dropping jobs, then drain the backlog. Teaches backpressure and scaling workers.
2. **Slow asynchronous work** — move expensive work off the request path to keep user-facing latency below target. Teaches decoupling and eventual completion.
3. **Rate-limited external API** — buffer work and drain it without exceeding a partner API's safe rate. Teaches smoothing and controlled throughput.
4. **Unreliable worker/service** — preserve jobs and recover from temporary failures with safe retries. Teaches durability and retry tradeoffs.

Do not add load balancer or caching levels in v1. Finish the traffic-spike level end-to-end first, then add the other queue levels only if time remains.

---

## Architecture

### Core principle
**LLM for *meaning*, deterministic code for *behavior*.**
The simulation is real browser code, not the LLM pretending to be a simulator. This makes it fast, honest (no hallucination), free to run, and impossible to break mid-demo.

### Components

```
┌─────────────────────────────────────────────────────────────┐
│                     NEXT.JS APPLICATION                       │
│          Client-side simulation + server-side routes          │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │              SHARED SANDBOX ENGINE (build once)          │  │
│  │  - Deterministic simulation loop (~10 ticks/sec)        │  │
│  │  - Clock / tick management                              │  │
│  │  - Visualization refresh                                │  │
│  │  - Win/lose (challenge goal) detection                  │  │
│  │  - NO LLM CALLS                                         │  │
│  └────────────────────────────────────────────────────────┘  │
│          ▲              ▲              ▲                       │
│          │              │              │  (each plugs its own  │
│  ┌───────────┐  ┌──────────────┐  ┌─────────┐  rules into the │
│  │Traffic Spike│ │ Async Work  │  │Rate Limit│ shared engine)  │
│  │   level    │  │  level      │  │  level   │                  │
│  │ (rules +  │  │ (rules +     │  │(rules + │                  │
│  │  visuals) │  │  visuals)    │  │ visuals)│                  │
│  └───────────┘  └──────────────┘  └─────────┘                  │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │           CONTENT LAYER (mostly static)                 │  │
│  │  - Intro text per level  → PRE-GENERATED, cached/static │  │
│  │  - Debrief per outcome   → TEMPLATED (0 calls)          │  │
│  │                            or 1 optional dynamic call    │  │
│  │  - Grounded in System Design Primer (CC BY, attributed) │  │
│  └────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### V1 implementation decisions

- Build a **guided architecture builder**, not a free-form whiteboard. Users place and connect a constrained component kit: **client/API, backend service, queue, worker pool, database, and external API**.
- A solution is a validated graph of component types, settings, and allowed directed connections. The simulation runs in the browser and models routing, capacity, queue backlog, retries, dropped work, latency, and downstream throttling.
- Score the factual outcome, **not an expected topology**. Multiple designs and action sequences may succeed if they satisfy the level's measurable rules.
- Each completed run records pass/fail, maximum backlog, dropped jobs, average and peak latency, processed jobs, retries, rate-limit violations, component utilization, and key timeline events.
- Use **Next.js** for the frontend and server routes; use **Firebase Authentication** and **Firestore** for accounts, user-owned drafts, completed solution snapshots, level progress, and cached debriefs. Restrict Firestore records to their owner with security rules.
- Keep the simulation client-side. Next.js server routes verify Firebase users, persist data, and optionally request a final LLM debrief without exposing provider credentials.

### Data / control flow per level
```
User opens level → show static scenario intro (0 calls)
   → place/connect components and set their relevant settings
   → validate the graph → run deterministic browser simulation (0 calls)
   → evaluate outcome and show metric-driven, templated feedback
   → save immutable completed solution snapshot and progress to Firestore
   → optionally request one final LLM debrief from calculated facts
   → cache and display that debrief for the identical solution snapshot
```

### Build order (protects the week)
1. Build the **shared sandbox engine** once.
2. Build the **traffic-spike queue level end-to-end**: builder, graph validation, simulation, scoring, persistence, static feedback, and optional debrief.
3. Only then, if time remains, add the other three queue levels.

---

## LLM API Call Budget

The architecture is deliberately near-zero-runtime-cost.

| Element | Calls | Notes |
|---|---|---|
| Intro text (per level) | ~4 total, **one-time** | Pre-generate during build, ship as static files → **0 runtime calls** |
| Simulation / gameplay | **0** | Pure deterministic browser code |
| Live feedback | **0** | Use calculated metrics and static templates |
| Final debrief | **0** or **1 per unique completed solution** | Only after explicit user request; cache by solution snapshot |

**Recommended design:** run with **zero required runtime calls**. The LLM is an optional final explanation, requested only after a completed run. It receives verified simulation facts and can never determine pass/fail.

- **Fully static:** 0 runtime calls. $100 untouched. Also a *selling point*: "the simulation is real code; the LLM authored the content offline."
- **Lightly dynamic:** at most one small call per distinct completed solution, then cached for future viewing.

The main real cost is Codex usage **while building**, which is modest for a project this size. Frugality is a feature to highlight to judges.

---

## Recommended Tech Stack

- **Next.js** for the frontend and server routes.
- **Client-side deterministic simulation**; Next.js routes only handle authenticated persistence and optional debrief generation.
- **Firebase Authentication** for accounts and **Firestore** for user-owned drafts, completed solution snapshots, level progress, and cached debriefs.
- Deploy to **Vercel**; keep Firebase and LLM credentials in server-side environment variables.
- **MIT license** on the repo; **CC BY attribution** for primer-derived content in README + credits.

---

## Submission Checklist

- [ ] Public GitHub repo with README (setup + run instructions)
- [ ] MIT license on your code
- [ ] CC BY attribution for System Design Primer content
- [x] Built core with Codex / GPT-5.6 — '019f6814-21fa-7120-89ff-359c6dcb4fae'. Before submission, run `/feedback` and replace this note with the session ID it provides.
- [ ] Runnable demo (deployed link or clear local instructions)
- [ ] 3-minute demo video on YouTube — show a user *breaking* a queue and watching the consequence (the memorable "aha" beat)
- [ ] Pick the track ("Apps for Your Life") and write the positioning paragraph
- [ ] Submit by **July 21st, 5:00 PM PT**

---

## Next Step

Scaffold the shared engine + the complete **traffic-spike queue level** as a working prototype: guided component builder, graph validation, deterministic simulation, outcome scoring, Mission Control visualization, Firebase-backed progress, static feedback, and an optional cached final debrief. Then extend it with the remaining queue levels.

---

## UI/UX Direction — Non-Negotiable

Use the **FigJam Flowchart / diagramming template** as the single interaction reference for the app's architecture builder. Do not mix unrelated visual styles or use generic AI-chat UI patterns.

Adapt it into a custom **Mission Control** design system:

- A precise, snap-to-grid system canvas with constrained component nodes and directional connections.
- A narrow component tray on the left, a challenge and live-metrics panel on the right, and an event timeline at the bottom.
- Deep graphite/navy canvas; warm off-white panels; blue for flow, amber for pressure, red for failure, and green for resolution.
- Use custom icons, typography, colors, and layout. Do not copy FigJam branding, screenshots, assets, or code.
- Keep all animation tied to real simulation state. No decorative motion, glassmorphism, purple gradients, or persistent AI-chat UI.
- Use Factorio only as a behavioral reference: make flow, bottlenecks, and recovery visually obvious. Do not reuse its visual assets.
