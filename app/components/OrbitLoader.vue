<script setup lang="ts">
// The NASA orbit spinner, ported from the sibling site: a glowing core with two
// counter-rotating satellites and a few twinkling stars. Reusable and inline,
// the Ask page drops it in while the RAG pipeline runs. An optional label sits
// below it (aria-live so screen readers hear the status).
withDefaults(defineProps<{ label?: string }>(), { label: '' })
</script>

<template>
  <div class="flex flex-col items-center gap-7">
    <!-- Orbital system: glowing core + two satellites + twinkling stars -->
    <div class="relative h-28 w-28">
      <span class="absolute left-2 top-5 h-0.5 w-0.5 rounded-full bg-white [animation:twinkle_1.8s_ease-in-out_infinite]" />
      <span class="absolute right-4 top-2 h-0.5 w-0.5 rounded-full bg-white [animation:twinkle_2.4s_ease-in-out_infinite]" />
      <span class="absolute bottom-3 left-7 h-0.5 w-0.5 rounded-full bg-white [animation:twinkle_2s_ease-in-out_infinite]" />
      <span class="absolute bottom-6 right-5 h-1 w-1 rounded-full bg-white [animation:twinkle_1.5s_ease-in-out_infinite]" />

      <!-- outer orbit (white satellite) -->
      <div class="absolute inset-0 rounded-full border border-white/10 [animation:orbit_4s_linear_infinite]">
        <span class="absolute left-1/2 top-0 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_10px_#fff]" />
      </div>
      <!-- inner orbit (cyan satellite, reversed) -->
      <div class="absolute inset-4.5 rounded-full border border-white/6 [animation:orbit_2.6s_linear_infinite_reverse]">
        <span class="absolute left-1/2 top-0 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent-cyan shadow-[0_0_8px_var(--accent-cyan)]" />
      </div>
      <!-- glowing core -->
      <div class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div class="h-4 w-4 rounded-full bg-[radial-gradient(circle,#e0f2fe_0%,var(--accent-cyan)_70%)] shadow-[0_0_22px_var(--accent-cyan)] [animation:corepulse_2s_ease-in-out_infinite]" />
      </div>
    </div>

    <span
      v-if="label"
      role="status"
      aria-live="polite"
      class="inline-flex items-center gap-2 text-sm text-text-secondary"
    >
      <span
        aria-hidden="true"
        class="text-accent-cyan/60"
      >✦</span>
      {{ label }}
    </span>
  </div>
</template>
