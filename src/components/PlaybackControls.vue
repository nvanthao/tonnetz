<script setup>
import { MIN_BPM, MAX_BPM } from '../composables/usePlayback.js'
import { soundingColor } from '../theme.js'

defineProps({
  isPlaying: { type: Boolean, default: false },
  bpm: { type: Number, required: true },
  // Whatever is sounding right now: a resolved chord, or a single note.
  sounding: { type: Object, default: null },
  canPlay: { type: Boolean, default: true },
})

const emit = defineEmits(['play', 'stop', 'update:bpm'])
</script>

<template>
  <section class="space-y-4">
    <div class="flex items-center gap-2">
      <button
        type="button"
        class="flex-1 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
        :disabled="!canPlay"
        @click="emit('play')"
      >
        {{ isPlaying ? 'Restart' : 'Play' }}
      </button>
      <button
        type="button"
        class="flex-1 rounded-lg border border-slate-600 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-40"
        :disabled="!isPlaying"
        @click="emit('stop')"
      >
        Stop
      </button>
    </div>

    <div>
      <label class="mb-1.5 flex items-baseline justify-between text-xs font-semibold uppercase tracking-wider text-slate-400" for="bpm">
        <span>Tempo</span>
        <span class="tabular-nums text-slate-300">{{ bpm }} BPM</span>
      </label>
      <input
        id="bpm"
        type="range"
        :min="MIN_BPM"
        :max="MAX_BPM"
        step="1"
        :value="bpm"
        class="w-full accent-amber-400"
        @input="emit('update:bpm', Number($event.target.value))"
      />
    </div>

    <p class="min-h-10 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm">
      <template v-if="sounding">
        <span class="text-slate-400">Now playing: </span>
        <span class="font-semibold" :style="{ color: soundingColor(sounding) }">
          {{ sounding.symbol ? `${sounding.symbol} — ` : '' }}{{ sounding.name }}
        </span>
      </template>
      <span v-else class="text-slate-500">Ready — press Play, or click a triangle or note.</span>
    </p>
  </section>
</template>
