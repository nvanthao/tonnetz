/**
 * Roman numeral -> concrete triad resolution.
 *
 * Deliberately generic: `parseRomanNumeral` accepts any well-formed numeral,
 * not just the ones used by the built-in progression catalogue, so free-text
 * input can be layered on later without changing this module.
 */

import { pc, chordName } from './pitch.js'

/** Semitone offset of each scale degree, by mode. */
export const SCALE_STEPS = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10], // natural minor
}

export const MODES = Object.keys(SCALE_STEPS)

const DEGREE_BY_NUMERAL = {
  i: 1,
  ii: 2,
  iii: 3,
  iv: 4,
  v: 5,
  vi: 6,
  vii: 7,
}

const ACCIDENTAL_OFFSETS = { '': 0, b: -1, bb: -2, '#': 1, '##': 2 }

const NUMERAL_PATTERN = /^(b{1,2}|#{1,2})?([ivIV]+)(o|°|dim|\+|aug)?$/

/**
 * Break a numeral into its parts without reference to any key.
 * Returns null when the token is not a valid numeral.
 */
export function parseRomanNumeral(numeral) {
  const match = NUMERAL_PATTERN.exec(String(numeral).trim())
  if (!match) return null

  const [, accidental = '', letters, suffix = ''] = match
  const degree = DEGREE_BY_NUMERAL[letters.toLowerCase()]
  if (!degree) return null

  const isUpperCase = letters === letters.toUpperCase()
  let quality = isUpperCase ? 'major' : 'minor'
  if (suffix === 'o' || suffix === '°' || suffix === 'dim') quality = 'diminished'
  else if (suffix === '+' || suffix === 'aug') quality = 'augmented'

  return {
    degree,
    quality,
    accidentalOffset: ACCIDENTAL_OFFSETS[accidental],
    symbol: match[0],
  }
}

/**
 * Resolve one numeral against a key.
 * @returns {{root: number, quality: string, symbol: string, name: string}}
 */
export function resolveRomanNumeral(numeral, { tonic, mode = 'major' }) {
  const parsed = parseRomanNumeral(numeral)
  if (!parsed) throw new Error(`Unrecognised Roman numeral: ${numeral}`)

  const steps = SCALE_STEPS[mode]
  if (!steps) throw new Error(`Unknown mode: ${mode}`)

  const root = pc(tonic + steps[parsed.degree - 1] + parsed.accidentalOffset)
  return {
    root,
    quality: parsed.quality,
    symbol: parsed.symbol,
    name: chordName(root, parsed.quality),
  }
}

/** The numeral for degree 1 in each mode. */
export const TONIC_NUMERAL = { major: 'I', minor: 'i' }

/**
 * Resolve a whole progression (array of numerals) against a key.
 *
 * With `resolveToTonic`, the progression lands home: I - IV - V plays as
 * I - IV - V - I. The check is on the resolved root rather than the numeral
 * text, so a progression already ending on the tonic - ii - V - I, or a minor
 * one closing on a Picardy I - is left alone instead of gaining a redundant
 * repeat.
 */
export function resolveProgression(numerals, key, { resolveToTonic = false } = {}) {
  const chords = numerals.map((numeral) => resolveRomanNumeral(numeral, key))

  const last = chords[chords.length - 1]
  if (!resolveToTonic || !last || last.root === pc(key.tonic)) return chords

  const tonic = resolveRomanNumeral(TONIC_NUMERAL[key.mode ?? 'major'], key)
  return [...chords, { ...tonic, isResolution: true }]
}
