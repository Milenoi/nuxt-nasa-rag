<script setup lang="ts">
// Root: a thin top loading bar during route changes (like the sibling site),
// then the default layout wraps every page.
</script>

<template>
  <NuxtLoadingIndicator
    color="var(--accent-cyan)"
    :height="3"
    :duration="2000"
    :throttle="200"
  />
  <NuxtRouteAnnouncer />
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
