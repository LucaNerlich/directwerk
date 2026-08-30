import {describe, expect, it} from 'vitest'

import {getClientTenantHost} from '../src/tenant/getClientTenantHost'
import {
    resolveTenantHost,
    resolveTenantHostFromHeaders,
} from '../src/tenant/resolveTenantHost'

describe('resolveTenantHost', () => {
    it('keeps real tenant hosts', () => {
        expect(resolveTenantHost('alpha-a.localhost')).toBe('alpha-a.localhost')
    })

    it('returns null when no host is available', () => {
        expect(resolveTenantHost(null)).toBeNull()
        expect(resolveTenantHost('')).toBeNull()
    })

    it('uses the selected tenant host override', () => {
        expect(
            resolveTenantHost('studio.directwerk.org', {
                selectedTenantHost: 'alpha-a.localhost',
            }),
        ).toBe('alpha-a.localhost')
    })

    it('rejects malformed hosts instead of falling back', () => {
        expect(() => resolveTenantHost('../evil')).toThrow('Invalid tenant host')
    })
})

describe('getClientTenantHost', () => {
    it('returns empty string without a workspace cookie', () => {
        expect(getClientTenantHost()).toBe('')
    })
})

describe('resolveTenantHostFromHeaders', () => {
    it('prefers host over x-forwarded-host by default', () => {
        const headers = {
            get: (name: string) =>
                name === 'host'
                    ? 'alpha-a.localhost'
                    : name === 'x-forwarded-host'
                      ? 'evil.example'
                      : null,
        }
        expect(resolveTenantHostFromHeaders(headers)).toBe('alpha-a.localhost')
    })
})
