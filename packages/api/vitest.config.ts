import {defineConfig} from 'vitest/config'

export default defineConfig({
    test: {
        environment: 'jsdom',
        include: ['tests/**/*.test.ts'],
    },
    resolve: {
        alias: {
            'server-only': new URL('./vitest.server-only.ts', import.meta.url).pathname,
        },
    },
})
