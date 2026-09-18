/**
 * Pitch-class primitives. Framework-agnostic, no Vue / no Tone.
 *
 * A pitch class is an integer 0-11 where 0 = C.
 */

export const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
export const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']

/** Semitones above the root for each supported triad quality. */
export const TRIAD_INTERVALS = {
  major: [0, 4, 7],
  minor: [0, 3, 7],
  diminished: [0, 3, 6],
  augmented: [0, 4, 8],
}

/** Qualities that occupy a triangle on the Tonnetz lattice. */
export const LATTICE_QUALITIES = ['major', 'minor']

/** True modulo: always returns 0..n-1 even for negative input. */
export function mod(n, m) {
  return ((n % m) + m) % m
}

/** Normalise any integer to a pitch class 0-11. */
export function pc(n) {
  return mod(n, 12)
}

/** Name a pitch class, sharps by default. */
export function pitchClassName(pitchClass, { flats = false } = {}) {
  return (flats ? FLAT_NAMES : SHARP_NAMES)[pc(pitchClass)]
}

/** The three pitch classes of a triad, as a sorted, de-duplicated array. */
export function triadPitchClasses(root, quality) {
  const intervals = TRIAD_INTERVALS[quality]
  if (!intervals) throw new Error(`Unknown triad quality: ${quality}`)
  return [...new Set(intervals.map((i) => pc(root + i)))].sort((a, b) => a - b)
}

/**
 * Canonical key for a set of pitch classes, so a chord can be looked up
 * regardless of the order or octave its notes arrived in.
 */
export function pitchClassSetKey(pitchClasses) {
  return [...new Set(pitchClasses.map(pc))].sort((a, b) => a - b).join(',')
}

/** Human label for a triad, e.g. "F major". */
export function chordName(root, quality, options) {
  return `${pitchClassName(root, options)} ${quality}`
}

const MIDI_NAMES_OCTAVE_OFFSET = -1

/** Scientific pitch notation for a MIDI note number, e.g. 60 -> "C4". */
export function midiToNoteName(midi, options) {
  const octave = Math.floor(midi / 12) + MIDI_NAMES_OCTAVE_OFFSET
  return `${pitchClassName(midi, options)}${octave}`
}

/** Lowest MIDI note any voicing may use; G3, which keeps triads off the mud. */
export const DEFAULT_LOWEST_MIDI = 55

/**
 * Place a pitch class at or above `lowestMidi` but within one octave of it, so
 * everything sounds in the same register whichever pitch class it is.
 */
export function pitchClassToMidi(pitchClass, { lowestMidi = DEFAULT_LOWEST_MIDI } = {}) {
  return lowestMidi + mod(pc(pitchClass) - lowestMidi, 12)
}

/** A single pitch class as a note name, e.g. 0 -> "C4". */
export function pitchClassNoteName(pitchClass, options) {
  return midiToNoteName(pitchClassToMidi(pitchClass, options), options)
}

/** Voice a triad in root position, with its root placed by `pitchClassToMidi`. */
export function triadMidiNotes(root, quality, options) {
  const rootMidi = pitchClassToMidi(root, options)
  return TRIAD_INTERVALS[quality].map((i) => rootMidi + i)
}

/** Note names for a triad, ready to hand to a Tone.js synth. */
export function triadNoteNames(root, quality, options) {
  return triadMidiNotes(root, quality, options).map((m) => midiToNoteName(m, options))
}
