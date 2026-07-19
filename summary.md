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

The root page is a level-selection panel. The first learning path introduces one new system-design concept per level. Level 00 is a challenge-free Mission Control practice board: it uses the same builder visual language as later challenges, only offers Client, API request, Worker pool, and Database nodes, and includes a basic guided first-request flow. Each following level begins from the prior level's canonical winning graph and adds one constraint:

0. **Tutorial** — a challenge-free Mission Control practice board for placing, moving, and connecting Client, API request, Worker pool, and Database nodes. It gives a basic, step-by-step first-request guide: complete `Client → API request → Database` and `API request → Client`, then freely experiment. A Worker pool remains available but is intentionally optional: the first request has no large asynchronous work to move off the API path.

   Each newly placed Tutorial node opens a short explainer modal. The definitions are adapted from the relevant System Design Primer sections, clarify that node's role in the current flow, and include a direct source link with CC BY attribution.

   Every level uses the shared **Run Result** modal and shared canvas header. The header holds the Run control and, after a run, displays a small green check or red cross button that reopens the saved last-run result. Tutorial's Run Flow validates whether one continuous `Client → API request → Database` path exists; Traffic Spike opens the same component after its simulation. The modal presents factual pass/fail feedback, level-specific metrics, and the next action.

   Mission Control always displays the complete high-level objective list and learning guidance, never prior-run metrics or live data grids. A checked objective can require several graph or setting changes, but its title never reveals the exact solution, numeric targets, or lower-level tasks needed to finish it. Verified outcome metrics such as backlog, drops, and latency belong only in the Run Result modal.

   Every level first opens a shared Mission Briefing modal. It states the high-level problem and usual system-design approach before the learner interacts, without disclosing the level's exact graph solution.

   All placed canvas nodes use one shared component. Hovering on a node for one second opens a small, System Design Primer-attributed card with its role, level-specific live setting, and current inbound/outbound connection counts. These cards intentionally do not show prior run results.

   A correct level completion always prompts the learner onward: to the next available level when one exists, or back to level selection after the last available level. Tutorial leads to Background Delivery; learners can return to level selection to open Traffic Spike.
1. **Background delivery** — reuse `Client → API` plus an explicit `API → Client` response, then add a Worker Pool that records delivery in the Database: `API → Worker → Database`. The API can answer `202 Accepted · request received` while follower delivery completes in the background. The scenario adapts the Primer's example of a post appearing before it reaches all followers. Teaches asynchronous work and eventual completion.
2. **Traffic spike** — reuse Background Delivery's direct worker route and introduce a Queue. A fixed 500-job burst reaches the API, while each Worker Pool node processes only one job at a time. `API → Queue → Worker → Database` retains the waiting work, returns `202 Accepted` for the full burst, and drains it sequentially. Teaches queue buffering and backpressure.
3. **Load balancing** — reuse Traffic Spike's queue and worker route, but reduce each API service to a fixed 250-job intake capacity. A load balancer round-robins the fixed 500-job burst across API replicas; two complete API paths retain the full burst and return every response through the load balancer. Teaches request distribution and horizontal scaling.
4. **Rate-limited external API** — buffer work and drain it without exceeding a partner API's safe rate. Teaches smoothing and controlled throughput. This is deferred until after the load-balancing level, if time remains.
5. **Unreliable worker/service** — preserve jobs and recover from temporary failures with safe retries. Teaches durability and retry tradeoffs.

