# Flowbreak

*Learn system design by breaking the flow.*

A proof of concept for learning message queues through a deterministic traffic-spike simulation.

## Run it

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Add a queue, increase workers, and run the traffic spike.

## API routes

- `POST /api/simulate` — accepts `{ workers, queue, burst }` and returns deterministic outcome metrics.
- `POST /api/solutions` — accepts a solution snapshot and returns a POC save receipt. Swap this endpoint for Firebase/Firestore once auth is added.

## Attribution

Tutorial component explanations are adapted from the [System Design Primer](https://github.com/donnemartin/system-design-primer) by Donne Martin, licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Flowbreak links to the relevant Primer section for each explanation and has adapted the material for this interactive tutorial.
