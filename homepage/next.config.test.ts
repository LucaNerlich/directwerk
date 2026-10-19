import {describe, expect, it} from 'vitest'

import nextConfig from './next.config'

async function resolvedHeaders() {
    const entries = await nextConfig.headers!()
    return entries.flatMap((entry) => entry.headers)
}

describe('homepage security headers (#533)', () => {
    it('ships every header of the shared baseline, HSTS included', async () => {
        const headers = (await resolvedHeaders()).map((header) => header.key)

        expect(headers).toContain('Strict-Transport-Security')
        expect(headers).toContain('X-Content-Type-Options')
        expect(headers).toContain('Referrer-Policy')
        expect(headers).toContain('X-Frame-Options')
        expect(headers).toContain('Permissions-Policy')
    })

    it('pins HTTPS for a year', async () => {
        const hsts = (await resolvedHeaders()).find(
            (header) => header.key === 'Strict-Transport-Security',
        )

        expect(hsts?.value).toContain('max-age=31536000')
        expect(hsts?.value).toContain('includeSubDomains')
    })

    it('keeps its own static CSP without a nonce', async () => {
        const csp = (await resolvedHeaders()).find(
            (header) => header.key === 'Content-Security-Policy',
        )

        expect(csp?.value).toContain("frame-ancestors 'none'")
        expect(csp?.value).not.toContain('nonce-')
    })
})
