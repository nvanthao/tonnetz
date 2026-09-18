import { describe, it, expect } from 'vitest'
import {
  mod,
  pc,
  pitchClassName,
  triadPitchClasses,
  pitchClassSetKey,
  triadMidiNotes,
  triadNoteNames,
  midiToNoteName,
  pitchClassToMidi,
  pitchClassNoteName,
  DEFAULT_LOWEST_MIDI,
} from '../pitch.js'

describe('mod / pc', () => {
  it('is positive for negative input', () => {
    expect(mod(-1, 12)).toBe(11)
    expect(pc(-5)).toBe(7)
    expect(pc(24)).toBe(0)
  })
})

describe('pitchClassName', () => {
  it('uses sharps by default and flats on request', () => {
    expect(pitchClassName(1)).toBe('C#')
    expect(pitchClassName(1, { flats: true })).toBe('Db')
    expect(pitchClassName(13)).toBe('C#')
  })
})

describe('triadPitchClasses', () => {
  it('builds major and minor triads', () => {
    expect(triadPitchClasses(0, 'major')).toEqual([0, 4, 7])
    expect(triadPitchClasses(9, 'minor')).toEqual([0, 4, 9])
    expect(triadPitchClasses(11, 'diminished')).toEqual([2, 5, 11])
  })

  it('rejects unknown qualities', () => {
    expect(() => triadPitchClasses(0, 'sus4')).toThrow()
  })
})

describe('pitchClassSetKey', () => {
  it('is order- and octave-independent', () => {
    expect(pitchClassSetKey([7, 0, 4])).toBe(pitchClassSetKey([12, 16, 19]))
  })

  it('never collides between a major and a minor triad', () => {
    const keys = new Set()
    for (let root = 0; root < 12; root++) {
      keys.add(pitchClassSetKey(triadPitchClasses(root, 'major')))
      keys.add(pitchClassSetKey(triadPitchClasses(root, 'minor')))
    }
    expect(keys.size).toBe(24)
  })
})

describe('voicing', () => {
  it('names midi notes', () => {
    expect(midiToNoteName(60)).toBe('C4')
    expect(midiToNoteName(55)).toBe('G3')
  })

  it('keeps every root inside one octave of the floor', () => {
    for (let root = 0; root < 12; root++) {
      const [low] = triadMidiNotes(root, 'major')
      expect(low).toBeGreaterThanOrEqual(55)
      expect(low).toBeLessThan(67)
      expect(pc(low)).toBe(root)
    }
  })

  it('voices a C major triad in root position', () => {
    expect(triadNoteNames(0, 'major')).toEqual(['C4', 'E4', 'G4'])
    expect(triadNoteNames(9, 'minor')).toEqual(['A3', 'C4', 'E4'])
  })
})

describe('single-pitch voicing', () => {
  it('places every pitch class inside one octave of the floor', () => {
    for (let pitchClass = 0; pitchClass < 12; pitchClass++) {
      const midi = pitchClassToMidi(pitchClass)
      expect(midi).toBeGreaterThanOrEqual(DEFAULT_LOWEST_MIDI)
      expect(midi).toBeLessThan(DEFAULT_LOWEST_MIDI + 12)
      expect(pc(midi)).toBe(pitchClass)
    }
  })

  it('names a clicked node in the same register a chord would use', () => {
    expect(pitchClassNoteName(0)).toBe('C4')
    expect(pitchClassNoteName(7)).toBe('G3')
    // A note sounds at exactly the pitch that triad would put its root on.
    for (let root = 0; root < 12; root++) {
      expect(pitchClassToMidi(root)).toBe(triadMidiNotes(root, 'major')[0])
    }
  })

  it('normalises out-of-range pitch classes', () => {
    expect(pitchClassNoteName(12)).toBe(pitchClassNoteName(0))
    expect(pitchClassNoteName(-1)).toBe(pitchClassNoteName(11))
  })
})
