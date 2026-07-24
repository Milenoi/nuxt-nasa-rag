<script setup lang="ts">
// How it works: the RAG pipeline as a four-step vertical timeline, mirroring the
// sibling caching site's "how" page. Copy comes from /api/content.
import { Code2, ChevronDown } from '@lucide/vue'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'

const { data: content } = await useFetch('/api/content', { key: 'content' })
const hw = computed(() => content.value?.howItWorks)
const sibling = computed(() => content.value?.sibling)

useSeoMeta({
  title: 'How it works | APOD Ask',
  description:
    'How APOD Ask turns a question into a grounded answer: embed, retrieve, rank, generate. Retrieval you can actually see.'
})

// Node accent per pipeline stage, matching the footer pipeline colours.
const palette: Record<string, { border: string; text: string }> = {
  cyan: { border: 'border-accent-cyan/40', text: 'text-accent-cyan' },
  purple: { border: 'border-accent-purple/40', text: 'text-accent-purple' },
  green: { border: 'border-accent-green/40', text: 'text-accent-green' }
}

// Real excerpts from the project, one per step, the actual code doing the work.
const snippets: { file: string; code: string }[] = [
  {
    file: 'server/utils/embed.ts',
    code: `const response = await ai.models.embedContent({
  model: 'gemini-embedding-001',      // multilingual, 100+ languages
  contents: text,
  config: { outputDimensionality: 768 }
})
// normalize to unit length → cosine is a plain dot product
return normalize(response.embeddings[0].values)`
  },
  {
    file: 'server/infrastructure/upstashVectorStore.ts',
    code: `// The question vector goes to the Upstash Vector index,
// which returns the closest APOD vectors by cosine similarity.
const matches = await index.query({
  vector: questionVector,
  topK: 5,
  includeMetadata: true
})`
  },
  {
    file: 'server/usecases/resolveQuestion.ts',
    code: `// The matches come back sorted; the top five are the sources.
// Cheap guard: if even the closest scores far too low, skip
// the model and show the "nonsense" screen.
if (topScore < 0.48) {
  return { state: 'nonsense', sources: [] }
}
// Otherwise the model itself judges the input (next step).`
  },
  {
    file: 'server/usecases/resolveQuestion.ts',
    code: `// Build the grounded prompt (answer only from these texts)...
const prompt = \`Answer using ONLY the APOD descriptions.
Reply NONSENSE for gibberish, NO_MATCH for a real question
the texts don't cover, else answer and cite the picture.

\${context}
Question: \${question}\`

// ...then ask the model through a port. Gemini itself lives in
// an adapter, so the use case never depends on the SDK.
const reply = await model.generate(prompt)`
  }
]

