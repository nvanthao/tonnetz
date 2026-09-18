import { describe, it, expect } from 'vitest'
import { simulate, deltaE, worstCase, TYPES } from '../colorVision.js'
import {
  MAJOR_COLOR,
  MINOR_COLOR,
  MAJOR_HIGHLIGHT_COLOR,
  MINOR_HIGHLIGHT_COLOR,
  NOTE_HIGHLIGHT_COLOR,
  PLAYED_COLOR,
  NODE_FILL_COLOR,
  triangleFill,
  triangleOutline,
  PREVIEW_EDGE_COLOR,
} from '../../theme.js'

/**
 * Every colour that means something, and has to survive being confused with
 * the others.
 */
const MEANINGFUL = {
  major: MAJOR_COLOR,
  minor: MINOR_COLOR,
  majorSounding: MAJOR_HIGHLIGHT_COLOR,
  minorSounding: MINOR_HIGHLIGHT_COLOR,
  noteSounding: NOTE_HIGHLIGHT_COLOR,
  played: PLAYED_COLOR,
  background: NODE_FILL_COLOR,
}

/**
 * Two colours this far apart stayed tellable apart in practice. Well under the
 * major/minor separation, but far above the dE 2.2 collapse that the violet
 * trail colour had against the minor blue under deuteranopia.
 */
const MIN_SEPARATION = 30

describe('colour vision simulation', () => {
  it('leaves colours alone for normal vision', () => {
    expect(simulate('#1e40af', 'normal')).toBe('#1e40af')
  })

  it('collapses red and green for a deuteranope but not blue and yellow', () => {
    const redGreen = deltaE(simulate('#ff0000', 'deuteranopia'), simulate('#00ff00', 'deuteranopia'))
    const blueYellow = deltaE(simulate('#0000ff', 'deuteranopia'), simulate('#ffff00', 'deuteranopia'))
    expect(redGreen).toBeLessThan(blueYellow)
  })

  it('reports a colour as identical to itself', () => {
    expect(worstCase('#8a7580', '#8a7580')).toBe(0)
  })
})

describe('the palette is legible with colour-vision deficiency', () => {
  const pairs = Object.entries(MEANINGFUL).flatMap(([nameA, a], i) =>
    Object.entries(MEANINGFUL)
      .slice(i + 1)
      .map(([nameB, b]) => [`${nameA} vs ${nameB}`, a, b]),
  )

  it.each(pairs)('%s stays distinguishable for every vision type', (_label, a, b) => {
    expect(worstCase(a, b)).toBeGreaterThan(MIN_SEPARATION)
  })

  it('never lets the trail collapse onto a triad colour, as violet once did', () => {
    // The exact regression: violet-800 against the minor blue.
    expect(worstCase('#5b21b6', MINOR_COLOR)).toBeLessThan(5)
    // And what replaced it.
    for (const triad of [MAJOR_COLOR, MINOR_COLOR]) {
      for (const type of TYPES) {
        expect(deltaE(simulate(PLAYED_COLOR, type), simulate(triad, type))).toBeGreaterThan(MIN_SEPARATION)
      }
    }
  })

  it('marks the trail by outline as well as fill, so colour is never the only cue', () => {
    const rest = triangleOutline({})
    const played = triangleOutline({ hasPlayed: true })
    expect(played.stroke).not.toBe(rest.stroke)
    // A sounding chord is already unmistakable, and keeps the normal outline.
    expect(triangleOutline({ isActive: true, hasPlayed: true })).toEqual(rest)
    expect(worstCase(played.stroke, PLAYED_COLOR)).toBeGreaterThan(MIN_SEPARATION)
  })

  it('separates a preview from the trail by dash, not by colour alone', () => {
    const preview = triangleOutline({ isPreview: true })
    const played = triangleOutline({ hasPlayed: true })
    expect(preview.dash).toBeTruthy()
    expect(played.dash).toBeNull()
    expect(preview.width).toBeGreaterThan(played.width)
    expect(preview.stroke).toBe(PREVIEW_EDGE_COLOR)
  })

  it('lets a preview outline any state without changing its fill', () => {
    // A bright fill means "sounding"; a preview must never borrow that.
    for (const state of [{}, { hasPlayed: true }, { isActive: true }]) {
      expect(triangleFill('major', { ...state, isPreview: true })).toBe(triangleFill('major', state))
      expect(triangleOutline({ ...state, isPreview: true }).dash).toBeTruthy()
    }
  })

  it('distinguishes the trail from a triad by saturation, not by hue', () => {
    const saturation = (hex) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
      const max = Math.max(r, g, b)
      const min = Math.min(r, g, b)
      return max === 0 ? 0 : (max - min) / max
    }
    expect(saturation(PLAYED_COLOR)).toBeLessThan(saturation(MAJOR_COLOR))
    expect(saturation(PLAYED_COLOR)).toBeLessThan(saturation(MINOR_COLOR))
  })
})

describe('triangleFill precedence', () => {
  it('ranks sounding above played above at rest', () => {
    const rest = triangleFill('major', {})
    const played = triangleFill('major', { hasPlayed: true })
    const active = triangleFill('major', { isActive: true })
    expect(new Set([rest, played, active]).size).toBe(3)
    expect(triangleFill('major', { isActive: true, hasPlayed: true })).toBe(active)
  })
})
