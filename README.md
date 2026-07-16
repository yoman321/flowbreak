# System Design Sandbox

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

The project concept may reference the [System Design Primer](https://github.com/donnemartin/system-design-primer), licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). This prototype does not reproduce Primer content.
