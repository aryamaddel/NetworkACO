# Network ACO — static routing simulator

A minimal, browser-only research presentation. A delivery-route scenario uses **TSPLIB berlin52**, a published 52-location traveling salesman benchmark. Two live route maps compare sequential evaporating ACO and a network-based adaptation of Shimizu & Mori's [2024 paper](https://arxiv.org/abs/2410.09059v1). A recent-only control, replay slider, connection diagram, reproducible seeds, JSON export and a 20-seed benchmark support the comparison.

The old `reproduction/` Python demo has been removed. There is no Python requirement, server-side compute, external font, CDN, build system, or runtime dependency. One system sans-serif font is used throughout.

## Preview

Requires Node.js 20+ for the development server and tests; the site itself requires only a modern browser.

```sh
npm run dev
```

Open http://127.0.0.1:4173. Use an HTTP server rather than opening `index.html` directly; ES modules and Web Workers require HTTP. `PORT` can override the port.

## Deploy to Vercel

Import this repository into Vercel with:

- Framework preset: **Other**
- Root directory: repository root
- Build command: **leave empty**
- Output directory: **dist** (also specified in `vercel.json`)
- No environment variables required

Alternatively, upload/serve the contents of `dist/` with any static host. The app computes tours locally in module Web Workers. No deployment was made by the agent.

## Presentation walkthrough

1. Explain the task: visit all 52 stops once, then return to the starting stop. Shorter is better.
2. Click **Run simulation**. The default seed 26 is explicitly selected to illustrate a benefit: network ACO finds **7,706** versus simple ACO's **7,906**, a **2.53%** shorter tour at 2,000 attempts each.
3. Pause or replay to show route improvement. The connection diagram joins earlier attempts, not geographic stops. It zooms to include all selected teachers and at least the previous 80 ants.
4. Scroll to the 20-seed comparison. Do not imply the illustrative seed proves general superiority.
5. Try other seeds or **Test 20 new seeds**. Other runs can favor the baseline. Export a run to preserve its parameters and snapshots.

The benchmark coordinates are a real published instance, but the van story is illustrative: this is not live Berlin road routing. Distances are rounded Euclidean benchmark units, not kilometres. The [verified optimum is 7,542](https://comopt.ifi.uni-heidelberg.de/software/TSPLIB95/tsp/TSP-BEST.html).

## What was measured

Settings: 2,000 route evaluations per method, r=20, pheromone exponent 1, distance exponent 2, pheromone floor 1e-6. No local search or elite-route deposits. Initial routes and route-decision random streams are paired; network selection has a separate random stream. Every seed gets its own network.

Held-out seeds 21–40 (`dist/benchmark.json`):

| Method | Mean best distance |
|---|---:|
| Simple ACO | 7,800.90 |
| Network ACO | 7,774.80 |
| Recent-only control | 7,784.65 |

Network ACO wins 10 and loses 10 paired comparisons against simple ACO. Its mean route is **0.33% shorter**, but the approximate paired 95% t interval for saved distance is **[-27.6, 79.8]** units. This does **not** establish a reliable advantage. It provides an honest presentation of a beneficial example alongside inconclusive aggregate evidence.

Exploration before the held-out test: omega=-0.9 was tried on seeds 1–20 (network mean 7,844.5 versus baseline 7,813.7); omega values -0.9999, -0.99, -0.5, and 0 were then tried on seeds 1–10. Network means were 7,763.6, 7,810.3, 7,984.9, and 8,038.6 respectively, versus baseline mean 7,839. The -0.9999 setting was selected before evaluating seeds 21–40. The default presentation seed 26 was selected afterward and is labelled as illustrative. Live benchmark batches start at seeds 41–60 and advance by 20 within the session; they use the currently selected budget and omega.

## Implementation and paper fidelity

- **Simple ACO:** a sequential Ant System variant. Each tour deposits 1/L on its undirected edges; shared pheromone above the common floor evaporates by 5% after each ant. This is a transparent simple baseline, not a tuned state-of-the-art solver.
- **Network ACO:** selects 20 distinct predecessors by successive weighted sampling without replacement, using max(20 + omega × out-degree, 0). Pheromone is rebuilt from those tours, with the same inverse-length deposits and floor. The first 21 nodes form a chronological complete graph; their tours ignore pheromone.
- **Recent-only control:** same local-deposit model, but references exactly the preceding 20 ants. It isolates the reference-network change from the change between global exponential fading and local finite memory.
- All routes sample the next unvisited city with probability proportional to pheromone^1 × (1/distance)^2. Shared warm-up ignores pheromone for the first 21 ants.
- The paper uses binary Ising decisions, a linear decision rule and Boltzmann weights. Only its reference-network mechanism is carried over; the TSP transition rule and deposits are adaptations. The paper did not report these routing results. Equal evaluation budgets do not imply equal compute time.
- The optimum is used to display gaps and validate outputs only. It is never passed into the route-construction algorithm.

## Checks and reproduction

```sh
npm test
npm run benchmark -- -0.9999 20 2000 21
```

The benchmark arguments are omega, seed count, route budget, and starting seed. Output goes to stdout so recorded results are not silently overwritten. Tests cover closed tours, TSPLIB rounding, graph invariants, reference caps, deterministic replay, paired warm-up, a zero-pheromone control, valid parameters, and a recorded benchmark row.

`dist/solver.js` is shared by Node tests and the browser Worker. `dist/benchmark.json` contains all recorded held-out scores; new batches are actually computed in the browser rather than generated from canned numbers. Exported simulation JSON includes snapshots for all three methods. Browser QA covers run, pause/resume, reset, replay, export, benchmark and responsive layout.

Data coordinates: [berlin52.tsp mirror](https://github.com/pdrozdowski/TSPLib.Net/blob/master/TSPLIB95/tsp/berlin52.tsp), attributed there to Groetschel. Primary benchmark definition: [TSPLIB](https://comopt.ifi.uni-heidelberg.de/software/TSPLIB95/).
