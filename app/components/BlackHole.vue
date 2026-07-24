<script setup lang="ts">
// The glowing black-hole sphere from the design, a floating dark orb ringed by
// a soft halo. Used for the "no result" (cool) and "error" (warm) states, and
// reused on the 404 page (with "404" in the default slot). Decorative.
const props = withDefaults(
  defineProps<{ variant?: 'cool' | 'warm'; size?: number | string }>(),
  { variant: 'cool', size: 300 }
)

// A number is treated as px; a string (e.g. a clamp()) is used verbatim.
const dimension = computed(() => (typeof props.size === 'number' ? `${props.size}px` : props.size))

const glow = computed(() =>
  props.variant === 'warm'
    ? {
        halo: 'rgba(255, 140, 70, 0.2)',
        shadow: 'rgba(255, 150, 80, 0.5)'
      }
    : {
        halo: 'rgba(140, 120, 255, 0.2)',
        shadow: 'rgba(120, 150, 255, 0.5)'
      }
)
</script>

<template>
  <div
    class="relative mx-auto [animation:floaty_9s_ease-in-out_infinite]"
    :style="{ width: dimension, height: dimension }"
  >
    <!-- soft outer halo (decorative); only the glow colour is dynamic -->
    <div
      aria-hidden="true"
      class="halo absolute -inset-9 rounded-full"
      :style="{ '--glow-halo': glow.halo }"
    />
    <!-- the sphere: dark core, faint rim, glowing shadow -->
    <div
      class="sphere absolute inset-0 grid place-items-center overflow-hidden rounded-full border border-border"
      :style="{ '--glow-shadow': glow.shadow }"
    >
      <slot />
    </div>
  </div>
</template>

<style scoped>
/* Static decorative surfaces live here; the templates keep only the dynamic
   per-variant glow colours (passed in as CSS custom properties). */
.halo {
  background: radial-gradient(circle, var(--glow-halo), transparent 66%);
}
.sphere {
  background: radial-gradient(circle at 50% 45%, #0a0d16, #04060b 70%);
  box-shadow:
    0 0 74px -14px var(--glow-shadow),
    inset 0 0 48px -6px rgba(0, 0, 0, 0.92);
}
</style>
