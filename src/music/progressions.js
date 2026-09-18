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
  { id: 'canon', name: 'Pachelbel (short)', numerals: ['I', 'V', 'vi', 'iii', 'IV'], mode: 'major' },
  { id: 'doo-wop-minor', name: 'Minor pop', numerals: ['i', 'VI', 'III', 'VII'], mode: 'minor' },
  { id: 'andalusian', name: 'Andalusian cadence', numerals: ['i', 'VII', 'VI', 'V'], mode: 'minor' },
  { id: 'hexatonic', name: 'Hexatonic cycle', numerals: ['I', 'i', 'bVI', 'bvi', 'III', 'iii'], mode: 'major' },
]

/** Pretty label for the numerals, e.g. "I – V – vi – IV". */
export function progressionLabel(progression) {
  return progression.numerals.join(' – ')
}

export function findProgression(id) {
  return PROGRESSIONS.find((p) => p.id === id)
}
