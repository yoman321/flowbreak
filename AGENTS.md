# Flowbreak — Agent Guidance

## Project overview

**Flowbreak** is an interactive, challenge-driven way to learn system-design primitives by consequence. Its product line is: *Learn system design by breaking the flow.* Its first challenge is **Background Delivery**, where a user moves slow work to a worker; **Traffic Spike** is Level 02 and builds on that path.

The product teaches intuition through a playable simulation—not an LLM pretending to simulate a system. The user may choose several valid architectures; evaluate the measurable outcome, never a single expected topology.

## Direction and decision log

- `summary.md` is the canonical, human-readable product brief and decision log.
- Implement the product behavior and level rules described in `summary.md`; do not introduce, infer, or enforce behavior outside that source of truth. Change it only after an explicit user decision, and record that decision in `summary.md` in the same task.
- When a system-design concept, flow, or implementation detail is uncertain, consult the relevant System Design Primer source before making a change or claiming that the Primer supports a behavior. Clearly distinguish Primer guidance from Flowbreak-specific level rules.
- **Whenever a product-direction decision is made or changed, update `summary.md` in the same task.** Examples: scenario scope, component kit, evaluation rules, persistence, UI direction, stack, LLM use, or rollout order.
- **Whenever the project architecture or file structure changes, update this `AGENTS.md` in the same task**—especially the Architecture and Current file map sections.
- Keep this file focused on durable implementation rules. Add historical context and product rationale to `summary.md`.
- Do not change the product direction without an explicit user decision. If a safe implementation assumption is needed, state it clearly.

## Setup and commands

```bash
npm install
npm run dev
npm run build
```

- Use `npm run dev` (or `npx next dev`) to run the local Next.js binary; do not expect a globally installed `next` command.
- It is always permitted to start or gracefully restart the local development server with `npm run dev` for verification or recovery. Do not ask the user for permission before doing so.
- **After every code or configuration change, gracefully restart the local development server with `npm run dev` before handing off.**
- Start or restart `npm run dev` directly; do not request user approval for this routine local development action.
- Use `npm run build` as the required verification command.
- **After every code or configuration change, run `npm run build` and fix any build/type error before handing off.**

## Architecture

- **Next.js App Router** provides the UI and server routes.
- The deterministic simulation runs entirely in the browser. It must model routing, capacity, backlog, drops, latency, retries/throttling when applicable, and evaluation facts.
- Server routes are for authenticated persistence and an optional final LLM debrief only. Never expose provider credentials to the browser.
- Firebase Authentication + Firestore are the intended production persistence layer for user-owned drafts, solution snapshots, progress, and cached debriefs. The current `/api/solutions` route is a deliberately lightweight POC stub.
- Persist immutable completed solution snapshots plus key metrics: pass/fail, maximum backlog, dropped jobs, average/peak latency, processed jobs, retries, rate-limit violations, utilization, and timeline events.

### Current file map

