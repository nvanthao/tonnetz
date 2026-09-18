/**
 * Tonnetz lattice generation.
 *
 * Lattice coordinates (x, y) are integers. The pitch class of a node is
 *
 *     pc(x, y) = 7x + 4y  (mod 12)
 *
 * so stepping +x rises a perfect fifth and stepping +y rises a major third.
 * Drawn on a triangular grid - each row offset half a cell to the right of the
 * row below - those two axes plus the (-1, +1) diagonal (a minor third) give
 * every node six neighbours.
 *
 * Every horizontal edge (x, y) - (x+1, y) carries exactly two triangles:
 *
 *   apex above at (x,   y+1): { p, p+7, p+4 } = major triad rooted on p
 *   apex below at (x+1, y-1): { p, p+7, p+3 } = minor triad rooted on p
 *
 * where p = pc(x, y). Both triangles are therefore rooted on the same node,
 * which is what makes the lattice readable: the root sits at the left corner
 * of the shared edge.
 *
 * The map is periodic - the plane wraps onto a torus - so any given triad
 * appears at several places in a large enough patch. `trianglesForChord`
 * returns every one of them.
 */

import { pc, pitchClassName, pitchClassSetKey, triadPitchClasses } from './pitch.js'

/** Semitones per step along each lattice axis. */
export const FIFTH_STEP = 7
export const MAJOR_THIRD_STEP = 4

/** Height of an equilateral triangle whose side is 1. */
const ROW_HEIGHT_RATIO = Math.sqrt(3) / 2

/**
 * The visible patch. Sized so that every progression in the catalogue, in all
 * twelve keys, can be drawn as a fully connected walk - chords that share two
 * notes land on triangles that share an edge, with no jump to a distant copy.
 * A smaller patch is prettier but strands the long chains: the hexatonic cycle
 * is six triangles that march across the lattice rather than closing a ring,
 * and it needs the room. `npm test` asserts the coverage this buys.
 */
export const DEFAULT_BOUNDS = { minX: -3, maxX: 5, minY: -2, maxY: 3 }

/** Pitch class of the node at lattice coordinate (x, y). */
export function nodePitchClass(x, y) {
  return pc(FIFTH_STEP * x + MAJOR_THIRD_STEP * y)
}

function nodeId(x, y) {
  return `${x},${y}`
}

/**
 * Screen position of a lattice node, in "cell" units: x to the right, y down.
 * Rows shift half a cell right per step up, producing the triangular grid.
 */
export function nodePosition(x, y, { spacing = 1 } = {}) {
  return {
    x: (x + y / 2) * spacing,
    y: -y * spacing * ROW_HEIGHT_RATIO,
  }
}

/**
 * Build the lattice: every node in `bounds`, and every triangle whose three
 * corners all fall inside it.
 *
 * @returns {{nodes: Array, triangles: Array, chordIndex: Map, viewBox: Object}}
 */
export function createTonnetz({ bounds = DEFAULT_BOUNDS, spacing = 100, padding = 44 } = {}) {
  const { minX, maxX, minY, maxY } = bounds

  const nodes = []
  const nodesById = new Map()
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const position = nodePosition(x, y, { spacing })
      const node = {
        id: nodeId(x, y),
        x,
        y,
        pitchClass: nodePitchClass(x, y),
        name: pitchClassName(nodePitchClass(x, y)),
        cx: position.x,
        cy: position.y,
      }
      nodes.push(node)
      nodesById.set(node.id, node)
    }
  }

  const triangles = []
  const chordIndex = new Map()

  const addTriangle = (corners, quality, root) => {
    const cornerNodes = corners.map(([x, y]) => nodesById.get(nodeId(x, y)))
    if (cornerNodes.some((n) => !n)) return // clipped by the bounds

    const pitchClasses = triadPitchClasses(root, quality)
    const triangle = {
      id: `${quality}:${corners.map(([x, y]) => `${x}_${y}`).join('-')}`,
      quality,
      root,
      pitchClasses,
      chordKey: pitchClassSetKey(pitchClasses),
      nodes: cornerNodes,
      points: cornerNodes.map((n) => `${round(n.cx)},${round(n.cy)}`).join(' '),
      centroid: {
        x: round(cornerNodes.reduce((sum, n) => sum + n.cx, 0) / 3),
        y: round(cornerNodes.reduce((sum, n) => sum + n.cy, 0) / 3),
      },
    }
    triangles.push(triangle)

    const existing = chordIndex.get(triangle.chordKey)
    if (existing) existing.push(triangle)
    else chordIndex.set(triangle.chordKey, [triangle])
  }

  // One pass over the horizontal edges; each contributes a major and a minor.
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x < maxX; x++) {
      const root = nodePitchClass(x, y)
      addTriangle([[x, y], [x + 1, y], [x, y + 1]], 'major', root)
      addTriangle([[x, y], [x + 1, y], [x + 1, y - 1]], 'minor', root)
    }
  }

  return { nodes, triangles, chordIndex, viewBox: computeViewBox(nodes, padding) }
}

