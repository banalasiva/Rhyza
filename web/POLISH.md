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

### Needs your input / bigger builds (planned next)

- [~] **#1 Planting a seed lands it in the wrong garden.** People want to add a
  seed ASAP; "garden" reads as hierarchy. Plan: make the garden obvious at plant
  time (or a "quick seed" that drops into a sensible default), and reframe garden
  as "a space for a group," not a folder.
- [~] **#2b Kickstart with an AI first reply.** When someone plants a seed,
  optionally have Claude/ChatGPT respond to the question first, so effort to ask
  a good question is immediately rewarded.
- [~] **#3 Dimension jargon (Foundations / Understanding / …) isn't intuitive.**
  These were borrowed from Juspay. Move to world-neutral, first-principles
  buckets; still editable. NEEDS the naming decision.
- [~] **#5 Decide should be a beautiful guided flow.** Step 1: "understand
  together" vs "make a decision." Then the weighting questions as next→next.
  Finally "open results to everyone." Also: make it clear you can bloom directly
  without weighting. Bigger build.
- [~] **#7 Timers / deadlines.** "2 days to discuss, 1 day to decide, Claude
  follows up till Bloom" — or "no deadline, converge peacefully." Schema + UI +
  Claude follow-up. Bigger build.
