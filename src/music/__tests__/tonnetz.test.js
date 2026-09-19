import { describe, it, expect } from 'vitest'
import {
  createTonnetz,
  nodePitchClass,
  nodePosition,
  trianglesForChord,
  coveredTriadCount,
  triangleLabelsForChords,
  layoutProgression,
  sharedCornerCount,
  latticeCentre,
  CENTRE_WEIGHT,
  DEFAULT_BOUNDS,
} from '../tonnetz.js'
import { pitchClassSetKey, triadPitchClasses } from '../pitch.js'
import { resolveProgression } from '../romanNumerals.js'
import { PROGRESSIONS, findProgression } from '../progressions.js'

const tonnetz = createTonnetz()

describe('nodePitchClass', () => {
  it('steps a fifth along x and a major third along y', () => {
    expect(nodePitchClass(0, 0)).toBe(0)
    expect(nodePitchClass(1, 0)).toBe(7)
    expect(nodePitchClass(0, 1)).toBe(4)
    expect(nodePitchClass(-1, 0)).toBe(5)
    expect(nodePitchClass(0, -1)).toBe(8)
  })

  it('is periodic on the torus', () => {
    expect(nodePitchClass(12, 0)).toBe(nodePitchClass(0, 0))
    expect(nodePitchClass(0, 3)).toBe(nodePitchClass(0, 0))
  })
})

describe('nodePosition', () => {
  it('offsets each row half a cell', () => {
    expect(nodePosition(0, 0, { spacing: 100 })).toEqual({ x: 0, y: -0 })
    expect(nodePosition(1, 0, { spacing: 100 }).x).toBe(100)
    expect(nodePosition(0, 1, { spacing: 100 }).x).toBe(50)
  })

  it('puts rising thirds higher on screen', () => {
    expect(nodePosition(0, 1, { spacing: 100 }).y).toBeLessThan(0)
  })

  it('makes equilateral triangles', () => {
    const spacing = 100
    const a = nodePosition(0, 0, { spacing })
    const b = nodePosition(1, 0, { spacing })
    const c = nodePosition(0, 1, { spacing })
    const d = (p, q) => Math.hypot(p.x - q.x, p.y - q.y)
    expect(d(a, b)).toBeCloseTo(spacing)
    expect(d(a, c)).toBeCloseTo(spacing)
    expect(d(b, c)).toBeCloseTo(spacing)
  })
})

describe('createTonnetz', () => {
  it('generates one node per lattice point', () => {
    const { minX, maxX, minY, maxY } = DEFAULT_BOUNDS
    expect(tonnetz.nodes).toHaveLength((maxX - minX + 1) * (maxY - minY + 1))
  })

  it('only keeps triangles whose corners are all inside the bounds', () => {
    const ids = new Set(tonnetz.nodes.map((n) => n.id))
    for (const triangle of tonnetz.triangles) {
      expect(triangle.nodes).toHaveLength(3)
      for (const node of triangle.nodes) expect(ids.has(node.id)).toBe(true)
    }
  })

  it('gives every triangle the pitch classes of its three corners', () => {
    for (const triangle of tonnetz.triangles) {
      const corners = pitchClassSetKey(triangle.nodes.map((n) => n.pitchClass))
      expect(corners).toBe(triangle.chordKey)
      expect(triangle.chordKey).toBe(pitchClassSetKey(triadPitchClasses(triangle.root, triangle.quality)))
    }
  })

  it('makes upward triangles major and downward triangles minor', () => {
    const major = tonnetz.triangles.filter((t) => t.quality === 'major')
    const minor = tonnetz.triangles.filter((t) => t.quality === 'minor')
    expect(major.length).toBeGreaterThan(0)
    expect(minor.length).toBeGreaterThan(0)
    // The apex of a major triangle sits above its shared edge, a minor below.
    for (const t of major) expect(Math.min(...t.nodes.map((n) => n.cy))).toBeLessThan(t.centroid.y)
    for (const t of minor) expect(Math.max(...t.nodes.map((n) => n.cy))).toBeGreaterThan(t.centroid.y)
  })

  it('shows all 24 consonant triads without panning', () => {
    expect(coveredTriadCount(tonnetz)).toBe(24)
  })

  it('has a viewBox enclosing every node', () => {
    const { minX, minY, width, height } = tonnetz.viewBox
    for (const node of tonnetz.nodes) {
      expect(node.cx).toBeGreaterThanOrEqual(minX)
      expect(node.cx).toBeLessThanOrEqual(minX + width)
      expect(node.cy).toBeGreaterThanOrEqual(minY)
      expect(node.cy).toBeLessThanOrEqual(minY + height)
    }
  })

  it('gives neighbouring triangles a shared edge (neo-Riemannian adjacency)', () => {
    // C major and A minor differ by one note and must touch.
    const cMajor = trianglesForChord(tonnetz, { root: 0, quality: 'major' })[0]
    const aMinor = trianglesForChord(tonnetz, { root: 9, quality: 'minor' })
    const shared = aMinor.some((t) => {
      const ids = new Set(t.nodes.map((n) => n.id))
      return cMajor.nodes.filter((n) => ids.has(n.id)).length === 2
    })
    expect(shared).toBe(true)
  })
})