```text
app/
  components/architecture-canvas.tsx # shared center Architecture pane shell for builder levels
  components/architecture-graph-canvas.tsx # shared graph interaction, edge rendering, and node drag/drop canvas
  components/architecture-header.tsx # shared canvas title, run control, and last-run result trigger
  components/canvas-node.tsx # shared draggable canvas node with delayed hover information card
  components/canvas-trash-target.tsx # shared node-only drag target that deletes a node and its connections
  components/component-tray.tsx # shared left component-kit pane shell for builder levels
  components/level-intro-modal.tsx # shared first-visit mission briefing for each level
  components/mission-control-panel.tsx # shared right Mission Control pane shell for builder levels
  components/objective-checklist.tsx # shared high-level objective list for every level
  components/run-result-modal.tsx # shared pass/fail report modal for every completed level run
  lib/architecture/nodes.ts # abstract ArchitectureNode model plus concrete Client, Load Balancer, API, Queue, Worker, Database, and External API subclasses
  lib/architecture/graph.ts # serializable graph snapshot and directed port-edge operations
  lib/architecture/graph.test.ts # graph invariants and concrete-node hydration tests
  lib/architecture/use-architecture-graph.ts # React state bridge for the shared architecture graph
  lib/simulations/traffic-spike.ts # deterministic browser-only Level 02 queue and serial-worker simulation
  lib/simulations/traffic-spike.test.ts # Level 02 capacity, backlog, and response simulation tests
  lib/simulations/load-balancing.ts # deterministic browser-only Level 03 round-robin API replica simulation
  lib/simulations/load-balancing.test.ts # Level 03 capacity, response-path, and dispatch simulation tests
  background-delivery/page.tsx # Level 01 async worker challenge, browser-only delivery simulation
  page.tsx                 # root level-selection panel
  traffic-spike/page.tsx   # Level 02 Traffic Spike builder, browser-only queue simulation, and metrics UI
  load-balancing/page.tsx  # Level 03 Load Balancing builder, browser-only API capacity simulation, and metrics UI
  tutorial/page.tsx        # Level 00 interactive practice builder with a restricted core component kit
  globals.css              # Mission Control visual system
  layout.tsx               # app shell and metadata
  api/solutions/route.ts   # POC solution-save endpoint; replace with authenticated Firestore later
summary.md                 # product brief and living decision log
README.md                  # setup, API, and attribution notes
.gitignore                 # excludes dependencies, build output, local secrets, and editor files
```

## Product guardrails

