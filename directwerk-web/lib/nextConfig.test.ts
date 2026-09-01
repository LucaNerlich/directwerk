import {describe, expect, test} from 'vitest'

import nextConfig from '../next.config'

describe('Next.js production packaging', () => {
    test('bundles PostCSS instead of leaving a monorepo-relative runtime external', () => {
        expect(nextConfig.transpilePackages).toContain('postcss')
    })
})
