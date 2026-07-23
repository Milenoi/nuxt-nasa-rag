<script setup lang="ts">
// The Taurus constellation, a small easter egg. Its stars can be dragged: grab
// any point and the connecting lines follow live. The brightest reddish star,
// Aldebaran (the bull's eye), carries a personal title tooltip.
//
// It lives just above the page content (not in the -z StarField) so the tiny
// star hit-targets can receive pointer events; everything else stays
// click-through. Hidden on small screens to keep them uncluttered.

type Star = { id: string; x: number; y: number }

// Original positions. Order in the horn/face line: a → b → c → ald → d → e → f.
const INITIAL: Star[] = [
  { id: 'a', x: 70, y: 60 }, // left horn tip
  { id: 'b', x: 150, y: 110 },
  { id: 'c', x: 210, y: 170 }, // branches down to the left leg
  { id: 'ald', x: 250, y: 205 }, // Aldebaran, the eye
  { id: 'd', x: 300, y: 150 },
  { id: 'e', x: 360, y: 100 },
  { id: 'f', x: 415, y: 66 }, // right horn tip
  { id: 'leg1', x: 175, y: 255 },
  { id: 'leg2', x: 320, y: 285 }
]

// Draggable nodes, seeded from the original positions.
const stars = reactive<Star[]>(INITIAL.map((s) => ({ ...s })))

// True once any star has been dragged away from its original spot.
const moved = computed(() =>
  stars.some((star, i) => {
    const origin = INITIAL[i]
    return !origin || star.x !== origin.x || star.y !== origin.y
  })
)

// Label copy comes from /api/content like everywhere else (even though the whole
// layer is aria-hidden, keeping copy central stays consistent).
const { data: content } = await useFetch('/api/content', { key: 'content' })
const taurus = computed(() => content.value?.taurus)

// The logo click pulses homeReset, snap every star back to where it started.
const { homeReset } = useAskStatus()
watch(homeReset, () => {
  INITIAL.forEach((origin, i) => {
    const star = stars[i]
    if (star) {
      star.x = origin.x
      star.y = origin.y
    }
  })
})

const byId = (id: string) => stars.find((s) => s.id === id) as Star
const pt = (id: string) => {
  const s = byId(id)
  return `${s.x},${s.y}`
}

// Polylines rebuild from the live positions.
const hornLine = computed(() =>
  ['a', 'b', 'c', 'ald', 'd', 'e', 'f'].map(pt).join(' ')
)
const leg1Line = computed(() => `${pt('c')} ${pt('leg1')}`)
const leg2Line = computed(() => `${pt('ald')} ${pt('leg2')}`)

const svgRef = ref<SVGSVGElement | null>(null)
let dragging: Star | null = null

function startDrag(star: Star, event: PointerEvent) {
  dragging = star
  ;(event.target as Element).setPointerCapture(event.pointerId)
}

function onMove(event: PointerEvent) {
  if (!dragging || !svgRef.value) return
  const ctm = svgRef.value.getScreenCTM()
  if (!ctm) return
  // Map the pointer from screen space into the SVG's own coordinate system,
  // which correctly accounts for the container's size and drift transform.
  const local = new DOMPoint(event.clientX, event.clientY).matrixTransform(ctm.inverse())
  // Clamp to the viewBox so stars stay inside the constellation's own corner and
  // never spread across the page over the content.
  dragging.x = Math.max(10, Math.min(450, local.x))
  dragging.y = Math.max(10, Math.min(330, local.y))
}

function endDrag() {
  dragging = null
}
</script>

<template>
  <div
    class="pointer-events-none fixed left-1/2 top-[56px] z-0 h-[220px] w-[300px] -translate-x-1/2 overflow-hidden opacity-40 [animation:drift_14s_ease-in-out_infinite] sm:left-auto sm:right-[70px] sm:top-[96px] sm:h-[320px] sm:w-[440px] sm:translate-x-0 sm:opacity-50 2xl:z-40 2xl:opacity-60"
    aria-hidden="true"
  >
    <svg
      ref="svgRef"
      viewBox="0 0 460 340"
      width="440"
      height="320"
      fill="none"
    >
      <!-- connecting lines (follow the stars, not interactive) -->
      <polyline
        :points="hornLine"
        class="taurus-line"
        stroke-width="1.2"
      />
      <polyline
        :points="leg1Line"
        class="taurus-line"
        stroke-width="1.2"
      />
      <polyline
        :points="leg2Line"
        class="taurus-line"
        stroke-width="1.2"
      />

      <!-- Pleiades: a tiny static cluster on the shoulder (decorative) -->
      <circle cx="66" cy="40" r="1.2" class="taurus-pleiad" />
      <circle cx="80" cy="30" r="1" class="taurus-pleiad" />
      <circle cx="90" cy="44" r="1.1" class="taurus-pleiad" />
      <circle cx="74" cy="52" r="0.9" class="taurus-pleiad" />

      <!-- Aldebaran, the glowing reddish eye, draggable, with the easter egg -->
      <g>
        <circle
          :cx="byId('ald').x"
          :cy="byId('ald').y"
          r="7"
          class="taurus-eye-halo"
        />
        <circle
          :cx="byId('ald').x"
          :cy="byId('ald').y"
          r="3"
          class="taurus-eye"
        />
        <circle
          class="star-hit"
          :cx="byId('ald').x"
          :cy="byId('ald').y"
          r="13"
          fill="transparent"
          @pointerdown="startDrag(byId('ald'), $event)"
          @pointermove="onMove"
          @pointerup="endDrag"
          @pointercancel="endDrag"
        >
          <title>Aldebaran, the eye of Taurus. Melanie's birthday is in April, so she is a Taurus.</title>
        </circle>
      </g>

      <!-- the rest of the draggable stars -->
      <template
        v-for="star in stars"
        :key="star.id"
      >
        <g v-if="star.id !== 'ald'">
          <circle
            :cx="star.x"
            :cy="star.y"
            r="2"
            class="taurus-star"
          />
          <circle
            class="star-hit"
            :cx="star.x"
            :cy="star.y"
            r="13"
            fill="transparent"
            @pointerdown="startDrag(star, $event)"
            @pointermove="onMove"
            @pointerup="endDrag"
            @pointercancel="endDrag"
          />
        </g>
      </template>
    </svg>

    <div class="taurus-label absolute bottom-0.5 left-2 font-mono text-[11px] uppercase tracking-[0.22em]">
      {{ moved ? taurus?.labelMoved : taurus?.label }}
    </div>
  </div>
</template>

<style scoped>
/* Only the transparent hit-targets catch pointer events; the rest of the layer
   stays click-through so page content underneath stays usable. */
.star-hit {
  pointer-events: auto;
  cursor: grab;
}
.star-hit:active {
  cursor: grabbing;
}

/* Decorative constellation colours, driven by the design tokens. */
.taurus-line { stroke: var(--taurus-line); }
.taurus-pleiad { fill: var(--star-link); }
.taurus-eye-halo { fill: var(--taurus-eye-halo); }
.taurus-eye { fill: var(--taurus-eye); }
.taurus-star { fill: var(--taurus-star); }
.taurus-label { color: var(--taurus-label); }
</style>
