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

This has now started — the real application lives in [`web/`](web/). It's a fresh **Next.js 14 +
Tailwind** app with **Google + enterprise-SSO** auth (Auth.js v5), a **Postgres/Prisma** backend
implementing [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md), and REST route handlers mirroring
[`docs/API.md`](docs/API.md). The v1 vertical slice — sign in → garden → plant a seed →
contribute → vote → bloom → Sacred Tree — runs entirely on real persisted data, with **no
hardcoded names or demo content**.

- Run it: [`web/README.md`](web/README.md)
- Deploy it (Vercel + Neon + OAuth/SSO): [`web/DEPLOY.md`](web/DEPLOY.md)

Deferred to phase 2: real-time bloom broadcast (Ably), AI bloom synthesis, media uploads, and the
other five modules. The original prototype in [`prototype/`](prototype/) remains as the visual
reference. See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full target architecture.

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
