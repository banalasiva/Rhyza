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

### Bigger builds (planned next)

- [~] **#5 (full) Decide as a guided flow.** Step 1: "understand together" vs
  "make a decision" as an explicit chooser. Then the weighting questions as a
  polished next→next. Finally "open results to everyone." The stepped weigh-in
  already exists — this is the wrapper/flow + the explicit template choice.
  Deserves its own focused pass (touches the quorum engine).
- [~] **#7 Timers / deadlines.** "2 days to discuss, 1 day to decide, Claude
  follows up till Bloom" — or "no deadline, converge peacefully." Schema + UI +
  Claude follow-up. Bigger build.
- [~] **#1 Planting a seed lands it in the wrong garden.** Make the garden obvious
  at plant time (or a sensible default), reframe garden as "a space for a group."
- [ ] **#3 Dimensions beyond Foundations/Understanding/…** Deferred by request —
  people's dialogues are broader than these buckets; revisit after features land.
