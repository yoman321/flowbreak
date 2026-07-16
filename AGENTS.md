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
  page.tsx                 # Traffic Spike builder, client simulation interaction, metrics UI
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
- Interactable architecture objects must use direct manipulation: drag from the component tray onto the canvas, then drag nodes to reposition them. Avoid click-only placement for canvas objects.
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
