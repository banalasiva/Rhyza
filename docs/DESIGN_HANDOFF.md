# Rhyza — Design Handoff

> **Where things live in this repo:** the runnable prototype is in [`../prototype/`](../prototype/)
> (`rhyza.jsx` + `index.html`), the artwork is in [`../prototype/assets/`](../prototype/assets/),
> and the engineering docs referenced below are siblings of this file:
> [`ARCHITECTURE.md`](ARCHITECTURE.md), [`DATA_MODEL.md`](DATA_MODEL.md), [`API.md`](API.md).
> Asset paths in the sections below (e.g. `assets/garden-scene.png`) are relative to the prototype.

> **Note:** The HTML files in this package are high-fidelity design references built as interactive prototypes. They are **not production code**. The task is to recreate these designs in your target stack (see ARCHITECTURE.md) using its established patterns. The prototype runs on a custom streaming DC runtime — do not ship the HTML directly. (A no-build browser entry point, `prototype/index.html`, is provided so you can *run* the prototype for reference — see the repo [README](../README.md).)

---

## Overview

Rhyza is a **Human Intent Network** — an organizational learning platform where people discover purpose, make progress, and experience play. This prototype covers the **Learning module** (intent: "I want to learn"), the first of six intent-driven worlds.

The core metaphor: **a botanical garden where ideas are seeds that grow into collective knowledge.**

---

## Fidelity

**High-fidelity.** Pixel-accurate colors, typography, spacing, animations, and interactions are specified. The developer should recreate the UI to match the prototype exactly, then extend using the design token system defined below.

---

## Color Tokens

```
Background:    #040904  (near-black, dark forest)
Surface-1:     rgba(9,15,9,0.88)   (glass panels)
Surface-2:     rgba(15,22,15,0.82) (cards)
Surface-3:     rgba(255,255,255,0.03) (subtle lift)

Ink-primary:   #E8E4DC  (warm white)
Ink-mid:       #A0A890
Ink-soft:      #5A6456
Ink-muted:     #3A4438

Accent-green:  #4CAF50  (primary action)
Accent-bright: #66BB6A
Accent-light:  rgba(76,175,80,0.12)
Bloom-gold:    #FFB300
Bloom-light:   rgba(255,179,0,0.12)
Seed-brown:    #8D6E63

Border:        rgba(76,175,80,0.18)
Border-subtle: rgba(255,255,255,0.07)
```

---

## Typography

```
Serif (headings):  'Fraunces', Georgia, serif — weights 300, 400
Sans (body/UI):    'Inter', system-ui, sans-serif — weights 400, 500, 600, 700

Scale:
  xs:   10–11px / letter-spacing 0.14–0.18em uppercase labels
  sm:   12–13px / body captions
  base: 13.5–14px / body text, line-height 1.65–1.72
  lg:   16–18px / section headers
  xl:   clamp(18px, 4.5vw, 26px) / seed questions
  2xl:  clamp(24px, 5vw, 36px) / screen titles
```

---

## Screens

### S1 — Intent
**Purpose:** First-touch. User declares why they're here.
**Layout:** Centered column, max-width 500px. Search input at top (autofocus). 5 quick-pick topic chips below. Divider. 6 intent cards in a 2-col auto-fill grid.
**Intent options:** I want to learn · achieve · need help · want to help · meet people · explore
**Key behavior:** Typing in search + Enter navigates to Garden Entry. Clicking an intent card also navigates.
**Background:** Garden image (`assets/garden-scene.png`) with parallax on mousemove. Dark overlay.

### S2 — Garden Entry / Search
**Purpose:** User searches for a topic or creates a new garden.
**Layout:** Centered column. Input with Search button. Popular garden pills. If no garden exists → S3.

### S3 — No Garden (First Seed)
**Purpose:** User is first in this garden. Emotional moment.
**Copy:** "No one has planted this garden yet. Every thriving garden begins with one curious person."
**CTA:** "🌱 Plant the Garden" → S4 (Garden Home)

### S4 — Garden Home
**Purpose:** Overview of a specific garden's seeds, members, blooms.
**Layout:** ScenePage wrapper (garden image header, glass content panel). Member avatars (clickable → profile). Seed cards list. "Plant a Seed" + "🌳 Sacred Tree" buttons. "+ Invite a member" dashed button.
**Seed card:** emoji + title + author + reply count + age + optional 🌸 Bloom pill.

### S5 — Invite / Onboarding
**Purpose:** Invite others to the garden before diving in.

### S6 — Seed (The Core Experience)
**Purpose:** A living idea being explored through 5 dimensions.
**Layout:** 2-column desktop (left: conversation, right: plant + voting). Mobile: stacked with bottom tab bar.

