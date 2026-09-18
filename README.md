# Tonnetz

A chord-progression visualizer built on the *Tonnetz* — the triangular lattice
where moving right is a perfect fifth, moving up-right a major third, and every
triangle is a major or minor triad. Pick a key and a progression, press Play,
and the triads light up on the lattice in sync with the audio.

```
npm install
npm run dev      # http://localhost:5173
npm test         # music-theory unit tests
npm run build
```

## Layout

```
src/
  music/            plain JS, no Vue, no Tone - all unit-tested
    pitch.js          pitch classes, triads, voicing
    romanNumerals.js  numeral parsing + resolution against a key
    progressions.js   the catalogue
    tonnetz.js        lattice generation + chord -> triangle lookup
  composables/
    useTonnetz.js     lattice + which triangles are lit
    usePlayback.js    every Tone.js concern
  components/       TonnetzGrid / ProgressionSelector / PlaybackControls
  theme.js          the entire palette
  theme/
    colorVision.js  dichromat simulation, so the palette is checked not eyeballed
```

## How the lattice is generated

Nothing is hardcoded. A node at lattice coordinate `(x, y)` has pitch class

```
pc(x, y) = 7x + 4y  (mod 12)
```

so `+x` rises a fifth and `+y` rises a major third. Drawn with each row offset
half a cell right of the one below, those axes plus the `(-1, +1)` diagonal (a
minor third) give every node six neighbours.

Every horizontal edge `(x, y) – (x+1, y)` carries exactly two triangles:

| apex | pitch classes | triad |
| --- | --- | --- |
| above, at `(x, y+1)` | `p, p+4, p+7` | **major** on `p` |
| below, at `(x+1, y-1)` | `p, p+3, p+7` | **minor** on `p` |

Both are rooted on the same node, so the root always sits at the left end of the
shared edge. Generation is one pass over those edges, keeping only triangles
whose three corners fall inside the bounds. The default `7 × 5` patch of nodes
shows **all 24 consonant triads** without panning (asserted by a test).

Chord lookup is a `Map` from pitch-class-set key to triangles, built once at
load; playback only ever does a hash lookup.

## Repeated triads, and the road not taken

The lattice is periodic — it wraps onto a torus — so a given triad appears at
two or three places in the visible patch. **Every** instance is highlighted:
they are all equally the chord that is sounding, and seeing them all is what
makes the periodicity legible.

The alternative is to light exactly one instance per chord, chosen so the
progression reads as a connected walk — so that the F major you hear is visibly
the triangle *hinged on the C before it*. `layoutProgression` in
`src/music/tonnetz.js` does this, and is tested, but **is not currently wired
into the UI**. It minimises the whole path at once with a small dynamic program
over the candidates rather than choosing greedily, since greedy stranding is
real; centroid distance is the entire metric, because triangles sharing an edge
are by construction the closest pair there is, so parsimonious voice leading
falls out of the geometry. Staying near the middle of the lattice is a
tie-breaker and nothing more (`CENTRE_WEIGHT`, small) — as a full peer of the
step cost it would break real adjacencies to sit prettier.

`DEFAULT_BOUNDS` is sized so that layout succeeds everywhere, and a test asserts
it: for every catalogue progression in all twelve keys, chords sharing *n* notes
land on triangles sharing *n* corners. The binding constraint is the *Hexatonic
cycle*, six triangles that march across the lattice rather than closing a ring.
That sizing is why the patch is 9×6 rather than something tighter; it is worth
revisiting if the walk layout is abandoned for good.

## Colour

Four constants in `src/theme.js` carry the whole scheme: `MAJOR_COLOR` /
`MINOR_COLOR` are the resting fills (dim, but saturated enough that major and
minor stay tellable apart before anything plays), and
`MAJOR_HIGHLIGHT_COLOR` / `MINOR_HIGHLIGHT_COLOR` are the same hues brightened.
An active triangle is therefore a brighter version of *its own* quality colour,
never a neutral one — so a lit triangle says both "this one" and "major"/"minor"
without reading a label. Idle triangles keep their base colour throughout
playback; nothing is greyed out.

`PLAYED_COLOR` marks the **trail**: triangles this run has already sounded.

It is a desaturated warm grey rather than a third hue, and that is deliberate.
Every other colour here is a saturated warm or cool, so the trail is told apart
by *how little colour it has* — and saturation and lightness survive
colour-vision deficiency, where hue does not. The first attempt was a violet,
picked by eye, which collapsed onto the minor-triad blue under deuteranopia:
`#3c3cb6` against `#3737af`, a dE of **2.2**. Indistinguishable.

The replacement was chosen by measurement, not by eye. `src/theme/colorVision.js`
projects colours onto the dichromat plane in LMS space and compares them by CIE76
dE in Lab; the current value maximises the worst case across protanopia,
deuteranopia and tritanopia against every other colour on screen, clearing dE 35
against all of them. `npm test` checks all 21 pairs of meaningful colours and
would fail on a regression — including a test pinning the original violet bug so
nobody reintroduces it.