describe('trianglesForChord', () => {
  it('finds every instance of a triad', () => {
    for (let root = 0; root < 12; root++) {
      for (const quality of ['major', 'minor']) {
        const found = trianglesForChord(tonnetz, { root, quality })
        expect(found.length).toBeGreaterThan(0)
        for (const t of found) {
          expect(t.quality).toBe(quality)
          expect(t.root).toBe(root)
        }
      }
    }
  })

  it('returns nothing for chords with no triangle', () => {
    expect(trianglesForChord(tonnetz, { root: 0, quality: 'diminished' })).toEqual([])
    expect(trianglesForChord(tonnetz, { root: 0, quality: 'augmented' })).toEqual([])
  })

  it('is a precomputed lookup, not a scan', () => {
    expect(tonnetz.chordIndex.size).toBe(24)
  })
})

describe('progressions on the lattice', () => {
  it('walks the hexatonic cycle one shared edge at a time', () => {
    const chords = resolveProgression(findProgression('hexatonic').numerals, { tonic: 0, mode: 'major' })
    expect(chords).toHaveLength(6)

    // Every consecutive pair - and the wrap back to the start - must be able to
    // share an edge, which is what makes the cycle a hexagon on the lattice.
    for (let i = 0; i < chords.length; i++) {
      const a = chords[i]
      const b = chords[(i + 1) % chords.length]
      const bPitches = triadPitchClasses(b.root, b.quality)
      const shared = triadPitchClasses(a.root, a.quality).filter((p) => bPitches.includes(p))
      expect(shared).toHaveLength(2)

      const touching = trianglesForChord(tonnetz, a).some((ta) => {
        const ids = new Set(ta.nodes.map((n) => n.id))
        return trianglesForChord(tonnetz, b).some(
          (tb) => tb.nodes.filter((n) => ids.has(n.id)).length === 2,
        )
      })
      expect(touching).toBe(true)
    }
  })

  it('places every chord of every catalogue progression on the lattice', () => {
    for (const progression of PROGRESSIONS) {
      for (let tonic = 0; tonic < 12; tonic++) {
        const chords = resolveProgression(progression.numerals, { tonic, mode: progression.mode })
        for (const chord of chords) {
          expect(trianglesForChord(tonnetz, chord).length).toBeGreaterThan(0)
        }
      }
    }
  })
})