**Left column — Conversation:**
- Question header (Fraunces, 300, large)
- 5 dimension tabs: 🧠 Foundations · 💡 Understanding · 🛠 Application · ⚖ Debate · 🌸 Bloom
- Dimension description italic subtitle
- Thread: top-level contributions + 1-level nested replies
- Each contribution: avatar + author + time + type pill + text + 6 reaction emojis + Endorse + Reply
- Reactions: 💥 It clicked · ✨ Beautifully said · 🧠 Changed thinking · 🛠 I tried this · 📚 Great reference · 🤔 Still confused
- Hover tooltip on reactions: label + who voted
- Rich text compose: toolbar (Bold, Italic, Code, Quote, Link, Attach, Photo, Print) + contentEditable + Contribute button

**Right column — Living Garden:**
- "X people watching" live counter + green pulse dot
- Stage timeline: 🌱 Seed → 💧 Germinating → 🌿 Sprouting → 🌳 Growing → 🌸 Bloomed
- Plant SVG (animates between stages — roots, shoot, leaves, bloom flower)
- Stage meaning card (expands on hover with description + vote button)
- Community perception voting: 5 rows with progress bars, tap to vote
- Bloom section: 60% threshold, progress bar, checklist (vote count + dimension coverage)
- "Vote to Bloom" button

**Simulated collective:**
- Watcher count fluctuates every 3.5s (±1)
- At 10s: toast "X is reviewing this seed..."
- At 18s: auto-vote from simulated user tips bloom threshold, fires celebration

**Bloom Celebration:**
- Full-screen overlay, near-black background
- Golden radial burst animation
- 16 flying petal particles
- 🌸 emoji spinning (font-size 96px, filter drop-shadow gold)
- "This Seed has Bloomed" (Fraunces 300)
- Contributor avatar row
- "View Sacred Tree →" CTA

### S7 — Bloom Proposal
**Purpose:** Community voting screen before bloom is confirmed.

### S8 — Bloom Detail
**Purpose:** View a matured bloom with lineage.

### S9 — Sacred Tree
**Purpose:** Organizational memory. All blooms as leaves on the tree.
**Layout:** Full-bleed magical tree image (`assets/sacred-tree-dark.png`). 3 bloom 🌸 flowers at branch positions. Right panel slides in on bloom tap.
**Bloom detail panel:**
- Title + version + date
- Version history pills
- Summary text
- Dimension bars (which perspectives shaped it)
- Knowledge lineage: contributor cards with Endorse button + count
- "+ Add a contributor to this Bloom" (email/name + role inputs)
- "💬 View full conversation →" button

### S_Profile — User Profile
**Purpose:** Individual identity page. Recognitions earned socially.
**Layout:** Large avatar + name + bio. Stats (seeds, blooms, gardens). Recognition badges with % bars. Active gardens list.

---

## Navigation Flow

```
Intent
  └── Garden Entry
        ├── [Garden exists] → Garden Home
        └── [New garden]   → No Garden → Garden Home
              └── Invite
                    └── Seed ←→ Bloom Proposal ←→ Bloom
                          └── Sacred Tree
                                └── Profile (from any avatar)
```

Side Panel (≡) accessible from all Garden screens: Seeds list · Sacred Tree · Members · Other Gardens.

---

## Key Animations

| Name | Duration | Easing | Description |
|------|----------|--------|-------------|
| Page enter | 380ms | cubic-bezier(0.22,1,0.36,1) | fadeSlideUp |
| Plant stage transition | 1.4s | cubic-bezier(0.22,1,0.36,1) | stem grows, leaves unfurl |
| Bloom petals | 1.2s | cubic-bezier(0.34,1.56,0.64,1) | scale from 0 |
| Bloom celebration burst | 1.4s | ease-out | radial scale 0.2→2.8 |
| Stage bar fill | 0.6s | cubic-bezier(0.22,1,0.36,1) | width transition |
| Side panel | 360ms | cubic-bezier(0.22,1,0.36,1) | translateX(-100%→0) |
| Detail panel | 300ms | cubic-bezier(0.22,1,0.36,1) | translateX(100%→0) |
| Fireflies | 5s | ease-in-out | infinite float + opacity |

---

## Nature Sounds (Web Audio API)

- **Wind chime** (2 sine waves, 523Hz + 659Hz, staggered): on notification bell tap with unread items
- **Bloom arpeggio** (7-note pentatonic 784Hz→3136Hz + triangle harmonics + noise shimmer): on collective bloom

No sounds on reactions, replies, or stage votes.

---

## Assets

| File | Usage |
|------|-------|
| `assets/garden-scene.png` | Garden background (all ScenePage screens) |
| `assets/sacred-tree-dark.png` | Sacred Tree screen background |

---

## Files in this Package

- `rhyza-v4.jsx` — Full prototype component (React, no bundler)
- `Rhyza Flywheel.dc.html` — Runnable prototype entry point
- `ARCHITECTURE.md` — Stack decisions, real-time design, module system
- `DATA_MODEL.md` — Full database schema
- `API.md` — REST + WebSocket endpoint reference
- `CONTRIBUTING.md` — Open source contribution guide