Colour is still not the only cue: `triangleStroke` gives the trail a light
outline as well as a drained fill, so the state survives even if the fills are
hard to tell apart. Quality is dropped from the trail — where the progression
went is the question it answers, and the chord row still says what each step
was.

`triangleFill` ranks the three states: sounding now beats already-played beats
at rest. The current chord is in the trail set too (it is simplest to add it on
arrival), so that precedence is what stops it from disappearing into its own
trail; a test pins it.

The trail accumulates across a run and is wiped by anything that invalidates it
— pressing Play, pressing Stop, or changing the key or progression. It survives
the *end* of a run on purpose, so the finished progression stays readable on the
lattice, and it survives clicking around by hand so you keep that reference
while exploring.

## Audio and sync

`Tone.PolySynth` plays the three notes; `Tone.Part` schedules one chord per
quarter note on `Tone.Transport`. The highlight is scheduled with
`Tone.Draw.schedule()` inside the very callback that triggers the audio, at the
same `time` — no `setTimeout` anywhere in the sync path. `Tone.start()` runs on
the first user interaction, as browser autoplay policy requires.

Two things learned the hard way, both commented at the call site:

- **Stop must cancel `Tone.Draw`'s queue too.** Cancelling the Transport leaves
  the next chord's highlight already queued, which would light a triangle after
  the sound had stopped.
- **The end-of-run teardown cannot halt the Transport from inside its own tick
  callback.** Doing so rewinds to tick 0 while the Part is still armed there,
  re-firing the opening chord. The teardown is deferred to a fresh task; the
  `isPlaying` flag and the Transport stop deliberately do *not* ride on `Draw`,
  since a backgrounded tab freezes `requestAnimationFrame` and would otherwise
  leave the Transport running forever.

## Keys, modes and numerals

Numerals resolve against the selected key through `resolveRomanNumeral`, which
takes `{ tonic, mode }` and knows nothing about the UI — free-text input can be
added later without touching anything else. It handles accidentals (`bVII`,
`#iv`), case for quality, and `o`/`°`/`dim`/`+`/`aug` suffixes, though the v1
catalogue sticks to triads that exist on the lattice.

Progressions resolve home: `resolveProgression(..., { resolveToTonic: true })`
appends the tonic, so `I – IV – V` plays as `I – IV – V – I`. The test is on the
resolved *root*, not the numeral text, so anything already ending at home — the
jazz cadence `ii – V – I`, or a minor progression closing on a Picardy `I` — is
left alone rather than gaining a redundant repeat. The appended chord carries
`isResolution: true` and is drawn with a dashed border in the chord row.

Each catalogue entry declares its own `mode`, and its numerals are written for
that mode's scale — so in minor, the natural-minor degrees `III` / `VI` / `VII`
need no flat sign. Selecting a progression switches the key to its mode; the
mode selector stays free afterwards, and the resolver handles any combination.

## Hover preview

Hovering a chord in the progression row outlines where that chord sits on the
lattice, so you can find the shape of a progression without playing it. Keyboard
focus does the same, so it is reachable without a pointer.

The preview deliberately **leaves the fill alone**. A bright fill already means
"sounding right now", and borrowing it for "the pointer is over this" would make
that signal ambiguous — during playback two triangles would be claiming to
sound. So the preview is carried entirely by the outline, and is told apart from
the trail's outline by being *dashed* rather than by being another colour, which
keeps it working without colour vision.

It is a separate layer from both the active chord and the trail, so a preview
can never disturb what playback is showing: the sequencer keeps advancing
underneath a held hover, and leaving clears only the preview. A triangle that is
both previewed and in the trail shows both cues at once.

## Manual mode

Click any **triangle** to hear that triad, or any **node** to hear that single
pitch. Both light every instance of what they sound, the same as playback does. Nodes are drawn after the triangles, so a circle answers
for clicks on itself and a triangle only for its open area — no overlap, no
guessing which one you hit.

A single pitch class is neither major nor minor, so a sounding note lights up in
a quality-neutral white (`NOTE_HIGHLIGHT_COLOR`) that cannot be mistaken for
either triad colour. Chord and note highlights are mutually exclusive: lighting
one clears the other, so the lattice never claims two things are sounding.

Either kind of click takes over from the sequencer, so the "Now playing" readout
never disagrees with what you are hearing. Ordering matters here, and is
commented at the call site: the run has to be stopped *before* the new highlight
is painted, because stopping clears the lattice. `playChord` / `playNote` are
sound-only for the same reason — the caller paints the highlight so it appears
at once, rather than waiting on the audio context to unlock.

## Deferred

`TODOs.md` holds the work we have consciously put off — version control,
Cloudflare deployment, and mobile support — with the measurements and open
decisions behind each.

## Out of scope for v1

Free-text numeral input, 7th chords and extensions, inversions, just
intonation, MIDI input, audio export.
