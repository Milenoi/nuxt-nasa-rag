// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from '@tailwindcss/vite'
import imageConfig from './app/utils/getImageConfig'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  modules: [
    '@nuxt/eslint',
    '@nuxt/image',
    '@nuxt/fonts',
    'shadcn-nuxt',
    'nuxt-schema-org',
    'nuxt-og-image'
  ],

  // Global stylesheet: Tailwind v4 entry + design tokens.
  css: ['~/assets/css/tailwind.css'],

  // Canonical site identity; nuxt-schema-org uses it to emit default WebSite +
  // WebPage JSON-LD on every page. Same URL that public/ (sitemap, robots) hardcodes.
  site: {
    url: 'https://nuxt-rag.netlify.app',
    name: 'APOD Ask',
    description:
      "Natural-language search across NASA's Astronomy Picture of the Day, answers grounded in real APOD descriptions, with the source images."
  },

  runtimeConfig: {
    // Server-only secrets, never sent to the browser.
    nasaApiKey: process.env.NASA_API_KEY || '',
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    public: {
      // Exposed to the browser, must contain NO secrets.
      nasaApodApiUrl: process.env.NUXT_NASA_APOD_API_URL || ''
    }
  },

  // shadcn-vue: components live under app/components/ui, prefixed with "Ui".
  shadcn: {
    prefix: 'Ui',
    componentDir: '@/components/ui'
  },

  // @nuxt/image: dev uses IPX, production uses the Netlify Image CDN (see
  // getImageConfig), keeps sharp/IPX out of the serverless function.
  image: imageConfig,

  ogImage: {
    // 1.91:1, what Facebook, LinkedIn and Slack crop to. The module defaults to 1200x600.
    defaults: { width: 1200, height: 630 },
    // Without a stable secret the module signs URLs with a per-build one, so every
    // deploy would invalidate the previews the networks have already cached.
    security: { secret: process.env.NUXT_OG_IMAGE_SECRET }
  },

  // Listed explicitly because @nuxt/fonts cannot detect families used through the
  // var(--font-sans) indirection. No rel=preload is forced: it can't be attributed
  // through that same indirection, and the Ask page's LCP is the hero image, not text.
  // global: true also hands the font data to nuxt-og-image's renderer.
  fonts: {
    families: [
      { name: 'Inter', weights: [300, 400, 500, 600], global: true },
      { name: 'Spectral', weights: [300, 400] },
      { name: 'Roboto Mono', weights: [400, 500], global: true }
    ]
  },

  // The two content pages are fully static, prerender them to plain HTML so
  // they never hit a serverless function. The Ask page stays dynamic (SSR).
  routeRules: {
    '/about': { prerender: true },
    '/how-it-works': { prerender: true }
  },

  vite: {
    plugins: [tailwindcss()]
  },

  app: {
    // Soft cross-fade between routes and layouts (classes in tailwind.css).
    pageTransition: { name: 'page', mode: 'out-in' },
    layoutTransition: { name: 'layout', mode: 'out-in' },
    head: {
      htmlAttrs: { lang: 'en' },
      // Site-wide SEO defaults; per-page useSeoMeta() overrides title/description.
      title: 'APOD Ask',
      titleTemplate: '%s',
      meta: [
        {
          name: 'description',
          content:
            "Natural-language search across NASA's Astronomy Picture of the Day, answers grounded in real APOD descriptions, with the source images."
        },
        { property: 'og:title', content: 'APOD Ask' },
        {
          property: 'og:description',
          content: 'Ask astronomy questions, get answers grounded in real NASA APOD texts.'
        },
        { property: 'og:type', content: 'website' },
        { property: 'og:site_name', content: 'APOD Ask' },
        // Backed by a real image again: nuxt-og-image renders og:image per page.
        { name: 'twitter:card', content: 'summary_large_image' }
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32x32.png' },
        { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/favicon-16x16.png' },
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
        { rel: 'manifest', href: '/site.webmanifest' }
      ]
    }
  }
})
