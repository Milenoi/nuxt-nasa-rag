<script setup lang="ts">
import { ChevronDown } from '@lucide/vue'

// Two-way toggles owned by useAsk (in index.vue); this view just edits them.
const query = defineModel<string>('query', { required: true })
const rewrite = defineModel<boolean>('rewrite', { required: true })
const starTrek = defineModel<boolean>('starTrek', { required: true })

defineProps<{ askHint: string }>()
const emit = defineEmits<{ ask: []; useExample: [example: string] }>()

const { hero, ask } = useContent()
// Example prompts start collapsed behind a toggle so the idle screen stays calm.
const showExamples = ref(false)
</script>

<template>
  <section
    class="mx-auto flex min-h-screen-nav max-w-[820px] flex-col px-5 pb-16 pt-28 animate-fade-up md:px-8 md:pt-[19vh]"
  >
    <p class="mb-6 text-sm text-text-faint">
      {{ hero?.eyebrow }}
    </p>
    <h1 class="font-serif text-[clamp(44px,8vw,78px)] font-light leading-[1.02] tracking-[-0.015em] text-text-strong">
      {{ hero?.title }}
    </h1>
    <p class="mt-6 max-w-[540px] text-lg leading-relaxed text-text-secondary">
      {{ hero?.subtitle }}
    </p>

    <form
      class="mt-10 max-w-[680px]"
      @submit.prevent="emit('ask')"
    >
      <div class="flex flex-col gap-2 rounded-xl border border-input bg-card/85 p-2 backdrop-blur-[6px] sm:flex-row sm:items-center sm:gap-2.5 sm:py-2 sm:pl-6 sm:pr-2">
        <input
          v-model="query"
          :placeholder="ask?.placeholder"
          :aria-label="ask?.inputLabel"
          class="min-w-0 flex-1 border-none bg-transparent px-4 py-3 text-lg text-text-strong outline-none placeholder:text-text-faint sm:px-0"
        >
        <button
          type="submit"
          class="btn-glass inline-flex w-full flex-shrink-0 items-center justify-center gap-2 rounded-lg px-6 py-3.5 text-base font-medium text-foreground backdrop-blur-[10px] sm:w-auto"
        >
          {{ ask?.submit }} <span
            aria-hidden="true"
            class="text-base"
          >→</span>
        </button>
      </div>
    </form>

    <!-- Gentle nudge when Ask is pressed with an empty field -->
    <p
      v-if="askHint"
      class="mt-3 text-sm text-accent-warm"
    >
      {{ askHint }}
    </p>

    <!-- Two toggles, set BEFORE asking. Star Trek = answer tone; Smart search =
         rewrite the query before searching. Both only shape input/tone, not what
         counts as a match. flex-wrap keeps them on one line on phones and only
         wraps on very narrow screens. -->
    <div class="mt-7 flex max-w-[680px] flex-wrap items-center gap-x-5 gap-y-3">
      <div class="flex items-center gap-2">
        <PillToggle
          v-model="rewrite"
          :label="ask?.rewriteLabel"
        />
        <InfoTooltip :text="ask?.rewriteHint" />
      </div>
      <div class="flex items-center gap-2">
        <PillToggle
          v-model="starTrek"
          :label="ask?.personalityLabel"
          :label-short="ask?.personalityLabelShort"
        />
        <InfoTooltip :text="ask?.personalityHint" />
      </div>
    </div>

    <!-- Toggle + examples in normal flow. The section is top-anchored (pt-[19vh]),
         so opening the list grows the page downward without shifting the content
         up (no jump), and the page scrolls when space runs out. -->
    <button
      type="button"
      class="mt-6 inline-flex w-fit items-center gap-1.5 text-sm text-text-faint transition-colors hover:text-text-secondary"
      :aria-expanded="showExamples"
      @click="showExamples = !showExamples"
    >
      {{ ask?.examplesToggle }}
      <ChevronDown
        class="size-4 transition-transform"
        :class="showExamples ? 'rotate-180' : ''"
      />
    </button>
    <div
      v-if="showExamples"
      class="mt-4 flex flex-wrap gap-2.5 animate-fade-up"
    >
      <button
        v-for="example in ask?.examples"
        :key="example"
        type="button"
        class="inline-flex items-center gap-2 rounded-full border border-white/11 bg-white/3 px-4 py-2.5 text-sm text-text-body transition-colors hover:border-white/28 hover:text-foreground"
        @click="emit('useExample', example)"
      >
        <span
          aria-hidden="true"
          class="text-xs text-accent-cyan/50"
        >✦</span>{{ example }}
      </button>
    </div>
  </section>
</template>
