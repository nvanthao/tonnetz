<script setup>
import { computed } from 'vue'
import { nodeColors, triangleFill, triangleOutline } from '../theme.js'
import { chordName, pitchClassNoteName } from '../music/pitch.js'

const props = defineProps({
  nodes: { type: Array, required: true },
  triangles: { type: Array, required: true },
  viewBox: { type: String, required: true },
  activeTriangleIds: { type: Set, required: true },
  playedTriangleIds: { type: Set, default: () => new Set() },
  previewTriangleIds: { type: Set, default: () => new Set() },
  activePitchClass: { type: Number, default: null },
})

const emit = defineEmits(['select-chord', 'select-note'])

const NODE_RADIUS = 22

// Painted in tiers: at rest, the trail, what is sounding, then any preview on
// top. Everything above the first tier carries an outline that a neighbour
// drawn afterwards would otherwise paint over.
const orderedTriangles = computed(() => {
  const rest = []
  const played = []
  const active = []
  const preview = []
  for (const triangle of props.triangles) {
    if (props.previewTriangleIds.has(triangle.id)) preview.push(triangle)
    else if (props.activeTriangleIds.has(triangle.id)) active.push(triangle)
    else if (props.playedTriangleIds.has(triangle.id)) played.push(triangle)
    else rest.push(triangle)
  }
  return [...rest, ...played, ...active, ...preview]
})

function stateOf(triangle) {
  return {
    isActive: props.activeTriangleIds.has(triangle.id),
    hasPlayed: props.playedTriangleIds.has(triangle.id),
    isPreview: props.previewTriangleIds.has(triangle.id),
  }
}

function isNodeActive(node) {
  return node.pitchClass === props.activePitchClass
}
</script>

<template>
  <svg
    :viewBox="viewBox"
    class="h-auto w-full select-none"
    role="img"
    aria-label="Tonnetz lattice of major and minor triads"
  >
    <g>
      <polygon
        v-for="triangle in orderedTriangles"
        :key="triangle.id"
        :points="triangle.points"
        :fill="triangleFill(triangle.quality, stateOf(triangle))"
        :stroke="triangleOutline(stateOf(triangle)).stroke"
        :stroke-width="triangleOutline(stateOf(triangle)).width"
        :stroke-dasharray="triangleOutline(stateOf(triangle)).dash"
        stroke-linejoin="round"
        class="cursor-pointer transition-[fill,stroke] duration-100 hover:brightness-150"
        @click="emit('select-chord', { root: triangle.root, quality: triangle.quality })"
      >
        <title>{{ chordName(triangle.root, triangle.quality) }}</title>
      </polygon>
    </g>

    <!--
      Nodes are drawn after the triangles, so a click on a circle hits the note
      rather than the triad underneath it - a triangle only answers for clicks
      on its open area.
    -->
    <g v-for="node in nodes" :key="node.id">
      <circle
        :cx="node.cx"
        :cy="node.cy"
        :r="NODE_RADIUS"
        :fill="nodeColors(isNodeActive(node)).fill"
        :stroke="nodeColors(isNodeActive(node)).stroke"
        stroke-width="2"
        class="cursor-pointer transition-[fill,stroke] duration-100 hover:brightness-150"
        @click="emit('select-note', node.pitchClass)"
      >
        <title>{{ pitchClassNoteName(node.pitchClass) }}</title>
      </circle>
      <text
        :x="node.cx"
        :y="node.cy"
        :fill="nodeColors(isNodeActive(node)).text"
        text-anchor="middle"
        dominant-baseline="central"
        font-size="17"
        font-weight="600"
        font-family="ui-sans-serif, system-ui, sans-serif"
        class="pointer-events-none transition-[fill] duration-100"
      >
        {{ node.name }}
      </text>
    </g>
  </svg>
</template>
