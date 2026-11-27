import {afterEach, describe, expect, it, vi} from 'vitest'

import {resolveMcpUrl} from './mcpUrl'

afterEach(() => {
    vi.unstubAllEnvs()
})

describe('resolveMcpUrl', () => {
    it('uses the public API origin, never the internal upstream', () => {
        vi.stubEnv('NEXT_PUBLIC_API_URL', 'https://api.example.test/')
        vi.stubEnv('DIRECTWERK_API_URL', 'http://directwerk:8080')

        expect(resolveMcpUrl()).toBe('https://api.example.test/mcp')
    })

    it('renders an empty endpoint instead of a placeholder when unset', () => {
        vi.stubEnv('NEXT_PUBLIC_API_URL', '')
        vi.stubEnv('DIRECTWERK_API_URL', 'http://directwerk:8080')

        expect(resolveMcpUrl()).toBe('')
    })
})
