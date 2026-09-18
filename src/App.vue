<script setup>
import { computed, ref, watch } from 'vue'
import TonnetzGrid from './components/TonnetzGrid.vue'
import ProgressionSelector from './components/ProgressionSelector.vue'
import PlaybackControls from './components/PlaybackControls.vue'
import { useTonnetz } from './composables/useTonnetz.js'
import { usePlayback } from './composables/usePlayback.js'
import { resolveProgression } from './music/romanNumerals.js'
import { findProgression, PROGRESSIONS } from './music/progressions.js'
import { chordName, pitchClassNoteName } from './music/pitch.js'
import { MAJOR_COLOR, MINOR_COLOR, NOTE_HIGHLIGHT_COLOR, PLAYED_COLOR } from './theme.js'

const tonic = ref(0)
const mode = ref('major')
const progressionId = ref(PROGRESSIONS[1].id)

const progression = computed(() => findProgression(progressionId.value) ?? PROGRESSIONS[0])
const chords = computed(() =>
  resolveProgression(
    progression.value.numerals,
    { tonic: tonic.value, mode: mode.value },
    { resolveToTonic: true },
  ),
)

// Numerals are written for their own mode, so adopt it when the user picks one.
watch(progressionId, (id) => {
  const next = findProgression(id)
  if (next) mode.value = next.mode
})

const {
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
} = useTonnetz()

const { isPlaying, currentIndex, currentChord, bpm, play, stop, playChord, playNote } = usePlayback({
  chords,
  onChord: (chord) => {
    setActiveChord(chord)
    markPlayed(chord)
  },
})

/** Both controls restart the run, so both wipe the trail it drew. */
function startPlayback() {
  clearPlayed()
  play()
}

function stopPlayback() {
  clearPlayed()
  stop()
}

// A trail from the previous progression would be meaningless against a new one.
watch(chords, clearPlayed)

// Whatever was last auditioned by hand - a triad or a single note.
const manualSounding = ref(null)
// The readout shows whichever of the two sounded most recently.
const displayedSounding = computed(() => currentChord.value ?? manualSounding.value)

watch(currentChord, (chord) => {
  if (chord) manualSounding.value = null
})

/**
 * Auditioning by hand takes over from the sequencer, so the readout and the
 * lattice never disagree with what is actually sounding. This has to happen
 * before the new highlight is painted - stopping a run clears the lattice.
 */
function takeOverFromSequencer() {
  if (isPlaying.value) stop()
}

async function auditionChord({ root, quality }) {
  takeOverFromSequencer()
  const chord = { root, quality, name: chordName(root, quality) }
  manualSounding.value = chord
  setActiveChord(chord)
  await playChord(chord)
}

async function auditionNote(pitchClass) {
  takeOverFromSequencer()
  manualSounding.value = { pitchClass, name: pitchClassNoteName(pitchClass), isNote: true }
  setActiveNote(pitchClass)
  await playNote(pitchClass)
}

const legend = [
  { label: 'Major triad', color: MAJOR_COLOR },
  { label: 'Minor triad', color: MINOR_COLOR },
  { label: 'Sounding note', color: NOTE_HIGHLIGHT_COLOR },
  { label: 'Already played', color: PLAYED_COLOR },
]
</script>

<template>
  <div class="min-h-screen bg-slate-950 text-slate-100">
    <div class="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 p-4 lg:flex-row lg:p-8">
      <aside class="w-full shrink-0 space-y-6 lg:w-80">
        <header>
          <h1 class="text-2xl font-bold tracking-tight">Tonnetz</h1>
          <p class="mt-1 text-sm text-slate-400">
            Right is a fifth, up-right a major third. Click a triangle for its chord, a circle
            for a single note.
          </p>
        </header>

        <ProgressionSelector
          :tonic="tonic"
          :mode="mode"
          :progression-id="progressionId"
          :chords="chords"
          :active-index="currentIndex"
          @update:tonic="tonic = $event"
          @update:mode="mode = $event"
          @update:progression-id="progressionId = $event"
          @play-chord="auditionChord"
          @preview-chord="setPreviewChord"
        />

        <PlaybackControls
          :is-playing="isPlaying"
          :bpm="bpm"
          :sounding="displayedSounding"
          :can-play="chords.length > 0"
          @play="startPlayback"
          @stop="stopPlayback"
          @update:bpm="bpm = $event"
        />

        <!-- Wrap whole entries rather than breaking a label across two lines. -->
        <ul class="flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-400">
          <li
            v-for="item in legend"
            :key="item.label"
            class="flex shrink-0 items-center gap-2 whitespace-nowrap"
          >
            <span class="inline-block h-3 w-3 shrink-0 rounded-sm" :style="{ backgroundColor: item.color }" />
            {{ item.label }}
          </li>
        </ul>
      </aside>

      <main class="w-full flex-1 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/40 p-2 lg:self-center">
        <TonnetzGrid
          :nodes="nodes"
          :triangles="triangles"
          :view-box="viewBox"
          :active-triangle-ids="activeTriangleIds"
          :played-triangle-ids="playedTriangleIds"
          :preview-triangle-ids="previewTriangleIds"
          :active-pitch-class="activePitchClass"
          @select-chord="auditionChord"
          @select-note="auditionNote"
        />
      </main>
    </div>
  </div>
</template>
