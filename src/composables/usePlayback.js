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
 * The voices on offer.
 *
 * Every one of them is a `PolySynth` over a different Tone voice class, so
 * there is nothing to load and nothing to wait for - switching is instant, and
 * the audio graph stays a single node the rest of this module can treat
 * uniformly. (A sampled piano would be a `Tone.Sampler`, which is API-
 * compatible here but brings megabytes of audio and a loading state with it.)
 *
 * `volume` is part of each preset rather than a global: a sawtooth stack is far
 * louder than a triangle at the same gain, so the levels are trimmed per voice
 * to keep a switch from jumping out at the listener.
 */
export const INSTRUMENTS = [
  {
    id: 'synth',
    name: 'Synth',
    voice: Tone.Synth,
    options: {
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.02, decay: 0.2, sustain: 0.4, release: 0.6 },
      volume: -10,
    },
  },
  {
    id: 'electric-piano',
    name: 'Electric piano',
    voice: Tone.FMSynth,
    // Struck, not blown: no sustain at all, so the chord decays under itself.
    options: {
      harmonicity: 3,
      modulationIndex: 9,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.004, decay: 1.6, sustain: 0, release: 1.2 },
      modulation: { type: 'sine' },
      modulationEnvelope: { attack: 0.004, decay: 0.35, sustain: 0, release: 0.2 },
      volume: -6,
    },
  },
  {
    id: 'pluck',
    name: 'Pluck',
    voice: Tone.Synth,
    // Bright at the attack and gone quickly - a harpsichord more than a guitar.
    // A true plucked string is Tone.PluckSynth, which is monophonic and needs a
    // voice pool of its own, so it is not one of these presets.
    options: {
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.002, decay: 0.7, sustain: 0.02, release: 0.8 },
      volume: -12,
    },
  },
  {
    id: 'organ',
    name: 'Organ',
    voice: Tone.Synth,
    // `sine4` is a sine plus its first partials - a drawbar stack in one word.
    // Flat sustain and almost no release: it speaks and stops with the key.
    options: {
      oscillator: { type: 'sine4' },
      envelope: { attack: 0.03, decay: 0.06, sustain: 0.95, release: 0.12 },
      volume: -14,
    },
  },
  {
    id: 'strings',
    name: 'Strings',
    voice: Tone.Synth,
    // Slow enough to bloom, but well inside a quarter note at the lowest tempo.
    options: {
      oscillator: { type: 'fatsawtooth', count: 3, spread: 22 },
      envelope: { attack: 0.18, decay: 0.3, sustain: 0.8, release: 1.4 },
      volume: -16,
    },
  },
  {
    id: 'bells',
    name: 'Bells',
    voice: Tone.FMSynth,
    // An inharmonic ratio is what makes a bell a bell rather than a chime.
    options: {
      harmonicity: 5.1,
      modulationIndex: 14,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.002, decay: 2.4, sustain: 0, release: 2 },
      modulation: { type: 'sine' },
      modulationEnvelope: { attack: 0.002, decay: 0.6, sustain: 0, release: 0.5 },
      volume: -9,
    },
  },
]

/** Named, not positional, so reordering the presets cannot change the default. */
export const DEFAULT_INSTRUMENT_ID = 'bells'

export function findInstrument(id) {
  return INSTRUMENTS.find((instrument) => instrument.id === id) ?? INSTRUMENTS[0]
}

/**
 * How long a swapped-out instrument is left alive to finish ringing. Disposing
 * it the instant the picker changes would chop the tail off mid-chord. Comfortably
 * longer than the slowest release above (the bells, at 2s).
 */
const RETIRE_MS = 2500

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
  const instrumentId = ref(DEFAULT_INSTRUMENT_ID)
  const isAudioReady = ref(false)

  let synth = null
  let part = null
  let endEventId = null
  /** Instruments swapped away from, still ringing, awaiting disposal. */
  let retiring = []

  const currentChord = computed(() => chords.value[currentIndex.value] ?? null)

  /** Browsers only allow an audio context to start inside a user gesture. */
  async function ensureAudio() {
    if (!isAudioReady.value) {
      await Tone.start()
      isAudioReady.value = true
    }
    if (!synth) synth = buildSynth()
    Tone.getTransport().bpm.value = bpm.value
    return synth
  }

  function buildSynth() {
    const instrument = findInstrument(instrumentId.value)
    return new Tone.PolySynth(instrument.voice, instrument.options).toDestination()
  }

  /** Let an instrument ring itself out, then free it. */
  function retire(instrument) {
    instrument.releaseAll()
    retiring.push(instrument)
    setTimeout(() => {
      retiring = retiring.filter((other) => other !== instrument)
      instrument.dispose()
    }, RETIRE_MS)
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

  /**
   * Swap the instrument without interrupting anything.
   *
   * The Part callback reads `synth` at tick time rather than closing over it,
   * so replacing it here is enough for the very next chord to sound on the new
   * voice - a run in progress keeps its schedule, its trail and its highlight.
   * Nothing is built before the audio context exists; `ensureAudio` will pick
   * up the new choice when it does.
   */
  watch(instrumentId, () => {
    if (!synth) return
    const previous = synth
    synth = buildSynth()
    retire(previous)
  })

  // Reselecting the key or progression invalidates whatever is scheduled.
  watch(chords, () => {
    if (isPlaying.value) stop()
  })

  onScopeDispose(() => {
    stop()
    synth?.dispose()
    synth = null
    for (const instrument of retiring) instrument.dispose()
    retiring = []
  })

  return {
    isPlaying,
    isAudioReady,
    currentIndex,
    currentChord,
    bpm,
    instrumentId,
    play,
    stop,
    playChord,
    playNote,
  }
}
