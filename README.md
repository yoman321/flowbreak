# Flowbreak

*Learn system design by breaking the flow.*

An interactive system-design learning app with deterministic, challenge-driven simulations.

## Run it

```bash
npm install
npm run dev
npm run test
```

Open [http://localhost:3000](http://localhost:3000) to choose a level. Level 01 uses a deterministic browser simulation to show an API acknowledging a post while a worker completes follower delivery in the background.

## API routes

- `POST /api/simulate` — Traffic Spike POC endpoint that accepts `{ workers, queue, burst, apiLimit?, clientConnected? }` and returns deterministic outcome metrics.
- `POST /api/solutions` — accepts a solution snapshot with a versioned graph (`nodes` plus directed port-to-port `edges`) and returns a POC save receipt. Swap this endpoint for Firebase/Firestore once auth is added.

## Attribution

Canvas-node explanations and the Background Delivery scenario in Tutorial, Background Delivery, and Traffic Spike are adapted from the [System Design Primer](https://github.com/donnemartin/system-design-primer) by Donne Martin, licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Flowbreak identifies the relevant Primer section for each explanation and has adapted the material for its interactive levels.
