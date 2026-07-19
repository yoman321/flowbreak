# Flowbreak

*Learn system design by breaking the flow.*

An interactive system-design learning app with deterministic, challenge-driven simulations.

## Run it

```bash
npm install
npm run dev
npm run test
```

Open [http://localhost:3000](http://localhost:3000) to choose a level. Level 01 shows an API acknowledging a post while a worker completes follower delivery in the background. Level 02 simulates a 500-job burst: a bounded queue preserves waiting jobs while every worker handles one job at a time. Level 03 continues that flow: a deterministic round-robin load balancer distributes the burst across API replicas before it reaches the queue.

## API routes

- `POST /api/solutions` — accepts a solution snapshot with a versioned graph (`nodes` plus directed port-to-port `edges`) and returns a POC save receipt. Swap this endpoint for Firebase/Firestore once auth is added.

## Attribution

Canvas-node explanations and the Background Delivery, Traffic Spike, and Load Balancing scenarios are adapted from the [System Design Primer](https://github.com/donnemartin/system-design-primer) by Donne Martin, licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Flowbreak identifies the relevant Primer section for each explanation and has adapted the material for its interactive levels.
