/**
 * Built-in progression catalogue. Add entries freely - nothing else depends
 * on the length or contents of this list.
 *
 * Numerals are written relative to the scale of the progression's own `mode`
 * (so in minor, the natural-minor degrees III / VI / VII need no flat sign).
 * Selecting a progression switches the key to that mode.
 */

export const PROGRESSIONS = [
  { id: 'classic', name: 'Classic', numerals: ['I', 'IV', 'V'], mode: 'major' },
  { id: 'pop', name: 'Pop', numerals: ['I', 'V', 'vi', 'IV'], mode: 'major' },
  { id: 'jazz-cadence', name: 'Jazz cadence', numerals: ['ii', 'V', 'I'], mode: 'major' },
  { id: 'fifties', name: '50s progression', numerals: ['I', 'vi', 'IV', 'V'], mode: 'major' },
  { id: 'modern-pop', name: 'Modern pop', numerals: ['vi', 'IV', 'I', 'V'], mode: 'major' },
  { id: 'plagal-turn', name: 'Plagal turnaround', numerals: ['I', 'IV', 'vi', 'V'], mode: 'major' },
  { id: 'canon', name: 'Canon', numerals: ['I', 'V', 'vi', 'iii', 'IV'], mode: 'major' },
  { id: 'turnaround', name: 'Turnaround', numerals: ['I', 'vi', 'ii', 'V'], mode: 'major' },
  { id: 'three-chord-rock', name: 'Three-chord rock', numerals: ['I', 'V', 'IV', 'V'], mode: 'major' },
  { id: 'relative-minor-loop', name: 'Relative minor loop', numerals: ['vi', 'V', 'IV', 'V'], mode: 'major' },
  { id: 'mixolydian', name: 'Mixolydian rock', numerals: ['I', 'bVII', 'IV'], mode: 'major' },
  { id: 'doo-wop-minor', name: 'Minor pop', numerals: ['i', 'VI', 'III', 'VII'], mode: 'minor' },
  { id: 'andalusian', name: 'Andalusian cadence', numerals: ['i', 'VII', 'VI', 'V'], mode: 'minor' },
  { id: 'minor-classic', name: 'Minor classic', numerals: ['i', 'iv', 'V'], mode: 'minor' },
  { id: 'minor-rock', name: 'Minor rock', numerals: ['i', 'VII', 'iv', 'V'], mode: 'minor' },
  { id: 'hexatonic', name: 'Hexatonic cycle', numerals: ['I', 'i', 'bVI', 'bvi', 'III', 'iii'], mode: 'major' },
]

/** Pretty label for the numerals, e.g. "I – V – vi – IV". */
export function progressionLabel(progression) {
  return progression.numerals.join(' – ')
}

export function findProgression(id) {
  return PROGRESSIONS.find((p) => p.id === id)
}
