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

// The preview picture: the newest APOD still image NASA owns, same one on every page.
// Cropped to 1200x630 through the image CDN, because APOD ships any aspect ratio and
// the networks would otherwise cut the middle out of a portrait shot. Absolute URL,
// since crawlers do not resolve relative ones.
const { data: preview } = await useFetch('/api/apod-preview', { key: 'apod-preview' })
const img = useImage()
const previewImage = computed(() => {
  if (!preview.value?.url) return undefined
  const cropped = img(preview.value.url, { width: 1200, height: 630, fit: 'cover' })
  return new URL(cropped, site.url).toString()
})

// No og:image:width/height on purpose: APOD stills are often only 1024 wide and the
// CDN does not upscale, so any fixed pair would be a lie. The crawlers measure anyway.
useSeoMeta({
  ogImage: previewImage,
  ogImageAlt: () => preview.value?.title,
  twitterImage: previewImage,
  // Only promise a big card when there really is a picture behind it.
  twitterCard: () => (previewImage.value ? 'summary_large_image' : 'summary')
})

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
