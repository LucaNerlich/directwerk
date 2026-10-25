import {describe, expect, it} from 'vitest'

import {resolvePersistEpisodeId} from '@/lib/publication/resolvePersistEpisodeId'

describe('resolvePersistEpisodeId (#731 review)', () => {
    it('reuses the deferred create id when the route is still /new', () => {
        expect(resolvePersistEpisodeId(undefined, 42, 42)).toBe(42)
        expect(resolvePersistEpisodeId(undefined, 42, undefined)).toBe(42)
        expect(resolvePersistEpisodeId(undefined, undefined, 42)).toBe(42)
    })

    it('prefers the route id once navigation has completed', () => {
        expect(resolvePersistEpisodeId(7, 42, 42)).toBe(7)
    })

    it('creates only when no id exists yet', () => {
        expect(resolvePersistEpisodeId(undefined, undefined, undefined)).toBeUndefined()
    })
})
