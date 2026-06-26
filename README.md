<h1 align="center">🌱 Rhyza</h1>

<p align="center">
  <strong>A Human Intent Network</strong> — an organizational learning platform where
  people discover purpose, make progress, and experience play.
</p>

<p align="center">
  <em>A botanical garden where ideas are seeds that grow into collective knowledge.</em>
</p>

<p align="center">
  <a href="#license"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-green.svg"></a>
  <img alt="Status: prototype" src="https://img.shields.io/badge/status-prototype-FFB300.svg">
</p>

---

## What is this?

Rhyza is an organizational learning platform built around a single idea: **every great idea
starts as a seed, and every seed deserves a community.** People plant *seeds* (questions worth
exploring), the community contributes across five *dimensions* of understanding, and when a seed
matures it *blooms* into a piece of durable knowledge that lives forever on the **Sacred Tree** —
the organization's collective memory.

This repository contains the **Learning module** — the first of six intent-driven worlds
(Learn · Achieve · Help · Help-others · Meet · Explore).

> **Heads up — this is a design prototype, not production code yet.**
> What's in this repo is a high-fidelity, runnable prototype of the Learning experience plus a
> complete engineering handoff (architecture, data model, API). It's the starting point for
> building the real thing. See [Project status](#project-status) below.

---

## Quick start — run the prototype

The prototype is a single self-contained React component with **no build step**. You only need a
static file server (so the browser can load the JSX and image assets).

```bash
# clone your fork / this repo, then:
cd prototype

# any static server works — pick one:
python3 -m http.server 8000          # then open http://localhost:8000
# or
npx serve .                          # then open the printed URL
```

Open the URL in your browser and the Learning Garden boots straight into the **Intent** screen.
React, ReactDOM and Babel are loaded from a CDN, and the JSX is transformed in the browser — so
the first paint needs an internet connection (it also pulls Google Fonts and renders the garden
artwork from `prototype/assets/`).

> Opening `index.html` via `file://` will **not** work — browsers block `fetch()` of the local
> `.jsx` file. Use a static server as shown above.

### What you can explore

Intent → Garden Entry → Garden Home → Seed (the core experience) → Bloom → **Sacred Tree**, plus
user profiles from any avatar. The Seed screen simulates a live collective: the watcher count
drifts, a simulated reviewer appears, and around the 18-second mark a vote tips the seed past the
bloom threshold and fires the full bloom celebration. Turn your sound on for the Web-Audio nature
cues. 🌸

---

## Repository layout

```
rhyza/
├── prototype/                 # The runnable, no-build prototype
│   ├── index.html             #   → open this through a static server
│   ├── rhyza.jsx             #   the full Learning module component (React)
│   ├── assets/                #   garden + sacred-tree artwork
│   └── Rhyza Flywheel.dc.html#   original design-tool entry point (reference only)
├── docs/
│   ├── DESIGN_HANDOFF.md      # Screen-by-screen spec, tokens, animations, sounds
│   ├── ARCHITECTURE.md        # Recommended production stack & real-time design
│   ├── DATA_MODEL.md          # Full database schema
│   └── API.md                 # REST + WebSocket endpoint reference
├── CONTRIBUTING.md            # How to contribute (and the project philosophy)
├── CODE_OF_CONDUCT.md
├── CHANGELOG.md
└── LICENSE                    # MIT
```

## Design system at a glance

| | |
|---|---|
| **Mood** | Dark forest. Near-black `#040904` background, warm-white ink, green + bloom-gold accents. |
| **Type** | `Fraunces` (serif headings) · `Inter` (sans body/UI). |
| **Metaphor** | Seed → Germinating → Sprouting → Growing → Bloomed. The plant SVG animates between stages. |
| **Five dimensions** | 🧠 Foundations · 💡 Understanding · 🛠 Application · ⚖ Debate · 🌸 Bloom |

Full color tokens, the type scale, every screen, and the animation/sound specs live in
[`docs/DESIGN_HANDOFF.md`](docs/DESIGN_HANDOFF.md).

## Building the real thing

The prototype is the *what*; [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) is the *how*. The
recommended stack is a Next.js 14 + Tailwind frontend, a tRPC/Prisma/Postgres backend, Redis +
an Ably-style pub/sub for the real-time bloom broadcast, and a Turborepo monorepo. The data model
and API surface are fully specified in [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) and
[`docs/API.md`](docs/API.md) so the build can start immediately.

A key design choice: reactions, contribution dimensions, and recognition labels are **data, not
code** — you extend the product by inserting rows, not shipping deploys. See the extension points
in [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Project status

**Seed stage (`0.x`).** This repo is the design handoff + interactive prototype. The production
application described in `docs/ARCHITECTURE.md` has not been built yet — that's the open invitation.
If you want to help turn the prototype into a real platform, [`CONTRIBUTING.md`](CONTRIBUTING.md)
is the place to start.

## Contributing

Contributions are welcome and the bar is high — in the friendly way. Read
[`CONTRIBUTING.md`](CONTRIBUTING.md) for the philosophy, the areas that need love, and the
extension points. By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).

## License

[MIT](LICENSE). Build on it, fork it, learn from it.

> The copyright line in `LICENSE` reads *"The Rhyza Authors"* — feel free to replace it with your
> own name or organization before publishing.

<p align="center"><em>Every contribution is a seed. Every seed deserves a community.</em></p>
