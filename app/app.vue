<script setup lang="ts">
// Root: a thin top loading bar during route changes (like the sibling site),
// then the default layout wraps every page.

// Central because they only ever differ by the current path, and a shared link
// without og:url can get folded into the wrong entry by crawlers.
const route = useRoute()
const site = useSiteConfig()
const pageUrl = computed(() => new URL(route.path, site.url).toString())

useSeoMeta({ ogUrl: pageUrl })
useHead({ link: [{ rel: 'canonical', href: pageUrl }] })

// nuxt-schema-org auto-emits WebSite + WebPage from the site config; the SearchAction
// tells search engines the Ask page takes a query via ?q=.
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
