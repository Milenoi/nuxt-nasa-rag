<script setup lang="ts">
// Standalone error page, Nuxt renders this OUTSIDE the layout, so the shell
// (starfield, header, footer) is included here directly. Same dark, spacey look
// as the app: a black hole with the status code glowing inside it.
const props = defineProps<{
  error: { statusCode?: number; statusMessage?: string; message?: string }
}>()

const code = computed(() => props.error?.statusCode ?? 500)
const isNotFound = computed(() => code.value === 404)

// clearError unwinds the error state before navigating back to the app.
const goHome = () => clearError({ redirect: '/' })
</script>

<template>
  <div class="relative min-h-dvh text-foreground">
    <StarField />
    <LayoutSiteHeader />

    <main class="animate-fade-up relative z-10 flex min-h-dvh flex-col items-center justify-center px-5 py-20 text-center">
      <BlackHole
        variant="cool"
        :size="240"
      >
        <span class="code-glyph font-serif text-[clamp(48px,10vw,88px)] font-light leading-none tracking-tight text-text-strong">
          {{ code }}
        </span>
      </BlackHole>

      <p class="mx-auto mt-8 max-w-md text-lg leading-relaxed text-text-secondary">
        {{ isNotFound
          ? 'This page drifted past the observable universe.'
          : (error?.message || 'Something went wrong out here in the dark.') }}
      </p>

      <button
        type="button"
        class="mt-8 inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-6 py-3.5 text-sm font-medium text-foreground backdrop-blur-md transition-colors hover:border-white/40 hover:bg-white/15"
        @click="goHome"
      >
        ← Back to Ask
      </button>
    </main>

    <!-- Static status strip, styled like the app footer -->
    <footer class="fixed bottom-0 left-1/2 z-[60] w-full -translate-x-1/2 border-t border-border bg-card/75 backdrop-blur-xl backdrop-saturate-150">
      <div class="container mx-auto flex h-13 items-center justify-between gap-4 px-5 font-mono text-xs text-text-muted md:px-8">
        <div class="flex items-center gap-2">
          <span class="size-1.5 rounded-full bg-destructive" />
          HTTP {{ code }} · {{ isNotFound ? 'route not found' : 'error' }}
        </div>
        <div class="hidden text-text-faint sm:block">
          embeddings · retrieval · NASA APOD
        </div>
      </div>
    </footer>
  </div>
</template>

<style scoped>
/* Soft glow behind the status code, a decorative effect, kept out of the
   template rather than as an arbitrary utility. */
.code-glyph {
  text-shadow: 0 0 30px rgba(0, 0, 0, 0.9), 0 0 50px rgba(90, 140, 255, 0.3);
  /* Nudge up slightly: serif digit metrics + the sphere's top-lit gradient make
     it read a touch low when geometrically centred. */
  transform: translateY(-0.08em);
}
</style>
