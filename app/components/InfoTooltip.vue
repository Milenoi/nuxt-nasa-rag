<script setup lang="ts">
// A small "i" badge that reveals a short hint on hover or keyboard focus, so
// explanatory copy can stay out of the layout until it's wanted. Hover shows it
// via group-hover; focus-within covers keyboard users; aria-label carries the
// text to assistive tech (which don't hover).
import { Info } from '@lucide/vue'

defineProps<{ text?: string }>()
</script>

<template>
  <span class="group relative inline-flex align-middle">
    <button
      type="button"
      :aria-label="text"
      class="grid size-5 place-items-center rounded-full text-text-faint transition-colors hover:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan/50"
    >
      <Info class="size-3.5" />
    </button>
    <span
      role="tooltip"
      class="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-56 -translate-x-1/2 rounded-lg border border-border bg-card px-3 py-2 text-xs leading-relaxed text-text-secondary opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
    >
      {{ text }}
    </span>
  </span>
</template>
