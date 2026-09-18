import { computed, ref, shallowRef } from 'vue'
import { createTonnetz, trianglesForChord } from '../music/tonnetz.js'
import { pc } from '../music/pitch.js'

/**
 * Holds one lattice and whatever is currently lit on it.
 *
 * The lattice itself is built once and never mutated (hence `shallowRef`); only
 * the two active refs change during playback, so a chord change touches nothing
 * but the fills of the shapes involved.
 *
 * A chord lights every one of its instances. The lattice is periodic, so a
 * triad appears two or three times in the visible patch, and all of them are
 * the same chord - showing them all is what makes the periodicity legible.
 * (`layoutProgression` in the lattice module can instead pick a single instance
 * per chord to draw a connected walk; it is not wired up.)
 *
 * A chord and a note are mutually exclusive: lighting one clears the other, so
 * the lattice never shows a triangle and a loose note claiming to sound at once.
 * The trail of already-played triangles is separate from both, and survives
 * until the next run starts.
 */
export function useTonnetz(options = {}) {
  const tonnetz = shallowRef(createTonnetz(options))
  const activeTriangleIds = ref(new Set())
  const playedTriangleIds = ref(new Set())
  const previewTriangleIds = ref(new Set())
  const activePitchClass = ref(null)

  /** Light every instance of a chord; pass null to clear. */
  function setActiveChord(chord) {
    activePitchClass.value = null
    activeTriangleIds.value = chord
      ? new Set(trianglesForChord(tonnetz.value, chord).map((t) => t.id))
      : new Set()
  }

  /**
   * Outline where a chord sits, without claiming it is sounding. Independent of
   * the active and trail states, so a preview can never disturb what playback
   * is showing; pass null to clear.
   */
  function setPreviewChord(chord) {
    previewTriangleIds.value = chord
      ? new Set(trianglesForChord(tonnetz.value, chord).map((t) => t.id))
      : new Set()
  }

  /**
   * Add a chord to the trail of what this run has already sounded. The chord
   * currently playing is in here too - `activeTriangleIds` simply wins when
   * both apply, so a triangle falls back to the trail colour the moment the
   * next chord takes over.
   */
  function markPlayed(chord) {
    if (!chord) return
    const ids = new Set(playedTriangleIds.value)
    for (const triangle of trianglesForChord(tonnetz.value, chord)) ids.add(triangle.id)
    playedTriangleIds.value = ids
  }

  function clearPlayed() {
    playedTriangleIds.value = new Set()
  }

  /** Light every node of a pitch class; pass null to clear. */
  function setActiveNote(pitchClass) {
    activeTriangleIds.value = new Set()
    activePitchClass.value = pitchClass === null || pitchClass === undefined ? null : pc(pitchClass)
  }

  const nodes = computed(() => tonnetz.value.nodes)
  const triangles = computed(() => tonnetz.value.triangles)
  const viewBox = computed(() => tonnetz.value.viewBox.value)

  return {
    tonnetz,
    nodes,
    triangles,
    viewBox,
    activeTriangleIds,
    playedTriangleIds,
    previewTriangleIds,
    activePitchClass,
    setActiveChord,
    setActiveNote,
    setPreviewChord,
    markPlayed,
    clearPlayed,
  }
}
