<script setup lang="ts">
// App shell: the animated starfield sits behind everything (fixed, -z), then
// the blurred header, the page content, and the frosted pipeline footer. Mirrors
// the sibling caching site's layout structure.
</script>

<template>
  <div class="relative min-h-dvh text-foreground">
    <!-- Global animated backdrop (fixed, pointer-events-none, behind content). -->
    <StarField />
    <!-- Interactive Taurus easter egg (drag its stars), just above content. -->
    <TaurusConstellation />

    <a
      href="#main"
      class="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:border focus:border-white/20 focus:bg-popover focus:px-4 focus:py-2 focus:text-sm focus:text-foreground"
    >
      Skip to content
    </a>

    <LayoutSiteHeader />

    <main
      id="main"
      class="relative z-10 pb-13"
    >
      <slot />
    </main>

    <LayoutSiteFooter />
    <LayoutScrollToTop />
  </div>
</template>
