import {createAuthedRequest} from '@directwerk/api/client'
import {extractApiErrorMessage} from '@directwerk/api/envelope'
import {
    createPublicContentParsers,
    parseAccessEnvelope,
    parseCheckoutSessionEnvelope,
    parseFeedPreviewEnvelope,
    parseLevelListEnvelope,
    parseMeEnvelope,
    parsePublicCategoryListEnvelope,
    parsePublicFormatListEnvelope,
    parsePublicSiteConfigEnvelope,
    parseSubscriptionListEnvelope,
    parseTokenResponse,
} from '@directwerk/api/validation'
import {
    parseSubscriberDownloadListEnvelope as parseSubscriberDownloadListEnvelopeAlias,
    parseSubscriberFeedEnvelope as parseSubscriberFeedEnvelopeAlias,
    parseSubscriberFeedListEnvelope as parseSubscriberFeedListEnvelopeAlias,
} from '@directwerk/api/validation'
import type {ErrorMessageCatalog} from '@directwerk/api/envelope'
import {sanitizeContentHtml} from '@/lib/sanitizeContentHtml'
import type {
    Access,
    ApiEnvelope,
    FeedPreview,
    LevelSummary,
    Me,
    PublicArticle,
    PublicCategory,
    PublicEpisode,
    PublicFormat,
    PublicSeries,
    PublicSiteConfig,
    SubscriberDownload,
    SubscriberFeedView,
    SubscriptionSummary,
    TokenResponse,
} from '@directwerk/api/types'
import type {
    AcceptInviteInput,
    ForgotPasswordInput,
    LoginInput,
    RegisterInput,
    ResetPasswordInput,
} from '@directwerk/api/validation'
import {clearTokens} from '@/lib/auth/tokenStore'
import {getClientTenantHost} from '@/lib/tenant/getClientTenantHost'
import {getValidAccessToken, refreshAccessToken} from '@/lib/auth/session'

const INVALID_RESPONSE = 'The server returned an invalid response.'

/** Web error-message catalog (English user-facing strings). */
const ERROR_CATALOG: ErrorMessageCatalog = {
    fallback: (status) => `Request failed with status ${status}.`,
}

// Web sanitizes API-supplied HTML through its own policy before rendering;
// the structural guards live in the shared validation tower.
const publicParsers = createPublicContentParsers({
    sanitizeHtml: sanitizeContentHtml,
})
const parsePublicArticleListEnvelope = publicParsers.parsePublicArticleListEnvelope
const parsePublicSeriesListEnvelope = publicParsers.parsePublicSeriesListEnvelope
const parsePublicEpisodeListEnvelope = publicParsers.parsePublicEpisodeListEnvelope

async function parseJsonResponse(response: Response): Promise<unknown> {
    const contentType = response.headers.get('content-type') ?? ''
    if (!contentType.toLowerCase().includes('application/json')) {
        throw new Error(INVALID_RESPONSE)
    }

    return response.json()
}

async function request(
    path: string,
    tenantHost: string | null,
    init?: RequestInit,
): Promise<unknown> {
    const response = await fetch(path, {
        ...init,
        headers: {
            Accept: 'application/json',
            ...(tenantHost === null ? {} : {'X-Tenant-Host': tenantHost}),
            ...init?.headers,
        },
    })
    const value = await parseJsonResponse(response)
    if (!response.ok) {
        throw new Error(extractApiErrorMessage(value, response.status, ERROR_CATALOG))
    }

    return value
}

const authedFetch = createAuthedRequest({
    session: {getValidAccessToken, refreshAccessToken},
    clearTokens,
    baseHeaders: () => ({'X-Tenant-Host': getClientTenantHost()}),
    authFailureMode: 'preserve-transient',
    transientMessage: 'Der Server ist derzeit nicht erreichbar.',
    finalUnauthorized: 'clear-and-auth-required',
    invalidResponseMessage: INVALID_RESPONSE,
    catalog: ERROR_CATALOG,
})

function authenticatedRequest(
    path: string,
    _tenantHost: string,
    init?: RequestInit,
): Promise<unknown> {
    return authedFetch(path, init)
}

async function postJson(
    path: string,
    tenantHost: string | null,
    body: unknown,
): Promise<unknown> {
    return request(path, tenantHost, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(body),
    })
}

function envelopeResult<T>(
    parser: (value: unknown) => T | null,
    value: unknown,
    invalidMessage: string,
): T {
    const parsed = parser(value)
    if (parsed === null) {
        throw new Error(invalidMessage)
    }

    return parsed
}

export async function register(
    tenantHost: string,
    input: RegisterInput,
): Promise<void> {
    await postJson('/api/auth/register', tenantHost, input)
}

export async function acceptInvite(input: AcceptInviteInput): Promise<void> {
    await postJson('/api/auth/accept-invite', null, input)
}

export async function forgotPassword(
    input: ForgotPasswordInput,
): Promise<{devResetToken: string | null}> {
    const value = await postJson('/api/auth/forgot-password', null, input)

    if (
        typeof value === 'object' &&
        value !== null &&
        'data' in value &&
        typeof value.data === 'object' &&
        value.data !== null &&
        'devResetToken' in value.data &&
        typeof value.data.devResetToken === 'string' &&
        value.data.devResetToken.length > 0 &&
        value.data.devResetToken.length <= 512
    ) {
        return {devResetToken: value.data.devResetToken}
    }

    return {devResetToken: null}
}

export async function resetPassword(input: ResetPasswordInput): Promise<void> {
    await postJson('/api/auth/reset-password', null, input)
}

