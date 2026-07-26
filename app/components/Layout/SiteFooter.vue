<script setup lang="ts">
// Fixed, frosted-glass status bar, same treatment as the sibling site's cache
// footer, but here it visualises the RAG PIPELINE: Query → Retrieve → Rank →
// Answer. Each stage's dot lights up as the Ask page moves through the request.
import type { AskStatus } from '~/composables/useAskStatus'

const { data: content } = await useFetch('/api/content', { key: 'content' })
const { status, timing } = useAskStatus()

const footer = computed(() => content.value?.footer)
const stageLabels = computed(() => footer.value?.stages ?? ['Query', 'Retrieve', 'Rank', 'Answer'])

// Pipeline colours per status (mirrors the design's stage map). Order matches
// the four stages above; each entry is that stage's dot colour.
const FAINT = 'var(--pipeline-idle)'
const CYAN = 'var(--accent-cyan)'
const GREEN = 'var(--accent-green)'
const WARM = 'var(--accent-warm)'
const RED = 'var(--destructive)'

const colorMap: Record<AskStatus, string[]> = {
  idle: [FAINT, FAINT, FAINT, FAINT],
  loading: [CYAN, CYAN, FAINT, FAINT],
  answer: [GREEN, GREEN, GREEN, GREEN],
  empty: [GREEN, GREEN, GREEN, RED],
  error: [GREEN, WARM, FAINT, FAINT]
}

const stages = computed(() =>
  stageLabels.value.map((label, i) => ({
    label,
    color: (colorMap[status.value] ?? colorMap.idle)[i] ?? FAINT
  }))
)

// Idle: instead of four static grey dots, a soft cyan glow travels the pipeline
// (see the scoped .pipeline-wave animation). Any active status drops back to the
// colorMap above.
const isIdle = computed(() => status.value === 'idle')

// Right-hand timing text: idle label when idle, "- -" while loading, else the
// measured timing.
const timingText = computed(() => {
  if (status.value === 'idle') return footer.value?.idleLabel ?? 'idle'
  if (status.value === 'loading') return '···'
  return timing.value ?? ''
})

// Mobile shows a single plain-language status + dot instead of the four stages,
// so the footer never overflows a narrow screen.
const mobileStatusColor: Record<AskStatus, string> = {
  idle: FAINT,
  loading: CYAN,
  answer: GREEN,
  empty: RED,
  error: WARM
}
const mobileStatus = computed(() => ({
  label: footer.value?.status?.[status.value] ?? status.value,
  color: mobileStatusColor[status.value] ?? FAINT
}))
</script>

<template>
  <footer
    class="fixed bottom-0 left-1/2 z-[60] w-full -translate-x-1/2 border-t border-border bg-surface-footer backdrop-blur-[18px] backdrop-saturate-[1.2]"
  >
    <div
      class="container mx-auto flex h-[52px] items-center justify-between gap-4 px-5 md:px-8"
    >
      <!-- Mobile: a single plain-language status instead of the full pipeline. -->
      <div class="flex items-center gap-2 font-mono text-xs text-text-muted sm:hidden">
        <span
          class="size-[7px] rounded-full transition-colors"
          :style="{ background: mobileStatus.color, boxShadow: `0 0 8px 1px ${mobileStatus.color}55` }"
        />
        {{ mobileStatus.label }}
      </div>

      <!-- Left: the RAG pipeline with live per-stage dots (sm and up) -->
      <div class="hidden items-center gap-2.5 font-mono text-xs text-text-muted sm:flex">
        <template
          v-for="(stage, i) in stages"
          :key="stage.label"
        >
          <span
            v-if="i > 0"
            aria-hidden="true"
            class="text-pipeline-idle"
          >→</span>
          <span class="inline-flex items-center gap-1.5">
            <span
              class="size-[7px] rounded-full"
              :class="isIdle ? 'pipeline-wave' : 'transition-colors'"
              :style="isIdle ? { '--i': i } : { background: stage.color, boxShadow: `0 0 8px 1px ${stage.color}55` }"
            />
            <span class="hidden sm:inline">{{ stage.label }}</span>
          </span>
        </template>
        <span class="ml-1 text-pipeline-sep">· {{ timingText }}</span>
      </div>

      <!-- Right: quiet meta caption -->
      <div class="hidden font-mono text-xs text-text-faint sm:block">
        {{ footer?.meta }}
      </div>
    </div>
  </footer>
</template>

<style scoped>
/* Idle pipeline: a soft cyan glow travels the four dots and back, the dots just
   behind the active one still glimmering (a comet tail). Pure CSS, staggered
   animation-delay per dot (--i) over a 2.4s cycle; no JS timer. */
.pipeline-wave {
  background: var(--pipeline-idle);
  animation: pipeline-wave 2.4s ease-in-out infinite;
  animation-delay: calc(var(--i) * 0.6s);
}

@keyframes pipeline-wave {
  0% {
    background: var(--accent-cyan);
    box-shadow: 0 0 8px 1px color-mix(in srgb, var(--accent-cyan) 45%, transparent);
  }
  50%,
  100% {
    background: var(--pipeline-idle);
    box-shadow: 0 0 8px 1px transparent;
  }
}

@media (prefers-reduced-motion: reduce) {
  .pipeline-wave {
    animation: none;
  }
}
</style>
