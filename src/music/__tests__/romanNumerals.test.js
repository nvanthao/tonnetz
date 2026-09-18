import { describe, it, expect } from 'vitest'
import { parseRomanNumeral, resolveRomanNumeral, resolveProgression } from '../romanNumerals.js'
import { PROGRESSIONS } from '../progressions.js'

describe('parseRomanNumeral', () => {
  it('reads quality from case', () => {
    expect(parseRomanNumeral('IV')).toMatchObject({ degree: 4, quality: 'major' })
    expect(parseRomanNumeral('vi')).toMatchObject({ degree: 6, quality: 'minor' })
  })

  it('reads accidentals', () => {
    expect(parseRomanNumeral('bVII')).toMatchObject({ degree: 7, accidentalOffset: -1 })
    expect(parseRomanNumeral('#iv')).toMatchObject({ degree: 4, accidentalOffset: 1 })
  })

  it('reads diminished and augmented suffixes', () => {
    expect(parseRomanNumeral('vii°')).toMatchObject({ quality: 'diminished' })
    expect(parseRomanNumeral('viio')).toMatchObject({ quality: 'diminished' })
    expect(parseRomanNumeral('III+')).toMatchObject({ quality: 'augmented' })
  })

  it('returns null for nonsense', () => {
    expect(parseRomanNumeral('H')).toBeNull()
    expect(parseRomanNumeral('viii')).toBeNull()
    expect(parseRomanNumeral('')).toBeNull()
  })
})

describe('resolveRomanNumeral', () => {
  const C = { tonic: 0, mode: 'major' }

  it('resolves the major scale', () => {
    expect(resolveRomanNumeral('I', C)).toMatchObject({ root: 0, quality: 'major', name: 'C major' })
    expect(resolveRomanNumeral('IV', C)).toMatchObject({ root: 5, quality: 'major' })
    expect(resolveRomanNumeral('vi', C)).toMatchObject({ root: 9, quality: 'minor' })
  })

  it('resolves natural minor degrees without flats', () => {
    const a = { tonic: 9, mode: 'minor' }
    expect(resolveRomanNumeral('i', a)).toMatchObject({ root: 9, quality: 'minor' })
    expect(resolveRomanNumeral('VI', a)).toMatchObject({ root: 5, quality: 'major' }) // F
    expect(resolveRomanNumeral('VII', a)).toMatchObject({ root: 7, quality: 'major' }) // G
    expect(resolveRomanNumeral('V', a)).toMatchObject({ root: 4, quality: 'major' }) // E (borrowed)
  })

  it('applies accidentals to the resolved degree', () => {
    expect(resolveRomanNumeral('bVI', C)).toMatchObject({ root: 8, quality: 'major' })
    expect(resolveRomanNumeral('bvi', C)).toMatchObject({ root: 8, quality: 'minor' })
  })

  it('wraps around the octave', () => {
    expect(resolveRomanNumeral('V', { tonic: 7, mode: 'major' })).toMatchObject({ root: 2 })
  })

  it('throws on bad input', () => {
    expect(() => resolveRomanNumeral('nope', C)).toThrow()
    expect(() => resolveRomanNumeral('I', { tonic: 0, mode: 'lydian' })).toThrow()
  })
})

describe('resolveProgression', () => {
  it('resolves ii - V - I in C', () => {
    const chords = resolveProgression(['ii', 'V', 'I'], { tonic: 0, mode: 'major' })
    expect(chords.map((c) => c.name)).toEqual(['D minor', 'G major', 'C major'])
  })

  it('resolves every catalogue entry in every key to a lattice triad', () => {
    for (const progression of PROGRESSIONS) {
      for (let tonic = 0; tonic < 12; tonic++) {
        const chords = resolveProgression(progression.numerals, { tonic, mode: progression.mode })
        expect(chords).toHaveLength(progression.numerals.length)
        for (const chord of chords) {
          expect(['major', 'minor']).toContain(chord.quality)
        }
      }
    }
  })
})

describe('resolveProgression with resolveToTonic', () => {
  const C = { tonic: 0, mode: 'major' }
  const symbols = (numerals, key) =>
    resolveProgression(numerals, key, { resolveToTonic: true }).map((c) => c.symbol)

  it('lands I - IV - V back on the tonic', () => {
    expect(symbols(['I', 'IV', 'V'], C)).toEqual(['I', 'IV', 'V', 'I'])
  })

  it('leaves a progression that already ends on the tonic alone', () => {
    expect(symbols(['ii', 'V', 'I'], C)).toEqual(['ii', 'V', 'I'])
  })

  it('treats a tonic of the other quality as already home', () => {
    // Ending on a Picardy I in a minor key should not append a redundant i.
    expect(symbols(['i', 'iv', 'I'], { tonic: 9, mode: 'minor' })).toEqual(['i', 'iv', 'I'])
  })

  it('uses the minor tonic in a minor key', () => {
    expect(symbols(['i', 'VII', 'VI', 'V'], { tonic: 9, mode: 'minor' })).toEqual([
      'i', 'VII', 'VI', 'V', 'i',
    ])
  })

  it('flags only the appended chord', () => {
    const chords = resolveProgression(['I', 'IV', 'V'], C, { resolveToTonic: true })
    expect(chords.map((c) => Boolean(c.isResolution))).toEqual([false, false, false, true])
    expect(chords.at(-1)).toMatchObject({ root: 0, quality: 'major', name: 'C major' })
  })

  it('is off by default', () => {
    expect(resolveProgression(['I', 'IV', 'V'], C)).toHaveLength(3)
  })

  it('never appends a chord that is missing from the lattice', () => {
    for (const progression of PROGRESSIONS) {
      for (let tonic = 0; tonic < 12; tonic++) {
        const chords = resolveProgression(
          progression.numerals,
          { tonic, mode: progression.mode },
          { resolveToTonic: true },
        )
        expect(chords.at(-1).root).toBe(tonic)
        expect(['major', 'minor']).toContain(chords.at(-1).quality)
      }
    }
  })
})
