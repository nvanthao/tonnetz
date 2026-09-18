# TODOs

Work deliberately deferred. Each item notes what is already known, so picking it
up later does not mean rediscovering it.

---

## 1. Put it under git

Nothing is version controlled yet. `.gitignore` already exists (`node_modules`,
`dist`), so this is `git init`, a first commit, and a remote.

**Why it is more than housekeeping.** Two decisions in the codebase are shaped
by the absence of history:

- `layoutProgression` in `src/music/tonnetz.js` (~70 lines, plus its tests) is
  **not wired into the UI**. It picks one triangle per chord so a progression
  reads as a connected walk; we replaced it with "light every instance". It was
  kept rather than deleted specifically because there is no history to recover
  it from. Once there is, decide properly: revive it behind a toggle, or delete
  it. It should not sit unused indefinitely.
- Design rationale currently lives in `README.md` and in comments because there
  are no commit messages to hold it. That is not wrong, but some of it
  (the colour-vision fix, the Tone.js teardown ordering) would read better as
  commit history.

**Also worth doing at the same time:** a CI check running `npm test` and
`npm run build`. The suite is fast (~300ms) and already guards things that are
easy to break by eye — see the colour-vision tests.

---

## 2. Deploy to a Cloudflare Worker

The app is a **purely static SPA** — `npm run build` emits `dist/`, there is no
server-side logic, no API, no secrets, and no environment config. All audio is
client-side Tone.js. So this is static-asset hosting, not a request handler.

**Decide first:** Workers with static assets vs. Cloudflare Pages. Workers Static
Assets is the current direction and leaves room to add a Worker later; Pages is
the older path. Pick one deliberately rather than by habit.

**Known inputs:**

| | |
|---|---|
| Build command | `npm run build` |
| Output directory | `dist` |
| Node version | built on 24.x |
| Routing | single page, no router — no SPA fallback needed *yet* |
| Secrets / env vars | none |

**Check the current docs when implementing** rather than trusting a remembered
`wrangler.jsonc` shape — the static-assets config has moved more than once, and
this file should not pretend to pin it.

**Small things not to forget:**

- Nothing in the app needs to be same-origin, but Tone.js pulls no external
  resources at runtime, so no CSP or CORS work is expected.
- If a router is ever added, static hosting needs an SPA fallback to
  `index.html`; note it then.
- Bundle is ~320 KB / ~93 KB gzipped, most of it Tone.js. Fine to ship, but if
  load time ever matters, that is the thing to look at first.

---

## 3. Mobile support

**This one is real work, not a media query.** The layout already stacks — the
sidebar is `flex-col` below the `lg:` breakpoint — so the page does not break.
The *lattice* is the problem, and it is a sizing problem that CSS alone will not
fix.

Measured, at the current `DEFAULT_BOUNDS` (9×6, 54 nodes, viewBox 1138×521):

| viewport | lattice | node diameter | label |
|---|---|---|---|
| 390px (iPhone) | 358×164 | **13.8px** | **5.3px** |
| 414px | 382×175 | 14.8px | 5.7px |
| 768px (tablet) | 736×337 | 28.5px | 11.0px |

A 5px label is unreadable and a 14px target is a third of the ~44px minimum for
touch. Shrinking the lattice helps but does not get there on its own — the
smallest patch that still shows all 24 triads is 20 nodes, and even that is only
24.7px per node at 390px:

| bounds | nodes | triads shown | node @390px |
|---|---|---|---|
| `-3..5 × -2..3` (current) | 54 | 24/24 | 13.8px |
| `-2..4 × -2..2` | 35 | 24/24 | 17.7px |
| `-1..3 × -1..2` | 20 | 24/24 | **24.7px** |

So the likely answer is **responsive bounds plus pan/zoom**, not one or the
other. Worth trying: a smaller patch on small screens, the lattice scrollable
horizontally in its own container, and landscape treated as the good case.

**Related decision already pending.** `DEFAULT_BOUNDS` is 9×6 *only* because
`layoutProgression` (see item 1) needed the room to draw a connected walk
everywhere. That layout is not in use. If it stays unused, shrinking the bounds
improves mobile legibility **and** reduces desktop busyness — right now 3–4
triangles light per chord. These two items should be decided together.

**Touch-specific behaviour that does not exist yet:**

- **Hover preview has no touch equivalent.** Hovering a chord in the progression
  row outlines it on the lattice; on touch there is no hover, and tap already
  means "play this chord". Needs a real interaction decision — long-press,
  a selected state, or previewing the whole progression at once.
- `hover:brightness-150` on triangles does nothing useful on touch and can stick
  after a tap on iOS. Gate it behind `@media (hover: hover)`.
- **iOS audio.** `Tone.start()` is already called on first interaction, but iOS
  is stricter than desktop and the hardware silent switch mutes WebAudio
  outright — a user can tap Play, see the highlights run, and hear nothing with
  no indication why. Verify on a real device; consider detecting and saying so.
- Node circles and triangles need to be re-checked as touch targets once the
  sizing is settled, not before.
