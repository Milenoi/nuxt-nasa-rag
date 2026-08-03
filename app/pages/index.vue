<script setup lang="ts">
// The Ask page: a question goes to POST /api/ask, which embeds it, retrieves the
// closest APOD texts by cosine similarity, and has Gemini write a grounded answer.
// All interaction lives in useAsk(); this file only routes the current state to a
// view, and the pipeline footer mirrors `status` via useAskStatus().
const { ask, suggest, seo } = useContent()

// The og:* pair is set explicitly: useSeoMeta does not mirror title/description into
// them, so without this every shared link would show the site-wide default.
useSeoMeta({
  title: () => seo.value?.index?.title,
  description: () => seo.value?.index?.description,
  ogTitle: () => seo.value?.index?.title,
  ogDescription: () => seo.value?.index?.description
})

defineOgImage('Apod', { page: 'index' })

const {
  query,
  queryEcho,
  answerHtml,
  sources,
  errorDetail,
  askHint,
  noDirectAnswer,
  remark,
  lastStarTrek,
  starTrek,
  rewrite,
  suggesting,
  suggestions,
  heroIndex,
  liveMessage,
  status,
  showIdle,
  onAsk,
  chooseSuggestion,
  keepOriginal,
  useExample,
  reset,
  runSearch,
  selectSource
} = useAsk()
</script>

<template>
  <div class="relative">
    <!-- Screen-reader announcement for Ask state changes (visually hidden). -->
    <p
      class="sr-only"
      role="status"
      aria-live="polite"
    >
      {{ liveMessage }}
    </p>

    <!-- IDLE: the hero + ask box -->
    <AskIdle
      v-if="showIdle"
      v-model:query="query"
      v-model:rewrite="rewrite"
      v-model:star-trek="starTrek"
      :ask-hint="askHint"
      @ask="onAsk"
      @use-example="useExample"
    />

    <!-- SUGGESTING: Smart search fetching alternatives -->
    <div
      v-else-if="suggesting"
      class="animate-fade-up flex min-h-screen-nav items-center justify-center px-5"
    >
      <OrbitLoader :label="suggest?.loading" />
    </div>

    <!-- SUGGESTIONS: the "did you mean?" panel -->
    <SuggestPanel
      v-else-if="suggestions.length"
      :question="query"
      :suggestions="suggestions"
      :copy="suggest"
      @choose="chooseSuggestion"
      @keep-original="keepOriginal"
    />

    <!-- LOADING: the orbit spinner -->
    <div
      v-else-if="status === 'loading'"
      class="animate-fade-up flex min-h-screen-nav items-center justify-center px-5"
    >
      <OrbitLoader :label="ask?.loading" />
    </div>

    <!-- ANSWER: hero image + AI answer + sources -->
    <AskAnswer
      v-else-if="status === 'answer'"
      :sources="sources"
      :hero-index="heroIndex"
      :query-echo="queryEcho"
      :no-direct-answer="noDirectAnswer"
      :remark="remark"
      :answer-html="answerHtml"
      @reset="reset"
      @select="selectSource"
    />

    <!-- EMPTY: nothing crossed the event horizon -->
    <AskEmpty
      v-else-if="status === 'empty'"
      :remark="remark"
      :last-star-trek="lastStarTrek"
      @reset="reset"
    />

    <!-- ERROR: the signal fell into a black hole -->
    <AskError
      v-else-if="status === 'error'"
      :error-detail="errorDetail"
      @retry="runSearch(query)"
      @reset="reset"
    />
  </div>
</template>
