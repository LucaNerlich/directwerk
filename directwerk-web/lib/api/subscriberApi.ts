'use client'

import {parseMeEnvelope} from '@directwerk/api/validation/catalog'
import {parseAccessEnvelope, parseFeedPreviewEnvelope, parseSubscriberDownloadListEnvelope, parseSubscriberFeedEnvelope, parseSubscriberFeedListEnvelope, parseArticleFeedEnvelope, parseArticleFeedListEnvelope, parseArticleFeedPreviewEnvelope, parseNotificationPreferencesEnvelope} from '@directwerk/api/validation/public'

import type {
    Access,
    ApiEnvelope,
    ArticleFeedPreview,
    ArticleFeedView,
    FeedPreview,
    Me,
    PublicArticle,
    PublicEpisode,
    SubscriberDownload,
    SubscriberFeedView,
} from '@directwerk/api/types'
import {createWebPublicParsers} from '@/lib/publicContent/parsers'
import {authedFetch, envelopeResult, jsonInit} from './transport'

const publicParsers = createWebPublicParsers()
const parsePublicEpisodeListEnvelope = publicParsers.parsePublicEpisodeListEnvelope

export async function getMe(tenantHost: string): Promise<ApiEnvelope<Me>> {
    return envelopeResult(
        parseMeEnvelope,
        await authedFetch('/api/proxy/me'),
        'The server returned an invalid account response.',
    )
}

export async function getAccess(
    tenantHost: string,
): Promise<ApiEnvelope<Access>> {
    return envelopeResult(
        parseAccessEnvelope,
        await authedFetch('/api/proxy/me/access'),
        'The server returned an invalid access response.',
    )
}

export async function listMyEpisodes(
    tenantHost: string,
): Promise<PublicEpisode[]> {
    return envelopeResult(
        parsePublicEpisodeListEnvelope,
        await authedFetch('/api/proxy/me/episodes'),
        'The server returned an invalid episode list.',
    ).data
}

export async function listMyArticles(
    tenantHost: string,
): Promise<PublicArticle[]> {
    return envelopeResult(
        publicParsers.parsePublicArticleListEnvelope,
        await authedFetch('/api/proxy/me/articles'),
        'The server returned an invalid article list.',
    ).data
}

/** Private subscriber RSS feeds the signed-in user can use in a podcast app. */
export async function listMyFeeds(
    tenantHost: string,
): Promise<SubscriberFeedView[]> {
    return envelopeResult(
        parseSubscriberFeedListEnvelope,
        await authedFetch('/api/proxy/me/feeds'),
        'The server returned an invalid feed list.',
    ).data
}

export async function rotateDefaultFeedToken(
    tenantHost: string,
): Promise<SubscriberFeedView> {
    return envelopeResult(
        parseSubscriberFeedEnvelope,
        await authedFetch('/api/proxy/me/feeds/default/rotate-token', jsonInit('POST', {})),
        'Der Server hat eine ungültige Feed-Antwort geliefert.',
    ).data
}

export async function setDefaultFeedEnabled(
    tenantHost: string,
    enabled: boolean,
): Promise<SubscriberFeedView> {
    return envelopeResult(
        parseSubscriberFeedEnvelope,
        await authedFetch(
            '/api/proxy/me/feeds/default/enabled',
            jsonInit('PUT', {enabled}),
        ),
        'Der Server hat eine ungültige Feed-Antwort geliefert.',
    ).data
}

export async function createCustomFeed(
    tenantHost: string,
    title: string,
    formatIds: number[],
): Promise<SubscriberFeedView> {
    return envelopeResult(
        parseSubscriberFeedEnvelope,
        await authedFetch('/api/proxy/me/feeds', jsonInit('POST', {title, formatIds})),
        'Der Server hat eine ungültige Feed-Antwort geliefert.',
    ).data
}

export async function updateCustomFeed(
    tenantHost: string,
    feedId: number,
    title: string,
    formatIds: number[],
): Promise<SubscriberFeedView> {
    return envelopeResult(
        parseSubscriberFeedEnvelope,
        await authedFetch(
            `/api/proxy/me/feeds/${feedId}`,
            jsonInit('PUT', {title, formatIds}),
        ),
        'Der Server hat eine ungültige Feed-Antwort geliefert.',
    ).data
}

export async function previewCustomFeed(
    tenantHost: string,
    formatIds: number[],
): Promise<FeedPreview> {
    const params = new URLSearchParams()
    for (const formatId of formatIds) {
        params.append('formatIds', String(formatId))
    }
    return envelopeResult(
        parseFeedPreviewEnvelope,
        await authedFetch(`/api/proxy/me/feeds/preview?${params.toString()}`),
        'Der Server hat eine ungültige Vorschau geliefert.',
    ).data
}

export async function setFeedEnabled(
    tenantHost: string,
    feedId: number,
    enabled: boolean,
): Promise<SubscriberFeedView> {
    return envelopeResult(
        parseSubscriberFeedEnvelope,
        await authedFetch(
            `/api/proxy/me/feeds/${feedId}/enabled`,
            jsonInit('PUT', {enabled}),
        ),
        'Der Server hat eine ungültige Feed-Antwort geliefert.',
    ).data
}