// A tiny, safe syntax highlighter, enough to read like the sibling site's
// Shiki panels (comments, strings, keywords) without a build pipeline. Works
// line by line so keywords inside a `// comment` aren't mis-coloured.
const KEYWORDS = ['const', 'let', 'await', 'return', 'if', 'export', 'function', 'new', 'for']
const KEYWORD_RE = new RegExp(`\\b(${KEYWORDS.join('|')})\\b`, 'g')

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function highlight(code: string) {
  return code
    .split('\n')
    .map((line) => {
      const commentAt = line.indexOf('//')
      const codePart = commentAt >= 0 ? line.slice(0, commentAt) : line
      const comment = commentAt >= 0 ? line.slice(commentAt) : ''
      let html = escapeHtml(codePart)
        .replace(/(['"`])(.*?)\1/g, '<span class="tok-str">$1$2$1</span>')
        .replace(KEYWORD_RE, '<span class="tok-kw">$1</span>')
      if (comment) html += `<span class="tok-com">${escapeHtml(comment)}</span>`
      return html
    })
    .join('\n')
}

const highlighted = snippets.map((s) => ({ ...s, html: highlight(s.code) }))
</script>

<template>
  <section class="animate-fade-up mx-auto min-h-dvh max-w-3xl px-5 pb-40 pt-32 md:px-8">
    <div class="text-left md:text-center">
      <p class="mb-3 text-sm font-medium tracking-wide text-text-muted">
        {{ hw?.tagline }}
      </p>
      <h1 class="mb-5 font-serif text-[clamp(40px,6vw,64px)] font-light leading-none tracking-tight text-text-strong">
        {{ hw?.heading }}
      </h1>
      <p class="mx-auto mb-14 max-w-[56ch] text-base leading-relaxed text-text-secondary">
        {{ hw?.lead }}
      </p>
    </div>

    <ol class="mx-auto flex max-w-lg list-none flex-col text-left">
      <li
        v-for="(step, i) in hw?.steps"
        :key="step.name"
        class="flex gap-5"
      >
        <!-- numbered node + connector -->
        <div class="flex flex-col items-center">
          <div
            class="grid size-11 flex-none place-items-center rounded-full border bg-popover font-mono text-sm"
            :class="[palette[step.color]?.border, palette[step.color]?.text]"
          >
            {{ i + 1 }}
          </div>
          <div
            v-if="i < (hw?.steps?.length ?? 0) - 1"
            class="my-2.5 w-px flex-1 bg-white/10"
          />
        </div>
        <!-- step text -->
        <div class="pb-9">
          <div class="mb-1.5 flex flex-wrap items-center gap-3">
            <span class="text-lg font-medium text-text-strong">{{ step.name }}</span>
            <span
              class="font-mono text-xs uppercase tracking-wider"
              :class="palette[step.color]?.text"
            >
              {{ step.role }}
            </span>
          </div>
          <p class="max-w-[52ch] text-sm leading-relaxed text-text-secondary">
            {{ step.desc }}
          </p>

          <!-- Real code for this step, collapsed by default. Disclosure handled
               by the shadcn/reka Collapsible (native aria + animation). -->
          <Collapsible
            v-if="highlighted[i]"
            v-slot="{ open }"
            class="group mt-4"
          >
            <CollapsibleTrigger
              class="inline-flex items-center gap-1.5 font-mono text-xs text-text-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Code2
                class="size-3.5"
                aria-hidden="true"
              />
              <span>{{ open ? hw?.hideCode : hw?.showCode }}</span>
              <ChevronDown
                class="size-3.5 transition-transform duration-200 group-data-[state=open]:rotate-180"
                aria-hidden="true"
              />
            </CollapsibleTrigger>
            <CollapsibleContent
              class="mt-3 max-w-[52ch] rounded-xl border border-border bg-popover"
            >
              <div class="flex items-center gap-2 border-b border-border px-4 py-2 font-mono text-xs text-text-muted">
                <span
                  aria-hidden="true"
                  class="size-1.5 rounded-full bg-white/25"
                />
                {{ highlighted[i]?.file }}
              </div>
              <!-- eslint-disable-next-line vue/no-v-html -- our own static code, highlighted at load -->
              <pre class="code-panel overflow-x-auto p-4 font-mono text-xs leading-relaxed text-text-body"><code v-html="highlighted[i]?.html" /></pre>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </li>
    </ol>

    <aside class="mx-auto mt-6 max-w-[56ch] text-left md:text-center">
      <p class="text-sm leading-relaxed text-text-muted">
        {{ hw?.footnote }}
        <a
          :href="sibling?.url"
          target="_blank"
          rel="noopener noreferrer"
          class="text-star-link hover:text-white"
        >{{ sibling?.label }}</a>.
      </p>
    </aside>
  </section>
</template>

<style scoped>
/* Lightweight code highlighting, coloured from the design tokens (not Shiki). */
.code-panel :deep(.tok-com) {
  color: var(--text-faint);
  font-style: italic;
}
.code-panel :deep(.tok-kw) {
  color: var(--accent-cyan);
}
.code-panel :deep(.tok-str) {
  color: var(--accent-green);
}
</style>
