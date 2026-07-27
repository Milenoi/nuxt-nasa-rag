<script setup lang="ts">
// The gibberish / nothing-found screen: the playful black hole + Gemini's quip.
defineProps<{ remark: string; lastStarTrek: boolean }>()
const emit = defineEmits<{ reset: [] }>()

const { states } = useContent()

// Move focus to the heading once the view is on screen (announced via useAsk).
const emptyHeading = ref<HTMLElement | null>(null)
onMounted(() => emptyHeading.value?.focus())
</script>

<template>
  <section
    class="flex min-h-[calc(100dvh-3.25rem)] flex-col items-center justify-center px-5 py-24 text-center animate-fade-up"
  >
    <BlackHole
      variant="cool"
      :size="220"
    />
    <h2
      ref="emptyHeading"
      tabindex="-1"
      class="mt-8 font-serif text-[clamp(26px,4vw,36px)] font-light text-text-strong focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan/50"
    >
      {{ states?.emptyHeading }}
    </h2>
    <p class="mx-auto mt-3 max-w-[440px] text-base leading-relaxed text-text-muted">
      {{ remark || (lastStarTrek ? states?.nonsense : states?.nonsensePlain) }}
    </p>
    <button
      type="button"
      class="btn-glass mt-6 rounded-lg px-6 py-3.5 text-sm font-medium text-foreground backdrop-blur-[10px]"
      @click="emit('reset')"
    >
      {{ states?.retryOther }}
    </button>
  </section>
</template>
