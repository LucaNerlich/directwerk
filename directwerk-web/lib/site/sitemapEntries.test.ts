import {describe, expect, it} from 'vitest'

import {localizedSitemapEntry} from './sitemapEntries'

describe('localizedSitemapEntry', () => {
    it('emits one entry with de, en, and x-default hreflang URLs', () => {
        const entry = localizedSitemapEntry('https://tenant.example', '/pricing')

        expect(entry.url).toBe('https://tenant.example/de/pricing')
        expect(entry.alternates?.languages).toEqual({
            de: 'https://tenant.example/de/pricing',
            en: 'https://tenant.example/en/pricing',
            'x-default': 'https://tenant.example/de/pricing',
        })
    })

    it('uses the bare locale path for the home page', () => {
        const entry = localizedSitemapEntry('https://tenant.example', '')

        expect(entry.url).toBe('https://tenant.example/de')
        expect(entry.alternates?.languages).toEqual({
            de: 'https://tenant.example/de',
            en: 'https://tenant.example/en',
            'x-default': 'https://tenant.example/de',
        })
    })

    it('forwards lastModified when provided', () => {
        const lastModified = new Date('2026-03-01T12:00:00.000Z')
        const entry = localizedSitemapEntry(
            'https://tenant.example',
            '/articles/hello',
            lastModified,
        )

        expect(entry.lastModified).toBe(lastModified)
    })
})
