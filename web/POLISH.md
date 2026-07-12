# Craftsmanship & intuitiveness checklist

A living list of the small details that make ThinkThru self-evident to a
first-time user — the goal is that no one should need 45 minutes (or a phone
call) to understand it. Newest batches at the top.

Legend: `[ ]` to do · `[~]` needs a design call / bigger build · `[x]` shipped

## Batch 1 — Dad's first-run walkthrough

- [x] **#8 Nav "you are here" indicator.** The bottom bar didn't show which tab
  you're on. Active tab now has a glowing accent pill behind its icon + bolder
  label (same on desktop top nav).
- [x] **#4 Light theme readability.** The greys were too faint on the pale
  background. Deepened the ink colors and let light-theme text render at full
  weight (no antialias thinning).
- [x] **#6 Bloom celebration "circle of lights" was static/awkward.** Added a
  slowly rotating ring of light rays behind the bloomed flower so it feels alive.
- [x] **#2a Post-seed helper copy was jargony** ("auto-labelled by dimension").
  Replaced with a warm invitation: "Share what you think — a thought, a question,
  a worry. Others reply, and it grows."

- [x] **#2b Kickstart with an AI first reply.** Default on: when someone plants a
  seed, Claude posts the first response to the question so effort to ask well is
  rewarded immediately (seedOpener + kickstartSeed).
- [x] **#5 (partial) "Can I bloom without weighting?" confusion.** The Decide tab
  now says plainly that weighing is optional and links straight to Bloom.

- [x] **#5 (full) Decide is now a guided 3-step flow.** Lifted out of the buried
  amber "admin" strip into steps everyone sees: **Step 1 · What are we doing
  here?** (two cards — 🤝 Understand together / ⚖️ Make a decision; stewards pick,
  everyone sees) → **Step 2 · Weigh in** (the existing stepped ranking) → **Step 3
  · Open results to everyone** (the reveal, with the answered count). Step 1 also
  points to "skip straight to 🌸 Bloom." AdminBar slimmed to advanced steward
  tools (pin a number, lock/reopen).
- [x] **#1 Plant→garden.** "Planting in [🌿 garden]" selector at the top of the
  compose form, defaulting to the current garden but changeable.

### Bigger builds (planned next)

- [~] **#7 Timers / deadlines.** "2 days to discuss, 1 day to decide, Claude
  follows up till Bloom" — or "no deadline, converge peacefully." Schema + UI +
  Claude follow-up. Bigger build.
- [ ] **#3 Dimensions beyond Foundations/Understanding/…** Deferred by request —
  people's dialogues are broader than these buckets; revisit after features land.
