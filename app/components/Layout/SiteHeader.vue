<script setup lang="ts">
// Fixed, transparent, blurred-gradient header, ported 1:1 from the sibling
// caching site so the two feel like one family. Copy comes from /api/content.
const { data: content } = await useFetch('/api/content', { key: 'content' })
const { status, timing, homeReset } = useAskStatus()

const route = useRoute()
const menuOpen = ref(false)

const header = computed(() => content.value?.header)
const nav = computed(() => content.value?.nav ?? [])

// Clicking the logo always brings the search field back, a soft reset of the
// Ask flow (the page clears its own state when status returns to idle).
function resetToAsk() {
  status.value = 'idle'
  timing.value = null
  menuOpen.value = false
  // Also snap the Taurus stars back to their starting positions.
  homeReset.value++
}

// Ask (/) matches only the home route; other links match by prefix.
const isActive = (to: string) =>
  to === '/' ? route.path === '/' : route.path.startsWith(to)

// Close the mobile menu whenever the route changes.
watch(
  () => route.fullPath,
  () => {
    menuOpen.value = false
  }
)
</script>

<template>
  <header class="fixed left-1/2 top-0 z-50 w-full -translate-x-1/2">
    <!-- Blurred gradient scrim that fades out downward (no hard edge). -->
    <div
      class="pointer-events-none absolute inset-x-0 top-0 h-26 header-scrim md:h-35"
    />

    <nav
      class="container relative mx-auto flex h-19 items-center px-5 text-shadow-nav md:px-8"
    >
      <NuxtLink
        to="/"
        class="font-serif text-brand text-white"
        @click="resetToAsk"
      >
        {{ header?.brand }}
      </NuxtLink>

      <!-- Desktop nav -->
      <div class="ml-auto hidden items-center gap-7.5 text-sm md:flex">
        <NuxtLink
          v-for="item in nav"
          :key="item.link"
          :to="item.link"
          class="transition-colors hover:text-white"
          :class="isActive(item.link) ? 'text-white' : 'text-white/60'"
          @click="item.link === '/' && resetToAsk()"
        >
          {{ item.label }}
        </NuxtLink>
        <a
          :href="header?.githubUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-1.5 text-white/60 transition-colors hover:text-white"
        >
          {{ header?.github }}
        </a>
      </div>

      <!-- Mobile: animated orbit hamburger -->
      <button
        type="button"
        aria-label="Toggle menu"
        :aria-expanded="menuOpen"
        aria-controls="mobile-nav"
        class="ml-auto flex size-10.5 items-center justify-center rounded-md border border-white/18 bg-white/4 text-white backdrop-blur focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
        @click="menuOpen = !menuOpen"
      >
        <span
          v-if="!menuOpen"
          class="relative block size-5.5"
        >
          <span class="absolute inset-0 rounded-full border border-white/28" />
          <span class="absolute left-1/2 top-1/2 -ml-0.75 -mt-0.75 size-1.5 rounded-full bg-text-strong" />
          <span class="absolute inset-0 animate-orbit">
            <span class="absolute left-1/2 -top-0.5 -ml-0.625 size-1.25 rounded-full bg-accent-cyan shadow-glow-cyan" />
          </span>
        </span>
        <span
          v-else
          class="text-lg leading-none"
        >✕</span>
      </button>
    </nav>

    <!-- Mobile dropdown menu -->
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0 -translate-y-1"
      leave-active-class="transition duration-100 ease-in"
      leave-to-class="opacity-0 -translate-y-1"
    >
      <div
        v-if="menuOpen"
        id="mobile-nav"
        class="absolute inset-x-0 top-19 flex flex-col border-b border-border px-5 pb-4.5 pt-2 backdrop-blur-lg md:hidden bg-menu-stars"
      >
        <NuxtLink
          v-for="item in nav"
          :key="item.link"
          :to="item.link"
          class="border-b border-white/6 px-1 py-3.5 text-left text-base text-text-strong"
          @click="item.link === '/' && resetToAsk()"
        >
          {{ item.label }}
        </NuxtLink>
        <a
          :href="header?.githubUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="px-1 py-3.5 text-base text-text-secondary"
        >
          {{ header?.github }}
        </a>
      </div>
    </Transition>
  </header>
</template>
