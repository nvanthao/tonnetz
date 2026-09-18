import { computed, onScopeDispose, ref, watch } from 'vue'
import * as Tone from 'tone'
import { pitchClassNoteName, triadNoteNames } from '../music/pitch.js'

export const DEFAULT_BPM = 96
export const MIN_BPM = 40
export const MAX_BPM = 220

/** One chord per quarter note. */
const CHORD_VALUE = '4n'
/** A single manual click rings longer than a sequenced chord. */
const MANUAL_CHORD_VALUE = '2n'

/**
 * Wraps every Tone.js concern: the synth, the Transport schedule, and the
 * audio-context unlock. Visual updates ride on `Tone.Draw`, scheduled inside
 * the very callback that triggers the audio, so highlight and sound cannot
 * drift apart the way a setTimeout would.
 *
 * @param {object} options
 * @param {import('vue').Ref<Array>} options.chords resolved progression
 * @param {(chord: object|null) => void} options.onChord called on the draw tick
 */
export function usePlayback({ chords, onChord }) {
  const isPlaying = ref(false)
  const currentIndex = ref(-1)
  const bpm = ref(DEFAULT_BPM)
  const isAudioReady = ref(false)

  let synth = null
  let part = null
  let endEventId = null

  const currentChord = computed(() => chords.value[currentIndex.value] ?? null)

  /** Browsers only allow an audio context to start inside a user gesture. */
  async function ensureAudio() {
    if (!isAudioReady.value) {
      await Tone.start()
      isAudioReady.value = true
    }
    if (!synth) {
      synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.02, decay: 0.2, sustain: 0.4, release: 0.6 },
        volume: -10,
      }).toDestination()
    }
    Tone.getTransport().bpm.value = bpm.value
    return synth
  }

  function disposeSchedule() {
    const transport = Tone.getTransport()
    if (endEventId !== null) {
      transport.clear(endEventId)
      endEventId = null
    }
    if (part) {
      part.dispose()
      part = null
    }
  }

  function announce(index) {
    currentIndex.value = index
    onChord?.(index === -1 ? null : chords.value[index])
  }

  async function play() {
    if (!chords.value.length) return
    stop()
    await ensureAudio()

    const transport = Tone.getTransport()
    const events = chords.value.map((chord, index) => ({
      time: `0:${index}:0`,
      chord,
      index,
    }))

    part = new Tone.Part((time, event) => {
      synth.triggerAttackRelease(triadNoteNames(event.chord.root, event.chord.quality), CHORD_VALUE, time)
      // Same callback, same `time`: the highlight lands with the attack.
      Tone.getDraw().schedule(() => announce(event.index), time)
    }, events)
    part.start(0)

    endEventId = transport.scheduleOnce((time) => {
      isPlaying.value = false
      Tone.getDraw().schedule(() => announce(-1), time)
      // Tear down on a fresh task rather than here: halting the Transport from
      // inside its own tick callback rewinds it to tick 0 while the Part is
      // still armed there, which re-fires the opening chord. This is teardown,
      // not visual sync - the highlight above still rides on Tone.Draw, which
      // keeps it sample-accurate even though a hidden tab can drop it.
      setTimeout(haltTransport, 0)
    }, `0:${chords.value.length}:0`)

    transport.start()
    isPlaying.value = true
  }

  /** Rewind the Transport and drop the schedule, leaving any tail ringing. */
  function haltTransport() {
    const transport = Tone.getTransport()
    transport.stop()
    transport.position = 0
    transport.cancel()
    disposeSchedule()
    isPlaying.value = false
  }

  /** Halt and rewind. Play always restarts from the top, so there is no pause. */
  function stop() {
    haltTransport()
    // Draw keeps its own queue, so cancelling the Transport is not enough: the
    // next chord's highlight is already scheduled and would light up a triangle
    // after the sound had stopped. (The natural end of a run deliberately does
    // not do this - its final clear is itself a pending Draw event.)
    Tone.getDraw().cancel(0)
    synth?.releaseAll()
    announce(-1)
  }

  /**
   * Manual mode: audition one chord on its own.
   *
   * Sound only. The caller paints the highlight - so it lands immediately
   * instead of waiting on the audio context to unlock - and the caller also
   * decides whether to `stop()` a run in progress first. Stopping in here would
   * clear the highlight the caller had just painted. `onChord` stays reserved
   * for the sequencer, where the highlight is scheduled against the audio clock.
   */
  async function playChord(chord) {
    await ensureAudio()
    synth.triggerAttackRelease(triadNoteNames(chord.root, chord.quality), MANUAL_CHORD_VALUE)
  }

  /** Manual mode: audition one pitch class on its own. Same contract as above. */
  async function playNote(pitchClass) {
    await ensureAudio()
    synth.triggerAttackRelease(pitchClassNoteName(pitchClass), MANUAL_CHORD_VALUE)
  }

  watch(bpm, (value) => {
    Tone.getTransport().bpm.value = value
  })

  // Reselecting the key or progression invalidates whatever is scheduled.
  watch(chords, () => {
    if (isPlaying.value) stop()
  })

  onScopeDispose(() => {
    stop()
    synth?.dispose()
    synth = null
  })

  return {
    isPlaying,
    isAudioReady,
    currentIndex,
    currentChord,
    bpm,
    play,
    stop,
    playChord,
    playNote,
  }
}
