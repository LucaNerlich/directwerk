import 'server-only'

import {cache} from 'react'

import {directwerkFetch} from '@/lib/server/api'
import {extractApiErrorCode} from '@directwerk/api/envelope'
import {createWebPublicParsers} from '@/lib/publicContent/parsers'
import {
    parsePublicNewsletterListEnvelope,
    parsePublicNewsletterListListEnvelope,
    parsePublicProductListEnvelope,
} from '@directwerk/api/validation/public'
import {parseLevelListEnvelope} from '@directwerk/api/validation'
import type {
    LevelSummary,
    PublicArticle,
    PublicEpisode,
    PublicNewsletterList,
    PublicProduct,
} from '@directwerk/api/types'
import {
    cachePublicBffByHost,
    cachePublicBffByHostSlug,
} from '@/lib/site/publicBffCache'

const {
    parsePublicArticleEnvelope,
    parsePublicArticleListEnvelope,
    parsePublicEpisodeEnvelope,
    parsePublicEpisodeListEnvelope,
} = createWebPublicParsers()

async function loadPublicEpisodeList(host: string): Promise<PublicEpisode[]> {
    const response = await directwerkFetch({
        path: '/api/v1/public/episodes',
        tenantHost: host,
        method: 'GET',
    })
    if (!response.ok) {
        throw new Error(`public episodes request failed (HTTP ${response.status})`)
    }
    const parsed = parsePublicEpisodeListEnvelope(await response.json())
    if (parsed === null) {
        throw new Error(`public episodes response invalid for host ${host}`)
    }
    return parsed.data
}

/**
 * Lists the public episode catalog for server-rendered pages. Returns `null`
 * when the upstream call fails so the caller can fall back to a client fetch
 * instead of rendering a false empty state.
 * Cached across requests per host (#856 / #857). Failures are not cached.
 */
export async function fetchPublicEpisodesServer(
    host: string,
): Promise<PublicEpisode[] | null> {
    try {
        return await cachePublicBffByHost('episodes', host, () =>
            loadPublicEpisodeList(host),
        )
    } catch {
        return null
    }
}

async function loadPublicArticleList(host: string): Promise<PublicArticle[]> {
    const response = await directwerkFetch({
        path: '/api/v1/public/articles',
        tenantHost: host,
        method: 'GET',
    })
    if (!response.ok) {
        throw new Error(`public articles request failed (HTTP ${response.status})`)
    }
    const parsed = parsePublicArticleListEnvelope(await response.json())
    if (parsed === null) {
        throw new Error(`public articles response invalid for host ${host}`)
    }
    return parsed.data
}

/**
 * Lists the public article catalog for server-rendered pages. Returns `null`
 * on upstream failure (see {@link fetchPublicEpisodesServer}).
 */
export async function fetchPublicArticlesServer(
    host: string,
): Promise<PublicArticle[] | null> {
    try {
        return await cachePublicBffByHost('articles', host, () =>
            loadPublicArticleList(host),
        )
    } catch {
        return null
    }
}

/**
 * Lists published subscription products for server-rendered pages. Returns
 * `null` on upstream failure (see {@link fetchPublicEpisodesServer}).
 */
export async function fetchPublicProductsServer(
    host: string,
): Promise<PublicProduct[] | null> {
    try {
        return await cachePublicBffByHost('products', host, async () => {
            const response = await directwerkFetch({
                path: '/api/v1/public/products',
                tenantHost: host,
                method: 'GET',
            })
            if (!response.ok) {
                throw new Error(
                    `public products request failed (HTTP ${response.status})`,
                )
            }
            const parsed = parsePublicProductListEnvelope(await response.json())
            if (parsed === null) {
                throw new Error(`public products response invalid for host ${host}`)
            }
            return parsed.data
        })
    } catch {
        return null
    }
}

/**
 * Lists public membership levels for server-rendered pricing. Returns `null`
 * on upstream failure.
 */
export async function fetchPublicLevelsServer(
    host: string,
): Promise<LevelSummary[] | null> {
    try {
        return await cachePublicBffByHost('levels', host, async () => {
            const response = await directwerkFetch({
                path: '/api/v1/public/levels',
                tenantHost: host,
                method: 'GET',
            })
            if (!response.ok) {
                throw new Error(
                    `public levels request failed (HTTP ${response.status})`,
                )
            }
            const parsed = parseLevelListEnvelope(await response.json())
            if (parsed === null) {
                throw new Error(`public levels response invalid for host ${host}`)
            }
            return parsed.data
        })
    } catch {
        return null
    }
}

/**
 * Fetches a single public article server-side. Returns `null` when the
 * backend answers 404 (unknown slug); throws for other failures so the route
 * can render its error boundary.
 */
