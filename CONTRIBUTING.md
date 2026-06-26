# Contributing to Rhyza

Rhyza is open source. We build in the open because the best ideas for a learning platform come from people who care about learning.

---

## Philosophy

> "Every great idea starts as a seed. Every seed deserves a community."

We apply Rhyza's own principles to how we build Rhyza:
- **Seeds** → issues, feature ideas, bug reports
- **Contributions** → PRs, documentation, design feedback
- **Blooms** → shipped features, released versions
- **Sacred Tree** → the changelog, our collective memory

---

## High Bar for Contribution

We keep a high bar — not to be exclusive, but because every line of code is a seed someone else inherits. We'd rather have 10 excellent contributions than 100 mediocre ones.

What we look for:
- Code that explains itself (clear names, minimal comments)
- Tests for behavior, not implementation
- Mobile-first thinking in every UI change
- Performance consciousness (every db query, every re-render)
- Empathy for the person who reads this in 6 months

---

## How to Contribute

### 1. Find or plant a seed

- Browse [open issues](https://github.com/rhyza-app/rhyza/issues) labeled `good first seed` or `help wanted`
- Or open a new issue describing what you want to add/fix
- **Before coding**: comment on the issue so we don't duplicate work

### 2. Fork and branch

```bash
git clone https://github.com/<you>/rhyza
cd rhyza
```

**To run the prototype today** (no build step — see the [README](README.md)):

```bash
cd prototype
python3 -m http.server 8000   # then open http://localhost:8000
```

**For the production app** (the Next.js/tRPC stack described in
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)) — the workspace below is the
target layout once the app is scaffolded; it does not exist in this repo yet:

```bash
pnpm install
pnpm db:migrate
pnpm db:seed     # seeds Kubernetes Garden demo data
pnpm dev
```

Branch naming: `feature/bloom-animation`, `fix/reaction-tooltip`, `docs/api-search`

### 3. Make your change

- Follow the code style (ESLint + Prettier auto-format on save)
- Write tests for new behavior (`pnpm test`)
- Run `pnpm typecheck` before pushing
- Keep PRs focused — one seed per PR

### 4. Open a Pull Request

Use the PR template. Include:
- **What**: What changed and why
- **Screenshots/video**: For UI changes, always
- **Mobile**: Screenshot or recording on mobile viewport
- **Breaking changes**: If any API or data model changes

---

## Areas That Need Love

| Area | Difficulty | Description |
|------|-----------|-------------|
| Mobile bottom sheet | Medium | Smooth spring animation for dimension thread sheet |
| Search UI | Medium | Cmd+K modal, grouped results, keyboard navigation |
| Reaction picker (long press) | Medium | iOS-style popover on long press contribution |
| Video contribution | Hard | Upload, transcode, inline player |
| Video calls | Hard | Daily.co/Livekit integration in Learning Circles |
| Notification sound registry | Easy | Make sound types configurable per org |
| Accessibility | Easy-Hard | ARIA labels, keyboard nav, screen reader support |
| i18n | Medium | Internationalization (RTL support will be needed) |
| Dark/light mode | Easy | Currently dark only; light mode tokens needed |
| Offline support | Hard | Service worker, IndexedDB caching for seeds |
| Storybook | Medium | Document all shared UI components |

---

## Extension Points (No Breaking Changes Needed)

These are designed to be extended by adding rows to database tables:

### Add a new reaction type
```sql
INSERT INTO reaction_types VALUES ('fire', '🔥', 'This is hot', 'learning', 7, true);
```
No code change needed. Reaction appears in the UI automatically.

### Add a new contribution dimension
```sql
INSERT INTO contribution_types VALUES (gen_random_uuid(), 'learning-module-id', '🧪', 'Experiment', 'Share an experiment you ran', 5);
```

### Add a new recognition label
```sql
INSERT INTO recognition_labels VALUES (gen_random_uuid(), 'experimenter', '🧪', 'Experimenter', 'Runs experiments, shares results');
```

---

## Design Contributions

The runnable prototype lives in `prototype/`, and the screen-by-screen spec lives in
`docs/DESIGN_HANDOFF.md`. If you're proposing a UI change:
1. Open an issue with screenshots/mockups
2. Reference the relevant screen in `docs/DESIGN_HANDOFF.md`
3. If it's significant: update the prototype (`prototype/rhyza.jsx`) to show the change
4. PRs for design changes require a mobile screenshot

---

## Code of Conduct

We follow the [Contributor Covenant](https://www.contributor-covenant.org/).

In short: Be kind. Assume good intent. Disagree constructively. The garden grows when everyone feels safe to plant seeds — including ideas that might fail.

---

## Governance

- **Core team**: reviews all PRs touching data model, API, and real-time architecture
- **Module maintainers**: own individual intent modules (learning, achievement, etc.)
- **Community maintainers**: earn maintainer status after 5 merged PRs + demonstrated good judgment

Decisions are made by lazy consensus: if nobody objects within 72 hours, the change goes in.

---

## License

MIT. Build on it, fork it, learn from it. If you build something great, tell us — we'd love to know Rhyza helped.

---

## Changelog

We use [Keep a Changelog](https://keepachangelog.com/) format. Every PR that ships a user-visible change updates `CHANGELOG.md`.

Versions follow the garden metaphor:
- `0.x.x` — Seed (early, experimental)
- `1.x.x` — Sprouting (public beta, API stable)
- `2.x.x` — Growing (all 6 modules, production-ready)
- `3.x.x` — Bloom (full organizational knowledge graph)

---

## Questions?

Open a Discussion on GitHub, or find us in the Rhyza Discord. We're building in public and we want to hear from you.

Every contribution is a seed. Every seed deserves a community.
