import {describe, expect, it} from 'vitest'

import {getTenant, parseTenantHost, TENANTS} from './tenants'

describe('tenant host validation', () => {
    it('accepts only configured tenant hosts', () => {
        expect(parseTenantHost('alpha-a.localhost')).toBe('alpha-a.localhost')
        expect(parseTenantHost('alpha-b.localhost')).toBe('alpha-b.localhost')
    })

    it.each([
        null,
        '',
        'ALPHA-A.LOCALHOST',
        'alpha-a.localhost.evil.test',
        'alpha-a.localhost:8080',
        'localhost',
    ])('rejects non-allow-listed host %s', (host) => {
        expect(parseTenantHost(host)).toBeNull()
    })

    it('provides the two seeded tenant labels and slugs', () => {
        expect(TENANTS).toHaveLength(2)
        expect(getTenant('alpha-a.localhost')).toEqual({
            host: 'alpha-a.localhost',
            label: 'Tenant A',
            slug: 'alpha-show-a',
        })
    })
})
