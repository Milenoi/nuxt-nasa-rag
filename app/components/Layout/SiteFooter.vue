<script setup lang="ts">
// Fixed, frosted-glass status bar — same treatment as the sibling site's cache
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

// Right-hand timing text: idle label when idle, "— —" while loading, else the
// measured timing.
const timingText = computed(() => {
  if (status.value === 'idle') return footer.value?.idleLabel ?? 'idle'
  if (status.value === 'loading') return '— —'
  return timing.value ?? ''
})
</script>

<template>
  <footer
    class="fixed bottom-0 left-1/2 z-[60] w-full -translate-x-1/2 border-t border-border bg-surface-footer backdrop-blur-[18px] backdrop-saturate-[1.2]"
  >
    <div
      class="container mx-auto flex h-[52px] items-center justify-between gap-4 px-5 md:px-8"
    >
      <!-- Left: the RAG pipeline with live per-stage dots -->
      <div class="flex items-center gap-2.5 font-mono text-xs text-text-muted">
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
              class="size-[7px] rounded-full transition-colors"
              :style="{ background: stage.color, boxShadow: `0 0 8px 1px ${stage.color}55` }"
            />
            {{ stage.label }}
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
