import {describe, expect, test} from 'vitest'

import {createDirectwerkContentSecurityPolicy} from '../../packages/next-config/createDirectwerkNextConfig'
import nextConfig from '../next.config'

describe('Next.js config', () => {
    test('bundles PostCSS instead of leaving a monorepo-relative runtime external', () => {
        expect(nextConfig.transpilePackages).toContain('postcss')
    })

    test('builds a nonce-based production CSP for token-storing apps', () => {
        const policy = createDirectwerkContentSecurityPolicy('test-nonce', false)

        expect(policy).toContain("script-src 'self' 'nonce-test-nonce' 'strict-dynamic'")
        expect(policy).not.toContain("'unsafe-eval'")
        expect(policy).toContain('upgrade-insecure-requests')
    })

    test('keeps development tooling compatible with the CSP', () => {
        const policy = createDirectwerkContentSecurityPolicy('test-nonce', true)

        expect(policy).toContain("'unsafe-eval'")
        expect(policy).toContain("connect-src 'self' https: http: ws: wss:")
        expect(policy).not.toContain('upgrade-insecure-requests')
    })
})
