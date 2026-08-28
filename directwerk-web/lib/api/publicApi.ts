'use client'

import {sanitizeContentHtml} from '@/lib/sanitizeContentHtml'
import {
    createPublicContentParsers,
    parseLevelListEnvelope,
    parsePublicFormatListEnvelope,
    parsePublicProductListEnvelope,
    parsePublicSiteConfigEnvelope,
} from '@directwerk/api/validation'
import type {
    ApiEnvelope,
    LevelSummary,
    PublicArticle,
    PublicEpisode,
    PublicFormat,
    PublicProduct,
    PublicSeries,
    PublicSiteConfig,
} from '@directwerk/api/types'
import {
    envelopeResult,
    request,
} from './transport'

const publicParsers = createPublicContentParsers({
    sanitizeHtml: sanitizeContentHtml,
})
const parsePublicArticleListEnvelope = publicParsers.parsePublicArticleListEnvelope
const parsePublicSeriesListEnvelope = publicParsers.parsePublicSeriesListEnvelope
const parsePublicEpisodeListEnvelope = publicParsers.parsePublicEpisodeListEnvelope

export async function getSiteConfig(
    tenantHost: string,
): Promise<ApiEnvelope<PublicSiteConfig>> {
    return envelopeResult(
        parsePublicSiteConfigEnvelope,
        await request('/api/proxy/public/site-config', tenantHost),
        'The server returned an invalid site configuration.',
    )
}
export async function listPublicArticles(
    tenantHost: string,
): Promise<PublicArticle[]> {
    return envelopeResult(
        parsePublicArticleListEnvelope,
        await request('/api/proxy/public/articles', tenantHost),
        'The server returned an invalid article list.',
    ).data
}

export async function listPublicSeries(
    tenantHost: string,
): Promise<PublicSeries[]> {
    return envelopeResult(
        parsePublicSeriesListEnvelope,
        await request('/api/proxy/public/series', tenantHost),
        'The server returned an invalid series list.',
    ).data
}

export async function listPublicEpisodes(
    tenantHost: string,
): Promise<PublicEpisode[]> {
    return envelopeResult(
        parsePublicEpisodeListEnvelope,
        await request('/api/proxy/public/episodes', tenantHost),
        'The server returned an invalid episode list.',
    ).data
}

export async function listPublicLevels(
    tenantHost: string,
): Promise<LevelSummary[]> {
    return envelopeResult(
        parseLevelListEnvelope,
        await request('/api/proxy/public/levels', tenantHost),
        'The server returned an invalid level list.',
    ).data
}

export async function listPublicFormats(
    tenantHost: string,
): Promise<PublicFormat[]> {
    return envelopeResult(
        parsePublicFormatListEnvelope,
        await request('/api/proxy/public/formats', tenantHost),
        'The server returned an invalid format list.',
    ).data
}
export async function listPublicProducts(
    tenantHost: string,
): Promise<PublicProduct[]> {
    return envelopeResult(
        parsePublicProductListEnvelope,
        await request('/api/proxy/public/products', tenantHost),
        'The server returned an invalid product list.',
    ).data
}
