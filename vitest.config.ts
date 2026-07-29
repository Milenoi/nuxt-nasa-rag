import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        include: ['tests/**/*.test.ts']
    },
    resolve: {
        // Mirror Nuxt's #shared alias so tests can import the shared contract.
        alias: {
            '#shared': fileURLToPath(new URL('./shared', import.meta.url))
        }
    }
})