- Build a **guided, place-and-connect architecture builder**, not a general whiteboard. The component kit is client, load balancer, API service, queue, worker pool, database, and external API.
- Level 00 is a challenge-free Mission Control practice builder. It allows only Client, API request, Worker pool, and Database nodes, provides a basic interactive guide for `Client → API request → Database` plus `API request → Client`, and opens a System Design Primer-attributed explainer modal after each node is placed. Worker pools are optional here because the first request has no large asynchronous work. Its canvas-header Run Flow control opens the shared result modal, which validates one complete request/response flow and reports pass/fail facts; it has no traffic simulation.
- Level 01 Background Delivery starts from `Client → API` and `API → Client`, with a Database ready for the worker's completion record, and introduces one Worker Pool. It uses the System Design Primer's post-delivery example: the API visibly acknowledges that it received the post while a worker delivers it to followers asynchronously. A passing design preserves the fast API acknowledgement and routes delivery through `API → Worker → Database`; it does not require a direct API-to-Database edge. It is deterministic browser code, never a live API call.
- Every correctly completed level must present a clear onward prompt: go to the next available level, or return to the root level-selection page when no next level is available.
- The root route is a level-selection panel that links to each available level.
- Interactable architecture objects must use direct manipulation: drag from the component tray onto the canvas, then drag nodes to reposition them. Avoid click-only placement for canvas objects.
- Each level canvas starts with the minimal connected setup required to run that scenario—nothing more and nothing less. Its bottleneck may make it pass or fail, but it must clearly not be the optimal solution.
- Every architecture object is an `ArchitectureNode` subclass. Client, API service, queue, worker pool, database, and external API nodes extend the same base model, expose input/output ports, and carry serializable attributes; future node types must register a subclass instead of duplicating canvas behavior.
- Connections are not components or standalone canvas objects: the shared graph engine owns directed port-to-port edges. Every node exposes draggable output and receiving input ports on its top, right, bottom, and left sides, so an edge can start and end from any node direction. Users can remove an edge directly and may create any graph topology that respects port direction, while level evaluation determines whether it works.
- Every client-originating request needs an explicit directed response path back to the Client. Direct API-to-Client responses remain valid; Load Balancing uses `API → Load Balancer → Client`. Level validation must reject request flows that leave the client without a response. Response edges render green; responses are never draggable components.
- While a canvas node is dragged, show the shared bottom-of-canvas trash target. Dropping a node there removes it and every incident connection; it must not appear for tray items or connection drags.
- All placed canvas nodes use the shared canvas-node component. After one second of hover, it shows an attributed role description plus component-specific live settings and inbound/outbound connection counts; never show prior run-result metrics in this card.
- Every builder level composes the shared component-tray, architecture-canvas, mission-control-panel, and objective-checklist modules. Mission Control contains only learning guidance and high-level objectives; never render prior-run metrics or live metric grids there. Every objective list shows all high-level outcomes from the start; do not expose solution topology, numeric targets, or the lower-level changes required to finish one. Verified outcome metrics belong only in the Run Result modal.
- Every builder level uses the shared architecture-header for its canvas title and Run control. After an actual run, it shows a green check or red cross icon that reopens the saved, verified last-run result modal.
- Every level opens with the shared level-intro-modal before the learner can interact. It explains the high-level problem and normal approach without revealing the exact graph solution, and links to the System Design Primer source.
- All level outcomes use the shared run-result-modal component. It opens immediately after a run and receives only verified level facts; level-specific actions such as saving or advancing are supplied by the level.
- The starter graph is the only preconnected setup. Every component-tray drop adds a separate, unconnected node instance, and users may add any number of instances.
- Level 02 Traffic Spike reuses Background Delivery's direct worker route and introduces queue buffering. Its fixed 500-job burst fits the API and bounded queue, while every Worker Pool node processes exactly one job at a time at one job per simulated second. Without a queue, the starter's single worker can begin one job and the remaining 499 receive `503`; a complete `API → Queue → Worker → Database` path retains all jobs, returns `202`, and drains them. The fixed figures are Flowbreak rules, not a Primer prescription.
- Level 03 Load Balancing reuses Traffic Spike's queue and worker path, but each API service accepts at most 250 jobs of the fixed 500-job burst. A passing design uses one Load Balancer and at least two complete API routes, round-robins the burst across those replicas, routes the API replies through the Load Balancer to the Client, and retains all jobs through `API → Queue → Worker → Database`. A remaining direct Client/API request or response bypass invalidates the Level 03 run. These figures and round-robin are Flowbreak rules, not a Primer prescription. Do not add caching levels in v1.
- Score factual results, not diagram similarity. Multiple configurations can pass if they meet the level’s rules.
- Required runtime LLM calls: **zero**. Static intros and metric-driven feedback are preferred. An LLM debrief is optional only after a completed run, must use verified metrics, cannot decide pass/fail, and must be cached per identical solution snapshot.
- Keep user data owner-scoped once Firebase is connected; verify Firebase auth on the server before reading or writing private records.
- Attribute any content derived from System Design Primer under CC BY 4.0 in the README/app credits. Do not copy copyrighted textbook content into the app.

## UI and code conventions

- Follow the custom **Mission Control** system: deep graphite/navy canvas, warm off-white panels, blue for flow, amber for pressure, red for failure, green for resolution.
- Use FigJam diagramming only as an interaction reference. Do not copy its branding, assets, screenshots, or code. Factorio is behavioral inspiration only; do not use its visual assets.
- Keep motion meaningful: it must reflect simulation state. Avoid decorative motion, glassmorphism, purple gradients, and persistent chat UI.
- Use TypeScript with strict typing. Prefer small, explicit React state and deterministic functions over hidden behavior or unnecessary libraries.
- Keep simulation rules separated from presentation as the project grows. New levels should plug their rules and visuals into the shared engine rather than duplicate the loop.
- Preserve user changes and avoid unrelated refactors. Keep API request/response shapes explicit and validate untrusted request data before production persistence.

## Delivery expectations

- Make the smallest change that fully satisfies the task.
- Update `README.md` when setup, commands, public API routes, or required environment variables change.
- Report what changed, what was verified, and any intentional POC limitation (for example, an in-memory or stub persistence route).
