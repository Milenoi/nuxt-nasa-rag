<script setup lang="ts">
// Root: a thin top loading bar during route changes (like the sibling site),
// then the default layout wraps every page.

// Site-wide Schema.org: nuxt-schema-org auto-emits WebSite + WebPage on every page
// from the site config. Here we enrich the WebSite node with a SearchAction so search
// engines know the Ask page takes a query via ?q=.
useSchemaOrg([
  defineWebSite({
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: 'https://nuxt-rag.netlify.app/?q={search_term_string}'
      },
      'query-input': 'required name=search_term_string'
    }
  })
])
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
