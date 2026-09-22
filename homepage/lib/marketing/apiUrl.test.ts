import {afterEach, describe, expect, it, vi} from 'vitest'

import {resolveApiBaseUrl} from './apiUrl'

afterEach(() => {
    vi.unstubAllEnvs()
})

describe('resolveApiBaseUrl', () => {
    it('trims a configured URL before removing its trailing slash', () => {
        vi.stubEnv('NEXT_PUBLIC_API_URL', '  https://api.example.test/  ')

        expect(resolveApiBaseUrl()).toBe('https://api.example.test')
    })

    it('uses the development fallback for blank configuration', () => {
        vi.stubEnv('NODE_ENV', 'development')
        vi.stubEnv('NEXT_PUBLIC_API_URL', '   ')

        expect(resolveApiBaseUrl()).toBe('http://localhost:8080')
    })

    it('rejects blank configuration in production', () => {
        vi.stubEnv('NODE_ENV', 'production')
        vi.stubEnv('NEXT_PUBLIC_API_URL', '\t')

        expect(() => resolveApiBaseUrl()).toThrow(/must be set/)
    })
})