export async function login(
    tenantHost: string,
    input: LoginInput,
): Promise<TokenResponse> {
    const value = await postJson('/api/auth/login', tenantHost, input)
    const tokens = parseTokenResponse(value)
    if (tokens === null) {
        throw new Error('The server returned an invalid token response.')
    }

    return tokens
}

export async function getSiteConfig(
    tenantHost: string,
): Promise<ApiEnvelope<PublicSiteConfig>> {
    return envelopeResult(
        parsePublicSiteConfigEnvelope,
        await request('/api/proxy/public/site-config', tenantHost),
        'The server returned an invalid site configuration.',
    )
}

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

export async function listPublicCategories(
    tenantHost: string,
): Promise<PublicCategory[]> {
    return envelopeResult(
        parsePublicCategoryListEnvelope,
        await request('/api/proxy/public/categories', tenantHost),
        'The server returned an invalid category list.',
    ).data
}

/** Entitled (or publisher) episode list — includes playable audio URLs for PAID content. */
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
        parseSubscriberFeedListEnvelopeAlias,
        await authenticatedRequest('/api/proxy/me/feeds', tenantHost),
        'The server returned an invalid feed list.',
    ).data
}

export async function rotateDefaultFeedToken(
    tenantHost: string,
): Promise<SubscriberFeedView> {
    return envelopeResult(
        parseSubscriberFeedEnvelopeAlias,
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
        parseSubscriberFeedEnvelopeAlias,
        await authenticatedRequest('/api/proxy/me/feeds/default/enabled', tenantHost, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({enabled}),
        }),
        'Der Server hat eine ungültige Feed-Antwort geliefert.',
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

export async function createCustomFeed(
    tenantHost: string,
    title: string,
    formatIds: number[],
): Promise<SubscriberFeedView> {
    return envelopeResult(
        parseSubscriberFeedEnvelopeAlias,
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
        parseSubscriberFeedEnvelopeAlias,
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
        parseSubscriberFeedEnvelopeAlias,
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
        parseSubscriberFeedEnvelopeAlias,
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
    const value = await authenticatedRequest(
        '/api/proxy/me/notification-preferences',
        tenantHost,
    )
    if (
        typeof value !== 'object' ||
        value === null ||
        !('data' in value) ||
        typeof (value as {data: unknown}).data !== 'object' ||
        (value as {data: unknown}).data === null ||
        typeof (
            (value as {data: {emailNotificationsEnabled?: unknown}}).data
                .emailNotificationsEnabled
        ) !== 'boolean'
    ) {
        throw new Error('The server returned invalid notification preferences.')
    }

    return {
        emailNotificationsEnabled: (
            value as {data: {emailNotificationsEnabled: boolean}}
        ).data.emailNotificationsEnabled,
    }
}

export async function updateNotificationPreferences(
    tenantHost: string,
    emailNotificationsEnabled: boolean,
): Promise<{emailNotificationsEnabled: boolean}> {
    const value = await authenticatedRequest(
        '/api/proxy/me/notification-preferences',
        tenantHost,
        {
            method: 'PATCH',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({emailNotificationsEnabled}),
        },
    )
    if (
        typeof value !== 'object' ||
        value === null ||
        !('data' in value) ||
        typeof (value as {data: unknown}).data !== 'object' ||
        (value as {data: unknown}).data === null ||
        typeof (
            (value as {data: {emailNotificationsEnabled?: unknown}}).data
                .emailNotificationsEnabled
        ) !== 'boolean'
    ) {
        throw new Error('The server returned invalid notification preferences.')
    }

    return {
        emailNotificationsEnabled: (
            value as {data: {emailNotificationsEnabled: boolean}}
        ).data.emailNotificationsEnabled,
    }
}

export async function createCheckoutSession(
    tenantHost: string,
    productSlug: string,
): Promise<string | null> {
    const value = await authenticatedRequest(
        '/api/proxy/me/billing/checkout-sessions',
        tenantHost,
        {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({productSlug}),
        },
    )
    return parseCheckoutSessionEnvelope(value)
}

export async function listMySubscriptions(
    tenantHost: string,
): Promise<SubscriptionSummary[]> {
    return envelopeResult(
        parseSubscriptionListEnvelope,
        await authenticatedRequest('/api/proxy/me/subscriptions', tenantHost),
        'Der Server hat eine ungültige Abo-Liste geliefert.',
    ).data
}

export async function createPortalSession(
    tenantHost: string,
    returnUrl: string,
): Promise<string | null> {
    const value = await authenticatedRequest(
        '/api/proxy/me/billing/portal',
        tenantHost,
        {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({returnUrl}),
        },
    )
    return parseCheckoutSessionEnvelope(value)
}

export async function listMyDownloads(
    tenantHost: string,
): Promise<SubscriberDownload[]> {
    return envelopeResult(
        parseSubscriberDownloadListEnvelopeAlias,
        await authenticatedRequest('/api/proxy/me/downloads', tenantHost),
        'Der Server hat eine ungültige Download-Liste geliefert.',
    ).data
}

export async function listPublicProducts(
    tenantHost: string,
): Promise<Array<{
    slug: string
    title: string
    offeringType: string
    sortOrder: number
    description: string | null
    priceCents: number | null
    currency: string
    billingInterval: string
}>> {
    const value = await request('/api/proxy/public/products', tenantHost)
    if (
        typeof value !== 'object' ||
        value === null ||
        !('data' in value) ||
        !Array.isArray((value as {data: unknown}).data)
    ) {
        throw new Error('The server returned an invalid product list.')
    }

    return (value as {
        data: Array<{
            slug: string
            title: string
            offeringType: string
            sortOrder: number
            description: string | null
            priceCents: number | null
            currency: string
            billingInterval: string
        }>
    }).data
}
