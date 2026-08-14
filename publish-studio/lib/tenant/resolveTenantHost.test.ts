import {afterAll, beforeAll, describe, expect, it} from 'vitest'

import {resolveTenantHost} from '@/lib/tenant/resolveTenantHost'

const ENV_KEY = 'NEXT_PUBLIC_DIRECTWERK_DEFAULT_TENANT_HOST'
const FALLBACK_HOST = 'alpha-a.localhost'

describe('resolveTenantHost', () => {
    let previousEnv: string | undefined

    beforeAll(() => {
        previousEnv = process.env[ENV_KEY]
        process.env[ENV_KEY] = FALLBACK_HOST
    })

    afterAll(() => {
        if (previousEnv === undefined) {
            delete process.env[ENV_KEY]
        } else {
            process.env[ENV_KEY] = previousEnv
        }
    })

    it('keeps real tenant hosts', () => {
        expect(resolveTenantHost('alpha-a.localhost')).toBe('alpha-a.localhost')
        expect(resolveTenantHost('ALPHA-A.localhost:3003')).toBe('alpha-a.localhost')
    })

    it('maps loopback hosts to the default tenant', () => {
        expect(resolveTenantHost('localhost')).toBe(FALLBACK_HOST)
        expect(resolveTenantHost('localhost:3003')).toBe(FALLBACK_HOST)
        expect(resolveTenantHost('127.0.0.1:3003')).toBe(FALLBACK_HOST)
        expect(resolveTenantHost(null)).toBe(FALLBACK_HOST)
    })

    it('rejects malformed hosts instead of falling back', () => {
        expect(() => resolveTenantHost('../evil')).toThrow('Invalid tenant host')
        expect(() => resolveTenantHost('not a host!!!')).toThrow('Invalid tenant host')
    })

    it('ignores a loopback configured fallback', () => {
        const previous = process.env[ENV_KEY]
        process.env[ENV_KEY] = 'localhost'
        try {
            expect(resolveTenantHost(null)).toBe(FALLBACK_HOST)
        } finally {
            process.env[ENV_KEY] = previous
        }
    })
})
