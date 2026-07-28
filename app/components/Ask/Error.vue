<script setup lang="ts">
// The request-failed screen. errorDetail is one concise reason from describeError.
defineProps<{ errorDetail: string }>()
const emit = defineEmits<{ retry: []; reset: [] }>()

const { states, answerCopy } = useContent()

const errorHeading = ref<HTMLElement | null>(null)
onMounted(() => errorHeading.value?.focus())
</script>

<template>
  <section
    class="flex min-h-screen-nav flex-col items-center justify-center px-5 py-24 text-center animate-fade-up"
  >
    <BlackHole
      variant="warm"
      :size="200"
    />
    <h2
      ref="errorHeading"
      tabindex="-1"
      class="mt-6 font-serif text-[clamp(26px,4vw,36px)] font-light text-text-warm focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-cyan/50"
    >
      {{ states?.errorHeading }}
    </h2>
    <!-- One concise reason (from describeError), so it's clear the request actually
         failed (vs. an empty result). We drop the generic "something went wrong"
         line above it, since it only doubled the message. -->
    <p
      v-if="errorDetail"
      class="mx-auto mt-6 max-w-[420px] rounded-lg border border-destructive/25 bg-destructive/10 px-4 py-2.5 font-mono text-xs leading-relaxed text-destructive"
    >
      {{ errorDetail }}
    </p>
    <div class="mt-6 flex flex-wrap items-center justify-center gap-3">
      <button
        type="button"
        class="btn-glass rounded-lg px-6 py-3.5 text-sm font-medium text-foreground backdrop-blur-[10px]"
        @click="emit('retry')"
      >
        {{ states?.retry }}
      </button>
      <button
        type="button"
        class="rounded-lg border border-border px-6 py-3.5 text-sm font-medium text-text-secondary transition-colors hover:text-foreground"
        @click="emit('reset')"
      >
        {{ answerCopy?.newSearch }}
      </button>
    </div>
  </section>
</template>
