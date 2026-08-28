'use client'

import {sanitizeContentHtml} from '@/lib/sanitizeContentHtml'
import {
    createPublicContentParsers,
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
import {
    authenticatedRequest,
    envelopeResult,
} from './transport'

const publicParsers = createPublicContentParsers({
    sanitizeHtml: sanitizeContentHtml,
})
const parsePublicEpisodeListEnvelope = publicParsers.parsePublicEpisodeListEnvelope

export async function getMe(tenantHost: string): Promise<ApiEnvelope<Me>> {
    return envelopeResult(
        parseMeEnvelope,
        await authenticatedRequest('/api/proxy/me', tenantHost),
        'The server returned an invalid account response.',
    )
}

export async function getAccess(
    tenantHost: string,
): Promise<ApiEnvelope<Access>> {
    return envelopeResult(
        parseAccessEnvelope,
        await authenticatedRequest('/api/proxy/me/access', tenantHost),
        'The server returned an invalid access response.',
    )
}

export async function listMyEpisodes(
    tenantHost: string,
): Promise<PublicEpisode[]> {
    return envelopeResult(
        parsePublicEpisodeListEnvelope,
        await authenticatedRequest('/api/proxy/me/episodes', tenantHost),
        'The server returned an invalid episode list.',
    ).data
}

/** Private subscriber RSS feeds the signed-in user can use in a podcast app. */
export async function listMyFeeds(
    tenantHost: string,
): Promise<SubscriberFeedView[]> {
    return envelopeResult(
        parseSubscriberFeedListEnvelope,
        await authenticatedRequest('/api/proxy/me/feeds', tenantHost),
        'The server returned an invalid feed list.',
    ).data
}

export async function rotateDefaultFeedToken(
    tenantHost: string,
): Promise<SubscriberFeedView> {
    return envelopeResult(
        parseSubscriberFeedEnvelope,
        await authenticatedRequest('/api/proxy/me/feeds/default/rotate-token', tenantHost, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({}),
        }),
        'Der Server hat eine ungültige Feed-Antwort geliefert.',
    ).data
}

export async function setDefaultFeedEnabled(
    tenantHost: string,
    enabled: boolean,
): Promise<SubscriberFeedView> {
    return envelopeResult(
        parseSubscriberFeedEnvelope,
        await authenticatedRequest('/api/proxy/me/feeds/default/enabled', tenantHost, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({enabled}),
        }),
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
        await authenticatedRequest('/api/proxy/me/feeds', tenantHost, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({title, formatIds}),
        }),
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
        await authenticatedRequest(`/api/proxy/me/feeds/${feedId}`, tenantHost, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({title, formatIds}),
        }),
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
        await authenticatedRequest(
            `/api/proxy/me/feeds/preview?${params.toString()}`,
            tenantHost,
        ),
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
        await authenticatedRequest(`/api/proxy/me/feeds/${feedId}/enabled`, tenantHost, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({enabled}),
        }),
        'Der Server hat eine ungültige Feed-Antwort geliefert.',
    ).data
}

export async function rotateFeedToken(
    tenantHost: string,
    feedId: number,
): Promise<SubscriberFeedView> {
    return envelopeResult(
        parseSubscriberFeedEnvelope,
        await authenticatedRequest(`/api/proxy/me/feeds/${feedId}/rotate-token`, tenantHost, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({}),
        }),
        'Der Server hat eine ungültige Feed-Antwort geliefert.',
    ).data
}

export async function deleteCustomFeed(
    tenantHost: string,
    feedId: number,
): Promise<void> {
    await authenticatedRequest(`/api/proxy/me/feeds/${feedId}`, tenantHost, {
        method: 'DELETE',
    })
}
export async function getNotificationPreferences(
    tenantHost: string,
): Promise<{emailNotificationsEnabled: boolean}> {
    const prefs = parseNotificationPreferencesEnvelope(
        await authenticatedRequest(
            '/api/proxy/me/notification-preferences',
            tenantHost,
        ),
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
        await authenticatedRequest(
            '/api/proxy/me/notification-preferences',
            tenantHost,
            {
                method: 'PATCH',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({emailNotificationsEnabled}),
            },
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
        await authenticatedRequest('/api/proxy/me/downloads', tenantHost),
        'Der Server hat eine ungültige Download-Liste geliefert.',
    ).data
}