describe('layoutProgression', () => {
  const inC = (numerals) => resolveProgression(numerals, { tonic: 0, mode: 'major' })
  const centre = latticeCentre(tonnetz)
  const gap = (a, b) => Math.hypot(a.centroid.x - b.centroid.x, a.centroid.y - b.centroid.y)
  const pull = (t) => CENTRE_WEIGHT * Math.hypot(t.centroid.x - centre.x, t.centroid.y - centre.y)
  const pathCost = (path) =>
    path.reduce((sum, t, i) => sum + pull(t) + (i === 0 ? 0 : gap(path[i - 1], t)), 0)

  it('returns exactly one triangle per chord', () => {
    const chords = inC(['I', 'IV', 'V', 'I'])
    const path = layoutProgression(tonnetz, chords)
    expect(path).toHaveLength(chords.length)
    for (const [i, triangle] of path.entries()) {
      expect(triangle.root).toBe(chords[i].root)
      expect(triangle.quality).toBe(chords[i].quality)
    }
  })

  it('hinges IV on the tonic triangle rather than a distant copy', () => {
    // The bug this fixes: F major has two instances, and the far one was being
    // lit even though one of them shares the C node with the I chord.
    const chords = inC(['I', 'IV'])
    const [cMajor, fMajor] = layoutProgression(tonnetz, chords)
    expect(sharedCornerCount(cMajor, fMajor)).toBeGreaterThanOrEqual(1)

    const instances = trianglesForChord(tonnetz, chords[1])
    expect(instances.length).toBeGreaterThan(1) // there was a wrong choice available
    for (const other of instances) {
      expect(gap(cMajor, fMajor)).toBeLessThanOrEqual(gap(cMajor, other))
    }
  })

  it('connects every pair that shares two notes by a shared edge', () => {
    // vi - IV is a relative pair: on the lattice they must actually touch.
    const path = layoutProgression(tonnetz, inC(['vi', 'IV']))
    expect(sharedCornerCount(path[0], path[1])).toBe(2)
  })

  it('finds the cheapest whole path, not just a greedy one', () => {
    for (const progression of PROGRESSIONS) {
      for (let tonic = 0; tonic < 12; tonic++) {
        const chords = resolveProgression(
          progression.numerals,
          { tonic, mode: progression.mode },
          { resolveToTonic: true },
        )
        const path = layoutProgression(tonnetz, chords)

        // Brute force every combination of instances and compare.
        const options = chords.map((c) => trianglesForChord(tonnetz, c))
        let best = Infinity
        const walk = (i, taken, cost) => {
          if (cost >= best) return
          if (i === options.length) return void (best = cost)
          for (const triangle of options[i]) {
            const step = pull(triangle) + (i === 0 ? 0 : gap(taken[i - 1], triangle))
            walk(i + 1, [...taken, triangle], cost + step)
          }
        }
        walk(0, [], 0)
        expect(pathCost(path)).toBeCloseTo(best)
      }
    }
  })

  it('steps over a chord that has no triangle without breaking the chain', () => {
    const chords = [
      ...inC(['I']),
      { root: 11, quality: 'diminished', symbol: 'vii', name: 'B diminished' },
      ...inC(['I']),
    ]
    const path = layoutProgression(tonnetz, chords)
    expect(path[1]).toBeNull()
    expect(path[0]).not.toBeNull()
    expect(path[2].id).toBe(path[0].id)
  })

  it('handles a progression with no lattice chords at all', () => {
    const path = layoutProgression(tonnetz, [{ root: 0, quality: 'diminished' }])
    expect(path).toEqual([null])
  })

  it('starts near the centre of the lattice', () => {
    // A lone chord should not be placed out at an edge.
    for (let root = 0; root < 12; root++) {
      for (const quality of ['major', 'minor']) {
        const [chosen] = layoutProgression(tonnetz, [{ root, quality }])
        for (const other of trianglesForChord(tonnetz, { root, quality })) {
          expect(pull(chosen)).toBeLessThanOrEqual(pull(other) + 1e-9)
        }
      }
    }
  })
})

describe('sharedCornerCount', () => {
  it('counts a shared edge as two and a shared node as one', () => {
    const cMajor = trianglesForChord(tonnetz, { root: 0, quality: 'major' })[0]
    expect(sharedCornerCount(cMajor, cMajor)).toBe(3)
    expect(sharedCornerCount(cMajor, null)).toBe(0)
  })
})

