import {describe, expect, it} from 'vitest'

import {buildProxyPath} from '@directwerk/api/proxy'

describe('buildProxyPath', () => {
    it('allows domain hosts with dots as path segments', () => {
        expect(
            buildProxyPath(['tenant', 'domains', 'podcast.example.com', 'verification']),
        ).toBe('/api/v1/tenant/domains/podcast.example.com/verification')
    })

    it('rejects path traversal segments', () => {
        expect(buildProxyPath(['tenant', '..', 'users'])).toBeNull()
    })
})
