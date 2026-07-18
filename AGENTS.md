# Flowbreak — Agent Guidance

## Project overview

**Flowbreak** is an interactive, challenge-driven way to learn system-design primitives by consequence. Its product line is: *Learn system design by breaking the flow.* The v1 flagship is the **Traffic Spike** queue level: a user builds a constrained architecture, runs a deterministic browser simulation, sees the measured outcome, and receives templated feedback.

The product teaches intuition through a playable simulation—not an LLM pretending to simulate a system. The user may choose several valid architectures; evaluate the measurable outcome, never a single expected topology.

## Direction and decision log

- `summary.md` is the canonical, human-readable product brief and decision log.
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
  page.tsx                 # root level-selection panel
  traffic-spike/page.tsx   # Level 01 Traffic Spike builder, client simulation interaction, metrics UI
  tutorial/page.tsx        # Level 00 interactive practice builder with a restricted core component kit
  globals.css              # Mission Control visual system
  layout.tsx               # app shell and metadata
  api/simulate/route.ts    # deterministic POC simulation endpoint
  api/solutions/route.ts   # POC solution-save endpoint; replace with authenticated Firestore later
summary.md                 # product brief and living decision log
README.md                  # setup, API, and attribution notes
.gitignore                 # excludes dependencies, build output, local secrets, and editor files
```

## Product guardrails

- Build a **guided, place-and-connect architecture builder**, not a general whiteboard. The component kit is client/API, backend service, queue, worker pool, database, and external API.
- Level 00 is a challenge-free Mission Control practice builder. It allows only Client, API request, Worker pool, and Database nodes, provides a basic interactive guide for building `Client → API request → Database`, and opens a System Design Primer-attributed explainer modal after each node is placed. Worker pools are optional here because the first request has no large asynchronous work. Its canvas-header Run Flow control opens a report modal that validates one continuous first-request path and reports pass/fail facts; it has no traffic simulation. Traffic Spike is Level 01 and remains the first level that must be complete end-to-end.
- Every correctly completed level must present a clear onward prompt: go to the next available level, or return to the root level-selection page when no next level is available.
- The root route is a level-selection panel that links to each available level.
- Interactable architecture objects must use direct manipulation: drag from the component tray onto the canvas, then drag nodes to reposition them. Avoid click-only placement for canvas objects.
- Each level canvas starts with the minimal connected setup required to run that scenario—nothing more and nothing less. Its bottleneck may make it pass or fail, but it must clearly not be the optimal solution.
- Connections are not components or standalone canvas objects: drag from a source component's output to any other component's input to create a directed edge, and use that source-to-target direction as the data-flow direction. Users can remove an edge directly and may create any graph topology; level evaluation determines whether it works.
- The starter graph is the only preconnected setup. Every component-tray drop adds a separate, unconnected node instance, and users may add any number of instances.
- Traffic Spike uses progressive, checkable milestones: build `Client → API → Queue → Workers → Database`, then scale to enough workers to drain queued work. After that baseline works, an optional API intake-limit constraint starts at 100 req/s and must be raised to the burst rate; before it is introduced, the API accepts the full burst.
- Reveal only the current Traffic Spike milestone title. Keep solution topology, numeric targets, and future milestones hidden until they are unlocked through play.
- The traffic-spike level is the only level that needs to be complete now. Finish it end-to-end before adding slow async work, rate-limited external API, or unreliable worker/retry levels. Do not add caching or load-balancer levels in v1.
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