describe('the lattice shows real voice leading', () => {
  const sharedPitches = (a, b) => {
    const bs = triadPitchClasses(b.root, b.quality)
    return triadPitchClasses(a.root, a.quality).filter((p) => bs.includes(p)).length
  }

  it('draws every catalogue progression, in every key, as a connected walk', () => {
    // The property that matters: if two chords share notes, the triangles the
    // walk picks must share exactly that many corners. Anything less means a
    // jump to a distant copy of the chord, which is the thing that makes a
    // Tonnetz useless - you can no longer see that IV is hinged on the I you
    // just heard. This is what DEFAULT_BOUNDS is sized for.
    const broken = []
    for (const progression of PROGRESSIONS) {
      for (let tonic = 0; tonic < 12; tonic++) {
        const chords = resolveProgression(
          progression.numerals,
          { tonic, mode: progression.mode },
          { resolveToTonic: true },
        )
        const path = layoutProgression(tonnetz, chords)
        for (let i = 1; i < chords.length; i++) {
          const want = sharedPitches(chords[i - 1], chords[i])
          const got = sharedCornerCount(path[i - 1], path[i])
          if (got !== want) {
            broken.push(
              `${progression.id} in ${tonic}: ${chords[i - 1].name} -> ${chords[i].name} ` +
                `shares ${want} notes but ${got} corners`,
            )
          }
        }
      }
    }
    expect(broken).toEqual([])
  })

  it('puts a shared edge under every parsimonious pair in C', () => {
    const cases = [
      [['I', 'vi'], 2], // relative
      [['I', 'iii'], 2], // leading-tone exchange
      [['vi', 'IV'], 2], // relative
      [['I', 'IV'], 1], // shares the tonic only
      [['I', 'V'], 1],
      [['IV', 'V'], 0], // no common tone: no adjacency exists to find
    ]
    for (const [numerals, expected] of cases) {
      const chords = resolveProgression(numerals, { tonic: 0, mode: 'major' })
      const [a, b] = layoutProgression(tonnetz, chords)
      expect(sharedPitches(chords[0], chords[1])).toBe(expected)
      expect(sharedCornerCount(a, b)).toBe(expected)
    }
  })
})

describe('triangleLabelsForChords', () => {
  it('labels every instance of a chord with its numeral', () => {
    const chords = resolveProgression(['I', 'IV', 'V'], { tonic: 0, mode: 'major' })
    const labels = triangleLabelsForChords(tonnetz, chords)

    for (const chord of chords) {
      const instances = trianglesForChord(tonnetz, chord)
      expect(instances.length).toBeGreaterThan(1) // the lattice is periodic
      for (const triangle of instances) expect(labels.get(triangle.id)).toBe(chord.symbol)
    }
  })

  it('leaves untouched triangles unlabelled', () => {
    const chords = resolveProgression(['I'], { tonic: 0, mode: 'major' })
    const labels = triangleLabelsForChords(tonnetz, chords)
    const [dMinor] = trianglesForChord(tonnetz, { root: 2, quality: 'minor' })
    expect(labels.has(dMinor.id)).toBe(false)
  })

  it('skips chords that have no triangle', () => {
    const chords = resolveProgression(['viio'], { tonic: 0, mode: 'major' })
    expect(triangleLabelsForChords(tonnetz, chords).size).toBe(0)
  })

  it('joins the numerals when two spellings land on one triad', () => {
    const chords = resolveProgression(['bVI', '#V'], { tonic: 0, mode: 'major' })
    const [triangle] = trianglesForChord(tonnetz, chords[0])
    expect(triangleLabelsForChords(tonnetz, chords).get(triangle.id)).toBe('bVI/#V')
  })

  it('labels a repeated chord once', () => {
    const chords = resolveProgression(['I', 'IV', 'V'], { tonic: 0, mode: 'major' }, { resolveToTonic: true })
    const [tonic] = trianglesForChord(tonnetz, chords[0])
    expect(triangleLabelsForChords(tonnetz, chords).get(tonic.id)).toBe('I')
  })
})
