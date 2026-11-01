import {fuzzyRank} from '@directwerk/ui/lib/fuzzy'

import {authenticatedRequest, jsonRequest} from '@/lib/api/transport'
import type {Dictionary} from '@/lib/i18n/dictionary'
import {getWebClientTenantHost} from '@/lib/tenant/clientHost'

export const SEARCH_CACHE_TTL_MS = 60_000

export interface SearchDocument {
    kind: 'article' | 'episode' | 'newsletter_list' | 'product'
    title: string
    slug: string
    excerpt: string
    plainText: string
    hrefPath: string
    access: 'FREE' | 'PAID'
}

export interface SearchCorpusItem {
    kind: SearchDocument['kind'] | 'page'
    title: string
    slug: string
    excerpt: string
    plainText: string
    hrefPath: string
    access: 'FREE' | 'PAID'
}

const KINDS = new Set<SearchDocument['kind']>([
    'article',
    'episode',
    'newsletter_list',
    'product',
])

interface CacheEntry {
    host: string
    userKey: string
    at: number
    documents: SearchDocument[]
}

let cache: CacheEntry | null = null
let loadSeq = 0

export function clearSearchDocumentCache(): void {
    cache = null
    loadSeq += 1
}

/** Guest, or the JWT `sub`, so two members never share one feed. */
export function searchUserKey(accessToken: string | null): string {
    if (accessToken === null || accessToken.length === 0) {
        return 'guest'
    }
    const part = accessToken.split('.')[1]
    if (part === undefined) {
        return 'session'
    }
    try {
        const json = JSON.parse(decodeBase64Url(part)) as {sub?: unknown}
        if (typeof json.sub === 'string' && json.sub.length > 0) {
            return json.sub
        }
    } catch {
        return 'session'
    }
    return 'session'
}

export function searchHitLocked(hit: {access: string; plainText: string}): boolean {
    return hit.access === 'PAID' && hit.plainText.length === 0
}

export function staticSearchPages(dictionary: Dictionary): SearchCorpusItem[] {
    return [
        page(dictionary.nav.home, 'home', '/'),
        page(dictionary.nav.pricing, 'pricing', '/pricing'),
        page(dictionary.nav.imprint, 'imprint', '/imprint'),
        page(dictionary.nav.privacy, 'privacy', '/privacy'),
    ]
}

export function rankSearchHits(
    items: readonly SearchCorpusItem[],
    query: string,
): SearchCorpusItem[] {
    return fuzzyRank(items, query, {
        keys: ['title', 'slug', 'excerpt', 'plainText'],
    })
}

export async function loadSearchDocuments(
    authed: boolean,
    userKey: string,
): Promise<SearchDocument[]> {
    const host = getWebClientTenantHost()
    const now = Date.now()
    if (
        cache !== null &&
        cache.host === host &&
        cache.userKey === userKey &&
        now - cache.at < SEARCH_CACHE_TTL_MS
    ) {
        return cache.documents
    }

    const seq = ++loadSeq
    const payload = authed
        ? await authenticatedRequest('/api/proxy/public/search-documents', host)
        : await jsonRequest('/api/proxy/public/search-documents')
    const documents = parseSearchDocuments(payload)
    if (seq === loadSeq) {
        cache = {host, userKey, at: Date.now(), documents}
    }
    return documents
}

function page(title: string, slug: string, hrefPath: string): SearchCorpusItem {
    return {
        kind: 'page',
        title,
        slug,
        excerpt: title,
        plainText: title,
        hrefPath,
        access: 'FREE',
    }
}

function parseSearchDocuments(payload: unknown): SearchDocument[] {
    if (typeof payload !== 'object' || payload === null || !('data' in payload)) {
        throw new Error('invalid search documents')
    }
    const data = (payload as {data: unknown}).data
    if (!Array.isArray(data)) {
        throw new Error('invalid search documents')
    }
    return data.map(parseSearchDocument)
}

function parseSearchDocument(value: unknown): SearchDocument {
    if (typeof value !== 'object' || value === null) {
        throw new Error('invalid search documents')
    }
    const row = value as Record<string, unknown>
    const kind = row.kind
    const access = row.access
    if (
        typeof kind !== 'string' ||
        !KINDS.has(kind as SearchDocument['kind']) ||
        (access !== 'FREE' && access !== 'PAID') ||
        typeof row.title !== 'string' ||
        typeof row.slug !== 'string' ||
        typeof row.excerpt !== 'string' ||
        typeof row.plainText !== 'string' ||
        typeof row.hrefPath !== 'string' ||
        !row.hrefPath.startsWith('/') ||
        row.hrefPath.startsWith('//')
    ) {
        throw new Error('invalid search documents')
    }
    return {
        kind: kind as SearchDocument['kind'],
        title: row.title,
        slug: row.slug,
        excerpt: row.excerpt,
        plainText: row.plainText,
        hrefPath: row.hrefPath,
        access,
    }
}

function decodeBase64Url(value: string): string {
    const padded = value.replace(/-/g, '+').replace(/_/g, '/')
    const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4))
    return atob(padded + pad)
}
