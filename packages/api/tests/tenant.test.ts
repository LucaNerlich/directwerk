import {afterAll, beforeAll, describe, expect, it} from 'vitest'

import {getClientTenantHost} from '../src/tenant/getClientTenantHost'
import {
    resolveTenantHost,
    resolveTenantHostFromHeaders,
} from '../src/tenant/resolveTenantHost'

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
    })

    it('maps loopback hosts to the default tenant', () => {
        expect(resolveTenantHost('localhost')).toBe(FALLBACK_HOST)
        expect(resolveTenantHost(null)).toBe(FALLBACK_HOST)
    })

    it('rejects malformed hosts instead of falling back', () => {
        expect(() => resolveTenantHost('../evil')).toThrow('Invalid tenant host')
    })
})

describe('getClientTenantHost', () => {
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

    it('falls back when window is unavailable during SSR', () => {
        expect(getClientTenantHost()).toBe(FALLBACK_HOST)
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
