import {describe, expect, it} from 'vitest'

import {parseTenantHost} from '@/lib/tenant/parseTenantHost'

describe('parseTenantHost', () => {
    it('accepts valid hostnames', () => {
        expect(parseTenantHost('alpha-a.localhost')).toBe('alpha-a.localhost')
        expect(parseTenantHost('ALPHA-A.localhost:3003')).toBe('alpha-a.localhost')
    })

    it('rejects invalid values', () => {
        expect(parseTenantHost(null)).toBeNull()
        expect(parseTenantHost('')).toBeNull()
        expect(parseTenantHost('../evil')).toBeNull()
    })
})
