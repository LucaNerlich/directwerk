import {afterEach, describe, expect, it, vi} from 'vitest'

import {testDictionary} from '@/lib/i18n/testDictionary'

import {
    clearSearchDocumentCache,
    loadSearchDocuments,
    rankSearchHits,
    searchHitLocked,
    searchUserKey,
    staticSearchPages,
    type SearchDocument,
} from './headerSearch'

const freeDoc: SearchDocument = {
    kind: 'article',
    title: 'Offener Text',
    slug: 'offen',
    excerpt: 'Offen',
    plainText: 'Offener Text mit mehr Worten',
    hrefPath: '/articles/offen',
    access: 'FREE',
}

const paidDoc: SearchDocument = {
    kind: 'article',
    title: 'Geheimes Essay',
    slug: 'geheim',
    excerpt: 'Teaser',
    plainText: '',
    hrefPath: '/articles/geheim',
    access: 'PAID',
}

function jsonResponse(data: unknown): Response {
    return new Response(JSON.stringify({data}), {
        status: 200,
        headers: {'content-type': 'application/json'},
    })
}

function token(sub: string): string {
    const payload = btoa(JSON.stringify({sub}))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '')
    return `header.${payload}.sig`
}

afterEach(() => {
    clearSearchDocumentCache()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
})

describe('searchUserKey', () => {
    it('uses guest without a token and the subject when one is present', () => {
        expect(searchUserKey(null)).toBe('guest')
        expect(searchUserKey(token('user-7'))).toBe('user-7')
        expect(searchUserKey('not-a-jwt')).toBe('session')
    })
})

describe('searchHitLocked', () => {
    it('locks a paid row whose body was withheld', () => {
        expect(searchHitLocked(paidDoc)).toBe(true)
        expect(searchHitLocked({...paidDoc, plainText: 'full body'})).toBe(false)
        expect(searchHitLocked(freeDoc)).toBe(false)
    })
})

describe('staticSearchPages', () => {
    it('lists home, pricing, imprint, and privacy', () => {
        expect(staticSearchPages(testDictionary).map((page) => page.hrefPath)).toEqual([
            '/',
            '/pricing',
            '/imprint',
            '/privacy',
        ])
    })
})

describe('rankSearchHits', () => {
    it('returns nothing for a blank query and ranks a typo', () => {
        const pages = staticSearchPages(testDictionary)
        expect(rankSearchHits(pages, '   ')).toEqual([])
        expect(rankSearchHits(pages, 'impressm')[0]?.slug).toBe('imprint')
    })
})

describe('loadSearchDocuments', () => {
    it('reuses the feed for one host and user inside the ttl', async () => {
        const fetchMock = vi.fn(async () => jsonResponse([freeDoc]))
        vi.stubGlobal('fetch', fetchMock)
        let now = 1_000
        vi.spyOn(Date, 'now').mockImplementation(() => now)

        await loadSearchDocuments(false, 'guest')
        await loadSearchDocuments(false, 'guest')
        expect(fetchMock).toHaveBeenCalledTimes(1)

        await loadSearchDocuments(false, 'user-7')
        expect(fetchMock).toHaveBeenCalledTimes(2)

        now += 61_000
        await loadSearchDocuments(false, 'user-7')
        expect(fetchMock).toHaveBeenCalledTimes(3)
    })

    it('drops the cache when login or logout clears it', async () => {
        const fetchMock = vi.fn(async () => jsonResponse([freeDoc]))
        vi.stubGlobal('fetch', fetchMock)

        await loadSearchDocuments(false, 'guest')
        clearSearchDocumentCache()
        await loadSearchDocuments(false, 'guest')
        expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('rejects a payload that is not the document list', async () => {
        vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ok: true})))
        await expect(loadSearchDocuments(false, 'guest')).rejects.toThrow(/invalid search documents/)
    })
})
