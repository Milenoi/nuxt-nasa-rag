<script setup lang="ts">
// Floating "back to top" button, ported 1:1 from the sibling site. Appears
// after scrolling down, hidden on the full-bleed Ask home so it never overlaps
// the hero.
import { ArrowUp } from '@lucide/vue'

const route = useRoute()
const visible = ref(false)

const onScroll = () => {
  visible.value = window.scrollY > 400
}

onMounted(() => {
  window.addEventListener('scroll', onScroll, { passive: true })
  // Reflect the current scroll position immediately (e.g. on reload / deep link),
  // otherwise the button stays hidden until the next scroll event.
  onScroll()
})
onUnmounted(() => window.removeEventListener('scroll', onScroll))

const scrollTop = () => {
  // A JS smooth scroll isn't covered by the global reduced-motion CSS rule, so
  // honour the preference explicitly.
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
}

// Hidden on the home hero.
const enabled = computed(() => route.path !== '/')
</script>

<template>
  <ClientOnly>
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="translate-y-2 opacity-0"
      leave-active-class="transition duration-150 ease-in"
      leave-to-class="translate-y-2 opacity-0"
    >
      <button
        v-if="enabled && visible"
        type="button"
        aria-label="Scroll to top"
        class="fixed bottom-[72px] right-5 z-50 grid size-11 place-items-center rounded-full border border-white/[0.14] bg-surface-float text-foreground backdrop-blur-md transition-colors hover:border-white/30 hover:bg-white/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:right-8"
        @click="scrollTop"
      >
        <ArrowUp class="h-5 w-5" />
      </button>
    </Transition>
  </ClientOnly>
</template>
