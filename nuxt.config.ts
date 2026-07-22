// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from '@tailwindcss/vite'
import imageConfig from './app/utils/getImageConfig'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  modules: ['@nuxt/eslint', '@nuxt/image', '@nuxt/fonts', 'shadcn-nuxt'],

  // Global stylesheet: Tailwind v4 entry + design tokens.
  css: ['~/assets/css/tailwind.css'],

  runtimeConfig: {
    // Server-only secrets — never sent to the browser.
    nasaApiKey: process.env.NASA_API_KEY || '',
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    public: {
      // Exposed to the browser — must contain NO secrets.
      nasaApodApiUrl: process.env.NUXT_NASA_APOD_API_URL || ''
    }
  },

  // shadcn-vue: components live under app/components/ui, prefixed with "Ui".
  shadcn: {
    prefix: 'Ui',
    componentDir: '@/components/ui'
  },

  // @nuxt/image: dev uses IPX, production uses the Netlify Image CDN (see
  // getImageConfig) — keeps sharp/IPX out of the serverless function.
  image: imageConfig,

  // Fonts are referenced via CSS custom properties (var(--font-sans) …), which
  // @nuxt/fonts cannot always detect through the indirection — list them
  // explicitly so they are reliably self-hosted and preloaded.
  fonts: {
    families: [
      { name: 'Inter', weights: [300, 400, 500, 600] },
      { name: 'Spectral', weights: [300, 400] },
      { name: 'Roboto Mono', weights: [400, 500] }
    ]
  },

  // The two content pages are fully static — prerender them to plain HTML so
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
      titleTemplate: (title?: string) => (title ? title : 'APOD Ask — ask the stars'),
      meta: [
        {
          name: 'description',
          content:
            "Natural-language search across NASA's Astronomy Picture of the Day — answers grounded in real APOD descriptions, with the source images."
        },
        { property: 'og:title', content: 'APOD Ask' },
        {
          property: 'og:description',
          content: 'Ask astronomy questions, get answers grounded in real NASA APOD texts.'
        },
        { property: 'og:type', content: 'website' },
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
