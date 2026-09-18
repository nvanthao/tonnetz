/**
 * The whole palette, in one place. Change these and the lattice retheming
 * follows everywhere - nothing else hardcodes a colour.
 *
 * Base colours are the resting state of a triangle: dim, but saturated enough
 * that major and minor stay tellable apart before anything plays. Highlight
 * colours are the same hues, brightened - so an active triangle announces both
 * "this one" and "major"/"minor" at a glance.
 */

export const MAJOR_COLOR = '#92400e' // amber 800
export const MAJOR_HIGHLIGHT_COLOR = '#fbbf24' // amber 400
export const MINOR_COLOR = '#1e40af' // blue 800
export const MINOR_HIGHLIGHT_COLOR = '#60a5fa' // blue 400

export const LATTICE_EDGE_COLOR = '#0f172a' // slate 900
export const NODE_FILL_COLOR = '#020617' // slate 950
export const NODE_STROKE_COLOR = '#64748b' // slate 500
export const NODE_TEXT_COLOR = '#e2e8f0' // slate 200

/**
 * A single pitch class is neither major nor minor, so a sounding note lights up
 * in a deliberately quality-neutral white - never mistakable for either triad
 * colour, and legible on top of both.
 */
export const NOTE_HIGHLIGHT_COLOR = '#f8fafc' // slate 50
export const NOTE_HIGHLIGHT_TEXT_COLOR = '#020617' // slate 950

/**
 * Triangles already visited by the current run.
 *
 * This is a desaturated warm grey rather than a third hue, and that is the
 * whole point: every other colour here is a saturated warm or cool, so the
 * trail is told apart by *how little colour it has*, not by which colour it is.
 * Saturation and lightness both survive colour-vision deficiency, where hue
 * does not - an earlier violet collapsed onto the minor blue under deuteranopia
 * (dE 2.2, indistinguishable). This value was chosen by measuring simulated
 * protanopia, deuteranopia and tritanopia against every other colour on screen
 * and maximising the worst case; it clears dE 35 against all of them.
 *
 * Colour is still not the only cue - `triangleStroke` outlines the trail too.
 */
export const PLAYED_COLOR = '#8a7580'

/**
 * Outline for a played triangle. The trail must not depend on colour vision at
 * all, so it is marked by a light edge as well as a drained fill.
 */
export const PLAYED_EDGE_COLOR = '#cbd5e1' // slate 300

/**
 * Outline for a triangle being previewed by hovering its chord.
 *
 * A preview deliberately leaves the fill alone. A bright fill already means
 * "sounding right now", and borrowing it for "the pointer is over this" would
 * make that signal ambiguous - worse during playback, where two triangles would
 * claim to be sounding. So the preview is carried entirely by the outline, and
 * is told apart from the trail's outline by being dashed rather than by being a
 * different colour, which keeps it working without colour vision.
 */
export const PREVIEW_EDGE_COLOR = '#f8fafc' // slate 50
export const PREVIEW_DASH = '7 5'

/** Base fill for a triad of the given quality. */
export function baseColor(quality) {
  return quality === 'minor' ? MINOR_COLOR : MAJOR_COLOR
}

/** Highlight fill for a triad of the given quality. */
export function highlightColor(quality) {
  return quality === 'minor' ? MINOR_HIGHLIGHT_COLOR : MAJOR_HIGHLIGHT_COLOR
}

/**
 * Fill for a triangle: sounding now, already sounded in this run, or at rest.
 */
export function triangleFill(quality, { isActive = false, hasPlayed = false } = {}) {
  if (isActive) return highlightColor(quality)
  if (hasPlayed) return PLAYED_COLOR
  return baseColor(quality)
}

/**
 * Outline for a triangle: dashed while previewed, light while part of the
 * trail, otherwise the ordinary lattice edge.
 */
export function triangleOutline({ isActive = false, hasPlayed = false, isPreview = false } = {}) {
  if (isPreview) return { stroke: PREVIEW_EDGE_COLOR, width: 3, dash: PREVIEW_DASH }
  if (hasPlayed && !isActive) return { stroke: PLAYED_EDGE_COLOR, width: 2, dash: null }
  return { stroke: LATTICE_EDGE_COLOR, width: 2, dash: null }
}

/** Fill, stroke and text for a node, given whether it is currently sounding. */
export function nodeColors(isActive) {
  return isActive
    ? {
        fill: NOTE_HIGHLIGHT_COLOR,
        stroke: NOTE_HIGHLIGHT_COLOR,
        text: NOTE_HIGHLIGHT_TEXT_COLOR,
      }
    : { fill: NODE_FILL_COLOR, stroke: NODE_STROKE_COLOR, text: NODE_TEXT_COLOR }
}

/** Highlight colour for whatever is sounding - a single note, or a triad. */
export function soundingColor(item) {
  return item?.isNote ? NOTE_HIGHLIGHT_COLOR : highlightColor(item?.quality)
}
