<script setup lang="ts">
// The "did you mean?" step: Smart search returned cleaned-up alternatives for the
// raw question; the user picks one (emit `choose`) or keeps the original (emit
// `keepOriginal`). Pure presentation, it holds no state and does no fetching.
import { ref, onMounted } from 'vue'

defineProps<{
  question?: string
  suggestions: string[]
  copy?: {
    askedLabel?: string
    heading?: string
    intro?: string
    keepOriginal?: string
  }
}>()
defineEmits<{ choose: [string]; keepOriginal: [] }>()

// Move focus into the panel when it appears, so keyboard and screen-reader users
// land on the heading (which labels the list) instead of being left behind.
const panel = ref<HTMLElement | null>(null)
onMounted(() => panel.value?.focus())
</script>

<template>
  <section
    ref="panel"
    tabindex="-1"
    aria-labelledby="suggest-heading"
    class="mx-auto flex min-h-[calc(100dvh-3.25rem)] max-w-[680px] flex-col justify-center px-5 py-16 outline-none animate-fade-up md:px-8"
  >
    <p class="text-sm text-text-faint">
      {{ copy?.askedLabel }}
    </p>
    <p class="mt-1 font-serif text-2xl font-light leading-snug text-text-secondary">
      {{ question }}
    </p>

    <h2
      id="suggest-heading"
      class="mt-8 font-serif text-[clamp(28px,5vw,40px)] font-light text-text-strong"
    >
      {{ copy?.heading }}
    </h2>
    <p
      v-if="copy?.intro"
      class="mt-3 max-w-[520px] text-text-secondary"
    >
      {{ copy.intro }}
    </p>

    <ul class="mt-7 flex flex-col gap-2.5">
      <li
        v-for="suggestion in suggestions"
        :key="suggestion"
      >
        <button
          type="button"
          class="group flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-card/75 px-5 py-4 text-left text-lg text-text-strong transition-colors hover:border-accent-cyan/50 hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan/50 focus-visible:ring-offset-2 focus-visible:ring-offset-space-deep"
          @click="$emit('choose', suggestion)"
        >
          <span>{{ suggestion }}</span>
          <span
            aria-hidden="true"
            class="flex-shrink-0 text-accent-cyan/60 transition-transform group-hover:translate-x-0.5"
          >→</span>
        </button>
      </li>
    </ul>

    <button
      type="button"
      class="mt-5 inline-flex w-fit items-center text-sm text-text-faint underline-offset-4 transition-colors hover:text-text-secondary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan/50"
      @click="$emit('keepOriginal')"
    >
      {{ copy?.keepOriginal }}
    </button>
  </section>
</template>