function round(n) {
  return Math.round(n * 1000) / 1000
}

function computeViewBox(nodes, padding) {
  const xs = nodes.map((n) => n.cx)
  const ys = nodes.map((n) => n.cy)
  const minX = Math.min(...xs) - padding
  const minY = Math.min(...ys) - padding
  const width = Math.max(...xs) - Math.min(...xs) + padding * 2
  const height = Math.max(...ys) - Math.min(...ys) + padding * 2
  return { minX, minY, width, height, value: `${minX} ${minY} ${width} ${height}` }
}

/** Every triangle in the lattice matching a chord. Empty for non-triadic chords. */
export function trianglesForChord(tonnetz, { root, quality }) {
  if (quality !== 'major' && quality !== 'minor') return []
  const key = pitchClassSetKey(triadPitchClasses(root, quality))
  const matches = tonnetz.chordIndex.get(key) ?? []
  // A pitch-class set alone cannot distinguish a triad from its inversions,
  // but major and minor sets never collide, so quality is enough to be exact.
  return matches.filter((t) => t.quality === quality)
}

/** How many of the 24 consonant triads the lattice actually shows. */
export function coveredTriadCount(tonnetz) {
  return new Set(tonnetz.triangles.map((t) => `${t.quality}:${t.root}`)).size
}

/**
 * How hard the layout is pulled toward the middle of the lattice, relative to
 * the cost of a step between chords. Small: a tie-breaker, never a reason to
 * break an adjacency.
 */
export const CENTRE_WEIGHT = 0.02

/** Geometric centre of the lattice, in the same space as triangle centroids. */
export function latticeCentre(tonnetz) {
  const { minX, minY, width, height } = tonnetz.viewBox
  return { x: minX + width / 2, y: minY + height / 2 }
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/**
 * Choose exactly one triangle per chord, so a progression reads as a connected
 * walk across the lattice instead of a scatter of identical triads.
 *
 * The lattice is periodic, so most triads appear two or three times in the
 * visible patch. Lighting all of them destroys the thing the Tonnetz is for:
 * you cannot see that F major is the triangle hinged on the C you just heard.
 * So each chord gets the instance that keeps the walk tight.
 *
 * Choosing greedily left to right can strand a later chord at the far edge, so
 * this minimises the *whole* path at once - a small dynamic program over the
 * candidates (at most three per chord, a handful of chords). Plain centroid
 * distance is all the metric needs to be: triangles sharing an edge are by
 * construction the closest pair there is, and ones sharing a single corner the
 * next closest, so parsimonious voice leading falls out of the geometry rather
 * than needing a rule of its own.
 *
 * Staying near the middle of the lattice is a tie-breaker and nothing more. It
 * carries `CENTRE_WEIGHT`, small enough that it can never buy a shorter step
 * between chords - a centred walk that breaks an adjacency is the wrong answer -
 * but large enough to settle which of several equally tight walks to draw, and
 * to place a single chord sensibly when there are no steps at all.
 *
 * @returns {Array<object|null>} one triangle per chord, aligned with `chords`;
 *   null for a chord with no triangle (diminished, augmented), which the walk
 *   steps over without breaking the chain.
 */
export function layoutProgression(tonnetz, chords, { centre, centreWeight = CENTRE_WEIGHT } = {}) {
  const origin = centre ?? latticeCentre(tonnetz)
  const path = chords.map(() => null)

  const steps = chords
    .map((chord, index) => ({ index, candidates: trianglesForChord(tonnetz, chord) }))
    .filter((step) => step.candidates.length)
  if (!steps.length) return path

  const pull = (triangle) => centreWeight * distance(triangle.centroid, origin)

  // Each state is a candidate for the current step, plus the cheapest route to it.
  let routes = steps[0].candidates.map((triangle) => ({
    cost: pull(triangle),
    taken: [triangle],
  }))

  for (const step of steps.slice(1)) {
    routes = step.candidates.map((triangle) => {
      let best = null
      for (const route of routes) {
        const cost =
          route.cost +
          distance(route.taken[route.taken.length - 1].centroid, triangle.centroid) +
          pull(triangle)
        if (!best || cost < best.cost) best = { cost, taken: [...route.taken, triangle] }
      }
      return best
    })
  }

  const winner = routes.reduce((a, b) => (b.cost < a.cost ? b : a))
  steps.forEach((step, i) => {
    path[step.index] = winner.taken[i]
  })
  return path
}

/** How many corners two triangles share: 2 = a shared edge, 1 = a shared node. */
export function sharedCornerCount(a, b) {
  if (!a || !b) return 0
  const ids = new Set(a.nodes.map((n) => n.id))
  return b.nodes.filter((n) => ids.has(n.id)).length
}
