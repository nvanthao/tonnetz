# TODOs

Work deliberately deferred. Each item notes what is already known, so picking it
up later does not mean rediscovering it.

---

## 1. CI, and the decision git was blocking

Git is done — the repo is on GitHub at `nvanthao/tonnetz`, pushed to `main`.
What was deferred *behind* it is not:

**Still to do: a CI check** running `npm test` and `npm run build`. The suite is
fast (~300ms) and already guards things that are easy to break by eye — see the
colour-vision tests.

**Still to decide.** Two things in the codebase were shaped by the absence of
history, and now that there is history, they should be settled:

- `layoutProgression` in `src/music/tonnetz.js` (~70 lines, plus its tests) is
  **not wired into the UI**. It picks one triangle per chord so a progression
  reads as a connected walk; we replaced it with "light every instance". It was
  kept rather than deleted specifically because there was no history to recover
  it from. There is now: revive it behind a toggle, or delete it. It should not
  sit unused indefinitely. (See also item 3 — it is why `DEFAULT_BOUNDS` is 9×6.)
- Design rationale lives in `README.md` and in comments because there were no
  commit messages to hold it. That is not wrong, but new rationale
  (the colour-vision fix, the Tone.js teardown ordering) should go in commits
  from here on.

---

## 2. Deploy to a Cloudflare Worker — **done**

Shipped as **Workers Static Assets** (not Pages): `wrangler.jsonc` points
`assets.directory` at `./dist` with `not_found_handling:
"single-page-application"`, on the custom domain `tonnetz.quirkyquokka.dev`.
`npm run deploy` builds and deploys. Workers was chosen over Pages because it
leaves room to add a real request handler later; today there is none — the app
is a purely static SPA with no API, no secrets and no env config.

**Still true, and worth not forgetting:**

- The SPA fallback is configured but unexercised: there is no router, so every
  request is `/`. It matters the moment one is added.
- Bundle is ~327 KB / ~95 KB gzipped, most of it Tone.js. Fine to ship, but if
  load time ever matters, that is the thing to look at first.
- Tone.js pulls no external resources at runtime, so no CSP or CORS work is
  expected. A sampled instrument (see the instrument picker in `usePlayback.js`)
  would change that — samples would need to be served from `dist/` too.

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