Do not add caching levels in v1. Finish each level in the Background Delivery → Traffic Spike → Load Balancing progression before adding later optional levels.

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
│  │Traffic Spike│ │ Async Work  │  │Load Balance│ shared engine)│
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
- Architecture objects use direct manipulation: users drag components from the tray onto the canvas and drag canvas nodes to reposition them. Avoid click-only placement.
- The builder shell is modular: every level composes shared left Component Tray, center Architecture Canvas, and right Mission Control modules. Those modules provide the pane structure while the level supplies its own graph state, simulation rules, and level-specific pane content.
- The shared graph model uses an abstract `ArchitectureNode` class with concrete Client, Load Balancer, API service, Queue, Worker pool, Database, and External API subclasses. Subclasses own ports, defaults, display metadata, and serializable attributes; one graph engine owns all directed port-to-port edges, exposes per-node incoming/outgoing adjacency, and is reused by every current and future builder level. React renders those node models through one shared graph canvas.
- The graph engine can also evaluate ordered directed kind paths, so a level can score whether work reaches the needed components without requiring one exact diagram layout. Level 02 uses this to recognize a complete API → Queue → Worker → Database route even when harmless extra edges remain.
- Each level canvas begins with the smallest connected setup necessary to run its scenario—nothing more and nothing less. The starter bottleneck may make the run pass or fail, but the graph must never be the level's optimized solution.
- Connections are not components or standalone canvas objects. Every node exposes draggable output and receiving input ports on all four sides, so users can start an edge and receive an edge from any direction. Click an edge to remove it; its source-to-target drag defines the data-flow direction used by graph validation and simulation routing.
- Every client-originating request must have an explicit directed response flow back to that client. Responses are not draggable components: learners draw an API service output to the Client input, or in the load-balancing level draw `API → Load Balancer → Client`; those return edges render green. For example, once an API hands asynchronous work to a worker, it can return `202 Accepted` to the client while the worker continues in the background. Level validation must fail request flows that leave the client without that return path.
- While dragging an existing canvas node, a bottom-canvas trash target appears. Dropping the node on it deletes that node and all of its attached connections; tray-item and connection drags never show the target.
- The starter graph is the only preconnected setup. Every tray drop creates a distinct, unconnected component instance, and users may add any number of instances and connect them in any topology before running the level.
- Background Delivery is implemented now as Level 01. It begins with `Client → API`, `API → Client`, and an unconnected Database; the learner adds a Worker Pool branch: `API → Worker → Database`. The API displays `202 Accepted · request received` once it has the fast request path and return edge; an 8-second follower-delivery task is completed by the worker after that acknowledgement. Mission Control keeps only learning guidance and objectives; the Run Result modal owns all acknowledgement and delivery metrics. The full high-level objective list is visible without exposing the solution graph.
- Traffic Spike is implemented as Level 02. The API receives a fixed 500-job burst, and the bounded queue also holds 500 jobs. Each Worker Pool node has one active-job slot and completes one job per simulated second. The starter direct path can begin only one job on its single worker and returns `503` for the other 499 because they have nowhere safe to wait. A complete queue path preserves all 500 jobs, returns `202 Accepted`, reaches a maximum waiting backlog of 499 with one worker, and drains in 500 simulated seconds. These fixed capacities are Flowbreak teaching rules; the Primer supports queues for decoupling producer and worker rates and bounded-queue back pressure, not these exact numbers.
- Load Balancing is implemented as Level 03. It starts from Traffic Spike's complete queue path, but each API service can accept only 250 jobs from the fixed 500-job burst. The learner replaces the direct client/API return path with a load balancer, connects at least two complete `Load Balancer → API → Queue → Worker → Database` routes, and returns each API response through that load balancer. A remaining direct `Client → API` or `API → Client` bypass invalidates the run, because the load balancer must be the request and response entry point. The deterministic round-robin rule sends 250 jobs to each of two API replicas; all 500 are queued, receive `202 Accepted`, and drain through the existing worker path. The figures and round-robin policy are Flowbreak teaching rules; the Primer supports load balancing across computing resources and horizontal scaling, not these exact settings.
- A solution is a validated graph of component types, settings, and directed connections. The simulation runs in the browser and models routing, capacity, queue backlog, retries, dropped work, latency, and downstream throttling.
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
2. Build **Background Delivery** end-to-end: builder, graph validation, deterministic browser simulation, scoring, and static feedback.
3. Build **Traffic Spike** with queue buffering and serial workers.
4. Build Load Balancing with API replicas and deterministic round-robin dispatch.
5. Only then, if time remains, add rate-limited external API and unreliable-worker levels.

### Current proof-of-concept status

- The initial Flowbreak scaffold is intentionally a lightweight, unauthenticated proof of concept: it provides Tutorial plus browser-only Background Delivery, Traffic Spike, and Load Balancing simulations, draggable nodes, metric feedback, and a temporary `/api/solutions` endpoint.
- Levels 02 and 03 have dedicated browser-side simulation modules with unit tests. They compute routing, serial worker capacity, accepted and rejected responses, bounded queue backlog, latency, drain time, and Level 03's round-robin API distribution without calling a server route. The former `/api/simulate` POC endpoint has been retired.
- Mission Control is intentionally free of live metric cards in every level. It presents the mission and objectives only; verified backlog, drops, latency, and related facts appear after a run in the shared Run Result modal.
- The current persistence endpoint is a placeholder, not the final architecture. Firebase Authentication/Firestore, immutable persisted snapshots, and the shared browser-side tick simulation remain the next implementation work.
- The prototype makes no LLM calls.

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

Polish the Level 03 Load Balancing simulation and its demo path. Continue toward Firebase-backed progress, static feedback, and an optional cached final debrief; rate-limited external APIs and unreliable services are later optional levels.

---

## UI/UX Direction — Non-Negotiable

Use the **FigJam Flowchart / diagramming template** as the single interaction reference for the app's architecture builder. Do not mix unrelated visual styles or use generic AI-chat UI patterns.

Adapt it into a custom **Mission Control** design system:

- A precise, snap-to-grid system canvas with constrained component nodes and directional connections.
- A narrow component tray on the left, a mission and objective panel on the right, and an event timeline at the bottom. Verified metrics appear only in the post-run result modal.
- Deep graphite/navy canvas; warm off-white panels; blue for flow, amber for pressure, red for failure, and green for resolution.
- Use custom icons, typography, colors, and layout. Do not copy FigJam branding, screenshots, assets, or code.
- Keep all animation tied to real simulation state. No decorative motion, glassmorphism, purple gradients, or persistent AI-chat UI.
- Use Factorio only as a behavioral reference: make flow, bottlenecks, and recovery visually obvious. Do not reuse its visual assets.
