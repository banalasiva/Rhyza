# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project aims to follow [Semantic Versioning](https://semver.org/).

Versions follow the garden metaphor:
`0.x` Seed (early, experimental) · `1.x` Sprouting (public beta, API stable) ·
`2.x` Growing (all six modules, production-ready) · `3.x` Bloom (full knowledge graph).

## [Unreleased]

### Added
- Initial public release of the Rhyza Learning module **design handoff** and **runnable prototype**.
- `prototype/index.html` — a no-build entry point that runs the prototype directly in the browser
  via React 18 + Babel standalone (CDN), served from any static file server.
- Engineering docs: `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`, `docs/API.md`,
  and the screen-by-screen `docs/DESIGN_HANDOFF.md`.
- `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, MIT `LICENSE`.

### Changed
- Prototype background art now references the bundled `assets/garden-scene.png` instead of the
  original design-tool upload path, so the prototype renders self-contained from this repo.
