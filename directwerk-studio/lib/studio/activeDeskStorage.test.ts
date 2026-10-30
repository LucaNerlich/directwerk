import {afterEach, describe, expect, it} from 'vitest'

import {
    getLastActiveDesk,
    lastDeskStorageKey,
    setLastActiveDesk,
} from '@/lib/studio/activeDeskStorage'

afterEach(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
})

describe('lastDeskStorageKey', () => {
    it('prefers tenant id over slug', () => {
        expect(lastDeskStorageKey({tenantId: 42, tenantSlug: 'acme'})).toBe(
            'dw.studio.lastDesk:42',
        )
    })

    it('falls back to slug then global', () => {
        expect(lastDeskStorageKey({tenantSlug: 'acme'})).toBe('dw.studio.lastDesk:slug:acme')
        expect(lastDeskStorageKey({})).toBe('dw.studio.lastDesk')
    })
})

describe('activeDeskStorage', () => {
    it('persists and restores a desk under the tenant id key', () => {
        setLastActiveDesk('PODCAST', {tenantId: 7, tenantSlug: 'seven'})
        expect(window.localStorage.getItem('dw.studio.lastDesk:7')).toBe('PODCAST')
        expect(getLastActiveDesk({tenantId: 7, tenantSlug: 'seven'})).toBe('PODCAST')
    })

    it('migrates a slug-scoped value onto the tenant id key', () => {
        setLastActiveDesk('WRITE', {tenantSlug: 'acme'})
        expect(getLastActiveDesk({tenantId: 9, tenantSlug: 'acme'})).toBe('WRITE')
        expect(window.localStorage.getItem('dw.studio.lastDesk:9')).toBe('WRITE')
    })

    it('migrates legacy sessionStorage into localStorage', () => {
        window.sessionStorage.setItem('directwerk-studio:last-desk', 'PODCAST')
        expect(getLastActiveDesk({tenantId: 3, tenantSlug: 't'})).toBe('PODCAST')
        expect(window.localStorage.getItem('dw.studio.lastDesk:3')).toBe('PODCAST')
        expect(window.sessionStorage.getItem('directwerk-studio:last-desk')).toBeNull()
    })

    it('ignores invalid stored values', () => {
        window.localStorage.setItem('dw.studio.lastDesk:1', 'NOPE')
        expect(getLastActiveDesk({tenantId: 1})).toBeNull()
    })
})