export async function rotateFeedToken(
    tenantHost: string,
    feedId: number,
): Promise<SubscriberFeedView> {
    return envelopeResult(
        parseSubscriberFeedEnvelope,
        await authedFetch(
            `/api/proxy/me/feeds/${feedId}/rotate-token`,
            jsonInit('POST', {}),
        ),
        'Der Server hat eine ungültige Feed-Antwort geliefert.',
    ).data
}

export async function deleteCustomFeed(
    tenantHost: string,
    feedId: number,
): Promise<void> {
    await authedFetch(`/api/proxy/me/feeds/${feedId}`, {method: 'DELETE'})
}

/** Private subscriber article RSS feeds the signed-in user can use in a feed reader. */
export async function listMyArticleFeeds(
    tenantHost: string,
): Promise<ArticleFeedView[]> {
    return envelopeResult(
        parseArticleFeedListEnvelope,
        await authedFetch('/api/proxy/me/article-feeds'),
        'The server returned an invalid feed list.',
    ).data
}

export async function rotateDefaultArticleFeedToken(
    tenantHost: string,
): Promise<ArticleFeedView> {
    return envelopeResult(
        parseArticleFeedEnvelope,
        await authedFetch('/api/proxy/me/article-feeds/default/rotate-token', jsonInit('POST', {})),
        'Der Server hat eine ungültige Feed-Antwort geliefert.',
    ).data
}

export async function setDefaultArticleFeedEnabled(
    tenantHost: string,
    enabled: boolean,
): Promise<ArticleFeedView> {
    return envelopeResult(
        parseArticleFeedEnvelope,
        await authedFetch(
            '/api/proxy/me/article-feeds/default/enabled',
            jsonInit('PUT', {enabled}),
        ),
        'Der Server hat eine ungültige Feed-Antwort geliefert.',
    ).data
}

export async function createCustomArticleFeed(
    tenantHost: string,
    title: string,
    categoryIds: number[],
): Promise<ArticleFeedView> {
    return envelopeResult(
        parseArticleFeedEnvelope,
        await authedFetch('/api/proxy/me/article-feeds', jsonInit('POST', {title, categoryIds})),
        'Der Server hat eine ungültige Feed-Antwort geliefert.',
    ).data
}

export async function updateCustomArticleFeed(
    tenantHost: string,
    feedId: number,
    title: string,
    categoryIds: number[],
): Promise<ArticleFeedView> {
    return envelopeResult(
        parseArticleFeedEnvelope,
        await authedFetch(
            `/api/proxy/me/article-feeds/${feedId}`,
            jsonInit('PUT', {title, categoryIds}),
        ),
        'Der Server hat eine ungültige Feed-Antwort geliefert.',
    ).data
}

export async function previewCustomArticleFeed(
    tenantHost: string,
    categoryIds: number[],
): Promise<ArticleFeedPreview> {
    const params = new URLSearchParams()
    for (const categoryId of categoryIds) {
        params.append('categoryIds', String(categoryId))
    }
    return envelopeResult(
        parseArticleFeedPreviewEnvelope,
        await authedFetch(`/api/proxy/me/article-feeds/preview?${params.toString()}`),
        'Der Server hat eine ungültige Vorschau geliefert.',
    ).data
}

export async function setArticleFeedEnabledForUser(
    tenantHost: string,
    feedId: number,
    enabled: boolean,
): Promise<ArticleFeedView> {
    return envelopeResult(
        parseArticleFeedEnvelope,
        await authedFetch(
            `/api/proxy/me/article-feeds/${feedId}/enabled`,
            jsonInit('PUT', {enabled}),
        ),
        'Der Server hat eine ungültige Feed-Antwort geliefert.',
    ).data
}

export async function rotateArticleFeedToken(
    tenantHost: string,
    feedId: number,
): Promise<ArticleFeedView> {
    return envelopeResult(
        parseArticleFeedEnvelope,
        await authedFetch(
            `/api/proxy/me/article-feeds/${feedId}/rotate-token`,
            jsonInit('POST', {}),
        ),
        'Der Server hat eine ungültige Feed-Antwort geliefert.',
    ).data
}

export async function deleteCustomArticleFeed(
    tenantHost: string,
    feedId: number,
): Promise<void> {
    await authedFetch(`/api/proxy/me/article-feeds/${feedId}`, {method: 'DELETE'})
}

export async function getNotificationPreferences(
    tenantHost: string,
): Promise<{emailNotificationsEnabled: boolean; emailNotifyAvailable: boolean}> {
    const prefs = parseNotificationPreferencesEnvelope(
        await authedFetch('/api/proxy/me/notification-preferences'),
    )
    if (prefs === null) {
        throw new Error('The server returned invalid notification preferences.')
    }

    return prefs
}

export async function updateNotificationPreferences(
    tenantHost: string,
    emailNotificationsEnabled: boolean,
): Promise<{emailNotificationsEnabled: boolean; emailNotifyAvailable: boolean}> {
    const prefs = parseNotificationPreferencesEnvelope(
        await authedFetch(
            '/api/proxy/me/notification-preferences',
            jsonInit('PATCH', {emailNotificationsEnabled}),
        ),
    )
    if (prefs === null) {
        throw new Error('The server returned invalid notification preferences.')
    }

    return prefs
}

export async function listMyDownloads(
    tenantHost: string,
): Promise<SubscriberDownload[]> {
    return envelopeResult(
        parseSubscriberDownloadListEnvelope,
        await authedFetch('/api/proxy/me/downloads'),
        'Der Server hat eine ungültige Download-Liste geliefert.',
    ).data
}
