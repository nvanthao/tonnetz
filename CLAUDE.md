# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Vite dev server
npm run build        # production build to dist/
npm run preview      # serve the built output
npm test             # run the suite once
npm run test:watch   # watch mode

npx vitest run src/music/__tests__/tonnetz.test.js     # one file
npx vitest run -t 'connected walk'                      # one test by name
```

There is no linter or formatter configured, and no git repository — see
`TODOs.md` for deferred work (git, Cloudflare deploy, mobile).

## Architecture

Three layers, and the boundary between them is the main thing to preserve:

- **`src/music/*.js`** — plain JS. No Vue, no Tone.js, no DOM. All the
  music theory and lattice geometry lives here and is unit-tested directly.
- **`src/composables/*.js`** — Vue wrappers. `useTonnetz` holds lattice state,
  `usePlayback` owns every Tone.js concern.
- **`src/components/*.vue`** + `App.vue` — presentation and wiring.

New music-theory or geometry logic belongs in `src/music/`, not in a component
or composable, so it stays testable without mounting anything.

### The lattice

A node at lattice coordinate `(x, y)` has pitch class `7x + 4y (mod 12)`, so
`+x` rises a fifth and `+y` a major third. Every horizontal edge
`(x,y)–(x+1,y)` carries exactly two triangles: apex above at `(x, y+1)` is the
**major** triad on `p`, apex below at `(x+1, y-1)` is the **minor** triad on
`p`. Both are rooted on the same node. Generation is a single pass over those
edges, keeping only triangles whose three corners are in bounds.

`createTonnetz` builds a `chordIndex` — a `Map` from pitch-class-set key to
triangles — once at load. Chord lookup is a hash lookup, never a scan.

**The lattice is periodic** (it wraps onto a torus), so each triad appears 3–4
times in the visible patch. **Every instance is highlighted.** An alternative
exists — `layoutProgression` picks one instance per chord so a progression reads
as a connected walk — but it is **deliberately not wired into the UI**. It is
kept, tested, and documented as unused; see `TODOs.md` before reviving or
deleting it. `DEFAULT_BOUNDS` is 9×6 only because that layout needed the room.

### Playback and visual sync

`usePlayback` schedules a `Tone.Part` on `Tone.Transport`, one chord per quarter
note. The highlight is scheduled with `Tone.Draw.schedule()` **inside the same
callback that triggers the audio, at the same `time`**. Never use
`setTimeout`/`setInterval` on the sync path.

Three invariants that were each a real bug, and are commented at their call
sites:

1. **`stop()` must also call `Tone.getDraw().cancel(0)`.** Cancelling the
   Transport leaves the next chord's highlight queued in Draw, which lights a
   triangle after the sound has stopped. The *natural* end of a run deliberately
   does not cancel — its final clear is itself a pending Draw event.
2. **The end-of-run teardown must not halt the Transport from inside its own
   tick callback.** Doing so rewinds to tick 0 while the Part is still armed
   there, re-firing the opening chord. It is deferred to a fresh task. The
   `isPlaying` flag and the Transport stop also deliberately do *not* ride on
   `Draw`, because a backgrounded tab freezes `requestAnimationFrame` and would
   otherwise leave the Transport running forever.
3. **Manual audition: stop the sequencer *before* painting the highlight.**
   `playChord`/`playNote` are sound-only; the caller (`App.vue`) paints, so the
   highlight lands immediately instead of waiting on the audio context to
   unlock. Stopping afterwards would clear what was just painted.

`Tone.start()` runs on first user interaction, as autoplay policy requires.

### Triangle visual states

Four states, resolved by `triangleFill` and `triangleOutline` in `theme.js`:
at rest → trail (already played this run) → sounding → preview (hovered chord).
Sounding outranks trail, since the current chord is in the trail set too.
Preview only changes the **outline**, never the fill — a bright fill means
"sounding now", and borrowing it would make two triangles claim to sound during
playback. `TonnetzGrid` paints in matching z-order tiers so outlines are not
overdrawn by later neighbours.

### Colour

Every colour lives in `src/theme.js`. Nothing else hardcodes one.

**The palette is verified, not eyeballed.** `src/theme/colorVision.js` simulates
protanopia/deuteranopia/tritanopia and compares in Lab; the tests assert that
all 21 pairs of meaningful colours stay separated for every vision type. This
exists because a trail colour chosen by eye (violet) collapsed onto the
minor-triad blue under deuteranopia at dE 2.2. **Adding or changing a meaningful
colour means running `npm test`** — and states are also distinguished by
non-colour cues (dashed vs solid outlines) so they never depend on hue alone.

### Roman numerals

`resolveRomanNumeral(numeral, { tonic, mode })` knows nothing about the UI, so
free-text input could be added without rearchitecting. Each entry in
`PROGRESSIONS` declares its own `mode`, and **its numerals are written for that
mode's scale** — in minor, the natural-minor degrees `III`/`VI`/`VII` take no
flat. Selecting a progression switches the key to its mode.

`resolveProgression(..., { resolveToTonic: true })` appends the tonic so a
progression lands home. It tests the resolved *root*, not the numeral text, so
`ii–V–I` gains nothing.
