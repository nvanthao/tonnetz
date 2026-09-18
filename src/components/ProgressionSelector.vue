<script setup>
import { computed } from 'vue'
import { SHARP_NAMES } from '../music/pitch.js'
import { MODES } from '../music/romanNumerals.js'
import { PROGRESSIONS, progressionLabel } from '../music/progressions.js'

const props = defineProps({
  tonic: { type: Number, required: true },
  mode: { type: String, required: true },
  progressionId: { type: String, required: true },
  chords: { type: Array, required: true },
  activeIndex: { type: Number, default: -1 },
})

const emit = defineEmits([
  'update:tonic',
  'update:mode',
  'update:progressionId',
  'play-chord',
  'preview-chord',
])

const tonics = SHARP_NAMES.map((name, pitchClass) => ({ name, pitchClass }))

const grouped = computed(() =>
  MODES.map((mode) => ({
    mode,
    items: PROGRESSIONS.filter((p) => p.mode === mode),
  })).filter((group) => group.items.length),
)

const selectClass =
  'w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 ' +
  'outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400'
const labelClass = 'mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400'
</script>

<template>
  <section class="space-y-4">
    <div class="grid grid-cols-2 gap-3">
      <div>
        <label :class="labelClass" for="tonic">Key</label>
        <select
          id="tonic"
          :class="selectClass"
          :value="tonic"
          @change="emit('update:tonic', Number($event.target.value))"
        >
          <option v-for="t in tonics" :key="t.pitchClass" :value="t.pitchClass">{{ t.name }}</option>
        </select>
      </div>

      <div>
        <label :class="labelClass" for="mode">Mode</label>
        <select
          id="mode"
          :class="selectClass"
          :value="mode"
          @change="emit('update:mode', $event.target.value)"
        >
          <option v-for="m in MODES" :key="m" :value="m">{{ m }}</option>
        </select>
      </div>
    </div>

    <div>
      <label :class="labelClass" for="progression">Progression</label>
      <select
        id="progression"
        :class="selectClass"
        :value="progressionId"
        @change="emit('update:progressionId', $event.target.value)"
      >
        <optgroup v-for="group in grouped" :key="group.mode" :label="`${group.mode} keys`">
          <option v-for="p in group.items" :key="p.id" :value="p.id">
            {{ p.name }} — {{ progressionLabel(p) }}
          </option>
        </optgroup>
      </select>
    </div>

    <div>
      <span :class="labelClass">Chords</span>
      <ol class="flex flex-wrap gap-2" @mouseleave="emit('preview-chord', null)">
        <li v-for="(chord, index) in chords" :key="index">
          <button
            type="button"
            class="rounded-lg border px-3 py-2 text-left transition"
            :class="[
              chord.isResolution ? 'border-dashed' : '',
              index === activeIndex
                ? 'border-amber-400 bg-amber-400/15 text-amber-200'
                : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500',
            ]"
            :title="chord.isResolution ? 'Implied resolution back to the tonic' : chord.name"
            @click="emit('play-chord', chord)"
            @mouseenter="emit('preview-chord', chord)"
            @mouseleave="emit('preview-chord', null)"
            @focus="emit('preview-chord', chord)"
            @blur="emit('preview-chord', null)"
          >
            <span class="block text-sm font-semibold">{{ chord.symbol }}</span>
            <span class="block text-xs text-slate-400">{{ chord.name }}</span>
          </button>
        </li>
      </ol>
    </div>
  </section>
</template>
