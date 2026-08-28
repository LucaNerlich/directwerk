'use client'

import {
    parseMeEnvelope,
    parseAccessEnvelope,
    parseFeedPreviewEnvelope,
    parseSubscriberDownloadListEnvelope,
    parseSubscriberFeedEnvelope,
    parseSubscriberFeedListEnvelope,
    parseNotificationPreferencesEnvelope,
} from '@directwerk/api/validation'
import type {
    Access,
    ApiEnvelope,
    FeedPreview,
    Me,
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

export async function getNotificationPreferences(
    tenantHost: string,
): Promise<{emailNotificationsEnabled: boolean}> {
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
): Promise<{emailNotificationsEnabled: boolean}> {
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