// generateMetadata and the page body each call this for the same slug, and every
// upstream GET records a view — React's request-scoped cache collapses them to one
// (the node:http transport is not memoized by Next's fetch cache).
export const fetchPublicArticleServer = cache(async (
    host: string,
    slug: string,
): Promise<PublicArticle | null> => {
    // Do not cross-request-cache by-slug article GETs: each upstream hit records
    // a public article-view analytics event (#863 review).
    const response = await directwerkFetch({
        path: `/api/v1/public/articles/${encodeURIComponent(slug)}`,
        tenantHost: host,
        method: 'GET',
    })

    if (response.status === 404) {
        return null
    }
    if (!response.ok) {
        throw new Error(
            `public article request failed (HTTP ${response.status}) for host ${host}`,
        )
    }

    const parsed = parsePublicArticleEnvelope(await response.json())
    if (parsed === null) {
        throw new Error(`public article response invalid for host ${host}`)
    }

    return parsed.data
})

/**
 * Fetches a single public episode by slug (`GET /api/v1/public/episodes/{slug}`).
 * Returns `null` when the slug is unknown / unpublished / series unpublished;
 * throws for transport/validation failures. PAID published episodes return
 * metadata with `audioCdnUrl: null` (not null overall).
 * Cached across requests per host+slug (#856); no public-view analytics side effect.
 */
export const fetchPublicEpisodeServer = cache(async (
    host: string,
    slug: string,
): Promise<PublicEpisode | null> => {
    return cachePublicBffByHostSlug('episode', host, slug, async () => {
        const response = await directwerkFetch({
            path: `/api/v1/public/episodes/${encodeURIComponent(slug)}`,
            tenantHost: host,
            method: 'GET',
        })

        if (response.status === 404) {
            return null
        }
        if (!response.ok) {
            throw new Error(
                `public episode request failed (HTTP ${response.status}) for host ${host}`,
            )
        }

        const parsed = parsePublicEpisodeEnvelope(await response.json())
        if (parsed === null) {
            throw new Error(`public episode response invalid for host ${host}`)
        }

        return parsed.data
    })
})

/**
 * Lists public article slugs and titles for sitemap generation. Returns an
 * empty list on failure — a sitemap must degrade gracefully.
 */
export async function fetchPublicArticleSlugsServer(
    host: string,
): Promise<{slug: string; publishedAt: string | null}[]> {
    const list = await fetchPublicArticlesServer(host)
    if (list === null) {
        return []
    }
    return list.map((article) => ({
        slug: article.slug,
        publishedAt: article.publishedAt,
    }))
}

/**
 * Lists public episode slugs for sitemap generation. Returns an empty list on
 * failure — a sitemap must degrade gracefully.
 */
export async function fetchPublicEpisodeSlugsServer(
    host: string,
): Promise<{slug: string; publishedAt: string | null}[]> {
    const list = await fetchPublicEpisodesServer(host)
    if (list === null) {
        return []
    }
    return list.map((episode) => ({
        slug: episode.slug,
        publishedAt: episode.publishedAt,
    }))
}

/**
 * Fetches a single public newsletter list by slug. Returns `null` only when the
 * list is missing/archived. Other failures (including undeployed routes) throw
 * so the client can fall back to the share-link subscribe form.
 */
export const fetchPublicNewsletterListServer = cache(async (
    host: string,
    slug: string,
): Promise<PublicNewsletterList | null> => {
    return cachePublicBffByHostSlug('newsletter-list', host, slug, async () => {
        const response = await directwerkFetch({
            path: `/api/v1/public/newsletter-lists/${encodeURIComponent(slug)}`,
            tenantHost: host,
            method: 'GET',
        })

        if (response.status === 404) {
            const body: unknown = await response.json().catch(() => null)
            if (extractApiErrorCode(body) === 'NEWSLETTER_LIST_NOT_FOUND') {
                return null
            }
            throw new Error(
                `public newsletter list request failed (HTTP ${response.status}) for host ${host}`,
            )
        }
        if (!response.ok) {
            throw new Error(
                `public newsletter list request failed (HTTP ${response.status}) for host ${host}`,
            )
        }

        const parsed = parsePublicNewsletterListEnvelope(await response.json())
        if (parsed === null) {
            throw new Error(`public newsletter list response invalid for host ${host}`)
        }

        return parsed.data
    })
})

/**
 * Lists active public newsletter lists. Throws on upstream failure so the page
 * can fall back to a client fetch instead of showing a false empty catalog.
 */
export async function fetchPublicNewsletterListsServer(
    host: string,
): Promise<PublicNewsletterList[]> {
    return cachePublicBffByHost('newsletter-lists', host, async () => {
        const response = await directwerkFetch({
            path: '/api/v1/public/newsletter-lists',
            tenantHost: host,
            method: 'GET',
        })
        if (!response.ok) {
            throw new Error(
                `public newsletter lists request failed (HTTP ${response.status}) for host ${host}`,
            )
        }

        const parsed = parsePublicNewsletterListListEnvelope(await response.json())
        if (parsed === null) {
            throw new Error(`public newsletter lists response invalid for host ${host}`)
        }

        return parsed.data
    })
}
