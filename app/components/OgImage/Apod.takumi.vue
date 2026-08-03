<script setup lang="ts">
// The social preview card (1200x630). The `.takumi.vue` suffix picks the renderer.
// Literal colours and plain divs instead of tokens and the real StarField: the
// renderer rasterizes this in isolation, so it sees neither the @theme block in
// tailwind.css nor any animation, and supports only a flexbox subset.
const props = defineProps<{
  page?: 'index' | 'howItWorks' | 'about' | 'faq'
}>()

// Fetched here, not passed as props: pages resolve /api/content asynchronously,
// so the strings do not exist yet at defineOgImage() call time.
const { data: content } = await useFetch('/api/content', { key: 'content' })

const seo = computed(() => content.value?.seo?.[props.page ?? 'index'])

// "FAQ | APOD Ask" is a browser-tab title. On the card the site name is already in
// the eyebrow and the footer, so the suffix would just eat headline space.
const title = computed(() => (seo.value?.title ?? 'APOD Ask').split(' | ')[0])
const description = computed(() => seo.value?.description ?? '')

// Fixed positions, not random: the same page has to produce the same image on
// every build, otherwise the cached social previews churn for no reason.
const STARS = [
  { x: 4, y: 12, s: 3, o: 0.5 },
  { x: 11, y: 34, s: 2, o: 0.35 },
  { x: 18, y: 8, s: 2, o: 0.4 },
  { x: 27, y: 78, s: 3, o: 0.3 },
  { x: 36, y: 22, s: 2, o: 0.45 },
  { x: 44, y: 62, s: 2, o: 0.25 },
  { x: 57, y: 14, s: 3, o: 0.4 },
  { x: 63, y: 88, s: 2, o: 0.3 },
  { x: 71, y: 40, s: 2, o: 0.35 },
  { x: 79, y: 18, s: 4, o: 0.55 },
  { x: 84, y: 68, s: 2, o: 0.3 },
  { x: 91, y: 30, s: 3, o: 0.45 },
  { x: 95, y: 82, s: 2, o: 0.28 },
  { x: 66, y: 56, s: 2, o: 0.22 }
]
</script>

<template>
  <div
    style="
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      background-color: #020308;
      padding: 72px;
      font-family: Inter;
      position: relative;
    "
  >
    <div
      v-for="(star, i) in STARS"
      :key="i"
      :style="`position: absolute; left: ${star.x}%; top: ${star.y}%; width: ${star.s}px; height: ${star.s}px; border-radius: 9999px; background-color: #eaf1ff; opacity: ${star.o};`"
    />

    <!-- Aldebaran, the one warm star, echoes the Taurus easter egg on the site. -->
    <div
      style="
        position: absolute;
        left: 87%;
        top: 47%;
        width: 10px;
        height: 10px;
        border-radius: 9999px;
        background-color: #ffb37a;
        opacity: 0.85;
      "
    />

    <div style="display: flex; align-items: center">
      <div
        style="
          width: 34px;
          height: 4px;
          border-radius: 9999px;
          background-color: #38d6ee;
          margin-right: 18px;
        "
      />
      <div
        style="
          font-family: Roboto Mono;
          font-size: 22px;
          letter-spacing: 5px;
          color: #38d6ee;
        "
      >
        NASA APOD RAG
      </div>
    </div>

    <div style="display: flex; flex-direction: column">
      <div
        style="
          font-size: 68px;
          font-weight: 600;
          line-height: 1.12;
          color: #fafafa;
          margin-bottom: 26px;
        "
      >
        {{ title }}
      </div>
      <div
        style="
          font-size: 28px;
          line-height: 1.45;
          color: #a6a6ac;
          max-width: 900px;
        "
      >
        {{ description }}
      </div>
    </div>

    <div style="display: flex; align-items: center; justify-content: space-between">
      <div
        style="
          font-family: Roboto Mono;
          font-size: 22px;
          color: #7d7d84;
        "
      >
        nuxt-rag.netlify.app
      </div>
      <!-- The three pipeline dots from the site footer: embed, retrieve, generate. -->
      <div style="display: flex; align-items: center">
        <div
          style="
            width: 12px;
            height: 12px;
            border-radius: 9999px;
            background-color: #38d6ee;
            margin-left: 14px;
          "
        />
        <div
          style="
            width: 12px;
            height: 12px;
            border-radius: 9999px;
            background-color: #9b7bff;
            margin-left: 14px;
          "
        />
        <div
          style="
            width: 12px;
            height: 12px;
            border-radius: 9999px;
            background-color: #5fd39a;
            margin-left: 14px;
          "
        />
      </div>
    </div>
  </div>
</template>
