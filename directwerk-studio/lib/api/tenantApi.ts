'use client'

import {AUTH_REQUIRED} from '@/lib/api/errors'
import {
    parseArticleEnvelope,
    parseArticleListEnvelope,
    parseBrandingEnvelope,
    parseCategoryEnvelope,
    parseCategoryListEnvelope,
    parseContentEmailTemplateEnvelope,
    parseDomainEnvelope,
    parseDomainListEnvelope,
    parseDomainVerificationEnvelope,
    parseEpisodeEnvelope,
    parseEpisodeListEnvelope,
    parseFormatEnvelope,
    parseFormatListEnvelope,
    parseInviteTenantUserEnvelope,
    parseLevelListEnvelope,
    parseMeEnvelope,
    parseMediaAssetEnvelope,
    parseMediaListEnvelope,
    parsePreviewUrlEnvelope,
    parseProductEnvelope,
    parseProductListEnvelope,
    parseProductRuleListEnvelope,
    parseSeriesEnvelope,
    parseSeriesListEnvelope,
    parseBillingDashboardEnvelope,
    parseStripeOnboardEnvelope,
    parseStripeStatusEnvelope,
    parseSubscriptionGrantEnvelope,
    parseSubscriberListEnvelope,
    parseTenantUserEnvelope,
    parseTenantUserListEnvelope,
    parseTokenResponse,
    parseSubscriberFeedEnvelope,
    parseSubscriberFeedListEnvelope,
} from '@/lib/api/responseValidation'
import type {
    ArticleDetail,
    CategorySummary,
    ContentEmailTemplate,
    ContentEmailTemplateType,
    CreateArticleInput,
    CreateCategoryInput,
    CreateEpisodeInput,
    CreateFormatInput,
    CreateProductInput,
    CreateSeriesInput,
    DomainVerificationChallenge,
    EpisodeDetail,
    FormatSummary,
    GrantSubscriptionInput,
    InviteTenantUserInput,
    InviteTenantUserResponse,
    LevelSummary,
    Me,
    MediaAsset,
    ProductAccessRule,
    ProductAccessRuleInput,
    PublishOptions,
    ScheduleOptions,
    SeriesDetail,
    SeriesSummary,
    BillingDashboard,
    StripeStatus,
    SubscriberFeedSummary,
    SubscriptionGrant,
    SubscriptionProduct,
    TenantBranding,
    TenantDomain,
    TenantSubscriber,
    TenantUser,
    TokenResponse,
    UpdateArticleInput,
    UpdateCategoryInput,
    UpdateEpisodeInput,
    UpdateFormatInput,
    UpdateProductInput,
    UpdateSeriesInput,
    UpdateTenantBrandingInput,
    UpsertContentEmailTemplateInput,
    AddTenantDomainInput,
} from '@/lib/api/types'
import type {LoginInput} from '@/lib/api/validation'
import {getValidAccessToken, refreshAccessToken} from '@/lib/auth/session'
import {getClientTenantHost} from '@/lib/tenant/getClientTenantHost'

function errorMessage(value: unknown, status: number): string {
    if (
        typeof value === 'object' &&
        value !== null &&
        'error' in value &&
        typeof value.error === 'string'
    ) {
        // The OAuth token endpoint reports failed logins as 400 with an
        // `error` code (typically "invalid_grant"). Show a user-facing
        // message instead of the raw protocol code.
        if (value.error === 'invalid_grant') {
            return 'E-Mail oder Passwort falsch.'
        }
        if (value.error.length > 0 && value.error.length <= 255) {
            return value.error
        }
    }

    if (
        typeof value === 'object' &&
        value !== null &&
        'errors' in value &&
        Array.isArray(value.errors) &&
        value.errors.length > 0
    ) {
        const first = value.errors[0]
        if (
            typeof first === 'object' &&
            first !== null &&
            'message' in first &&
            typeof first.message === 'string' &&
            first.message.length > 0 &&
            first.message.length <= 255
        ) {
            return first.message
        }
    }

    if (status === 401) {
        return 'E-Mail oder Passwort falsch.'
    }

    return `Anfrage fehlgeschlagen (${status}).`
}

async function parseJsonResponse(response: Response): Promise<unknown> {
    const contentType = response.headers.get('content-type') ?? ''
    if (!contentType.toLowerCase().includes('application/json')) {
        throw new Error('Der Server hat eine ungültige Antwort gesendet.')
    }

    return response.json()
}

async function request(
    path: string,
    tenantHost: string,
    init?: RequestInit,
): Promise<unknown> {
    const response = await fetch(path, {
        ...init,
        headers: {
            Accept: 'application/json',
            'X-Tenant-Host': tenantHost,
            ...init?.headers,
        },
    })
    const value = await parseJsonResponse(response)
    if (!response.ok) {
        throw new Error(errorMessage(value, response.status))
    }

    return value
}

async function authenticatedRequest(
    path: string,
    tenantHost: string,
    init?: RequestInit,
    retried = false,
): Promise<unknown> {
    let accessToken: string
    try {
        accessToken = await getValidAccessToken()
    } catch (error: unknown) {
        if (error instanceof Error && error.message === AUTH_REQUIRED) {
            throw error
        }
        // Transient refresh failures (upstream outage, timeout) must not be
        // reported as "not authenticated" — consumers would log the user out.
        throw new Error('Der Server ist derzeit nicht erreichbar.')
    }

    const response = await fetch(path, {
        ...init,
        headers: {
            Accept: 'application/json',
            'X-Tenant-Host': tenantHost,
            Authorization: `Bearer ${accessToken}`,
            ...init?.headers,
        },
    })

    if (response.status === 401 && !retried) {
        try {
            accessToken = await refreshAccessToken()
        } catch (error: unknown) {
            if (error instanceof Error && error.message === AUTH_REQUIRED) {
                throw error
            }
            // The session itself is intact — only this request failed.
            // Clearing tokens here would log the user out on transient errors.
            throw new Error('Der Server ist derzeit nicht erreichbar.')
        }

        return authenticatedRequest(path, tenantHost, init, true)
    }

    const value = await parseJsonResponse(response)
    if (response.status === 401) {
        // Reached only when the token was already refreshed once and the retry
        // still returned 401 — that is an authorization (not authentication)
        // failure. Surface the error instead of logging the user out.
        throw new Error(errorMessage(value, response.status))
    }

    if (!response.ok) {
        throw new Error(errorMessage(value, response.status))
    }

    return value
}

async function postJson(
    path: string,
    tenantHost: string,
    body: unknown,
): Promise<unknown> {
    return request(path, tenantHost, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(body),
    })
}

export async function login(
    tenantHost: string,
    input: LoginInput,
): Promise<TokenResponse> {
    const value = await postJson('/api/auth/login', tenantHost, input)
    const tokens = parseTokenResponse(value)
    if (tokens === null) {
        throw new Error('Der Server hat eine ungültige Token-Antwort gesendet.')
    }

    return tokens
}

export async function fetchMe(tenantHost: string): Promise<Me> {
    const parsed = parseMeEnvelope(
        await authenticatedRequest('/api/proxy/me', tenantHost),
    )
    if (parsed === null) {
        throw new Error('Der Server hat eine ungültige Kontodaten-Antwort gesendet.')
    }

    return parsed.data
}

export async function listArticles(tenantHost: string): Promise<ArticleDetail[]> {
    const parsed = parseArticleListEnvelope(
        await authenticatedRequest('/api/proxy/articles', tenantHost),
    )
    if (parsed === null) {
        throw new Error('Der Server hat eine ungültige Beitragsliste gesendet.')
    }

    return parsed.data
}

export async function getArticle(
    tenantHost: string,
    articleId: number,
): Promise<ArticleDetail> {
    const parsed = parseArticleEnvelope(
        await authenticatedRequest(`/api/proxy/articles/${articleId}`, tenantHost),
    )
    if (parsed === null) {
        throw new Error('Der Server hat einen ungültigen Beitrag gesendet.')
    }

    return parsed.data
}

export async function createArticle(
    tenantHost: string,
    input: CreateArticleInput,
): Promise<ArticleDetail> {
    const parsed = parseArticleEnvelope(
        await authenticatedRequest('/api/proxy/articles', tenantHost, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(input),
        }),
    )
    if (parsed === null) {
        throw new Error('Der Server hat einen ungültigen Beitrag gesendet.')
    }

    return parsed.data
}

export async function updateArticle(
    tenantHost: string,
    articleId: number,
    input: UpdateArticleInput,
): Promise<ArticleDetail> {
    const parsed = parseArticleEnvelope(
        await authenticatedRequest(`/api/proxy/articles/${articleId}`, tenantHost, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(input),
        }),
    )
    if (parsed === null) {
        throw new Error('Der Server hat einen ungültigen Beitrag gesendet.')
    }

    return parsed.data
}

export async function publishArticle(
    tenantHost: string,
    articleId: number,
    options?: PublishOptions,
): Promise<ArticleDetail> {
    const parsed = parseArticleEnvelope(
        await authenticatedRequest(
            `/api/proxy/articles/${articleId}/publish`,
            tenantHost,
            {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    notifySubscribers: options?.notifySubscribers === true,
                }),
            },
        ),
    )
    if (parsed === null) {
        throw new Error('Der Server hat einen ungültigen Beitrag gesendet.')
    }

    return parsed.data
}

export async function scheduleArticle(
    tenantHost: string,
    articleId: number,
    options: ScheduleOptions,
): Promise<ArticleDetail> {
    const parsed = parseArticleEnvelope(
        await authenticatedRequest(
            `/api/proxy/articles/${articleId}/schedule`,
            tenantHost,
            {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    scheduledAt: options.scheduledAt,
                    notifySubscribers: options.notifySubscribers === true,
                }),
            },
        ),
    )
    if (parsed === null) {
        throw new Error('Der Server hat einen ungültigen Beitrag gesendet.')
    }

    return parsed.data
}

export async function cancelScheduleArticle(
    tenantHost: string,
    articleId: number,
): Promise<ArticleDetail> {
    const parsed = parseArticleEnvelope(
        await authenticatedRequest(
            `/api/proxy/articles/${articleId}/cancel-schedule`,
            tenantHost,
            {method: 'POST'},
        ),
    )
    if (parsed === null) {
        throw new Error('Der Server hat einen ungültigen Beitrag gesendet.')
    }

    return parsed.data
}

export async function unpublishArticle(
    tenantHost: string,
    articleId: number,
): Promise<ArticleDetail> {
    const parsed = parseArticleEnvelope(
        await authenticatedRequest(
            `/api/proxy/articles/${articleId}/unpublish`,
            tenantHost,
            {method: 'POST'},
        ),
    )
    if (parsed === null) {
        throw new Error('Der Server hat einen ungültigen Beitrag gesendet.')
    }

    return parsed.data
}

export async function archiveArticle(
    tenantHost: string,
    articleId: number,
): Promise<ArticleDetail> {
    const parsed = parseArticleEnvelope(
        await authenticatedRequest(
            `/api/proxy/articles/${articleId}/archive`,
            tenantHost,
            {method: 'POST'},
        ),
    )
    if (parsed === null) {
        throw new Error('Der Server hat einen ungültigen Beitrag gesendet.')
    }

    return parsed.data
}

export async function unarchiveArticle(
    tenantHost: string,
    articleId: number,
): Promise<ArticleDetail> {
    const parsed = parseArticleEnvelope(
        await authenticatedRequest(
            `/api/proxy/articles/${articleId}/unarchive`,
            tenantHost,
            {method: 'POST'},
        ),
    )
    if (parsed === null) {
        throw new Error('Der Server hat einen ungültigen Beitrag gesendet.')
    }

    return parsed.data
}

export async function listEpisodes(tenantHost: string): Promise<EpisodeDetail[]> {
    const parsed = parseEpisodeListEnvelope(
        await authenticatedRequest('/api/proxy/episodes', tenantHost),
    )
    if (parsed === null) {
        throw new Error('Der Server hat eine ungültige Folgenliste gesendet.')
    }

    return parsed.data
}

export async function getEpisode(
    tenantHost: string,
    episodeId: number,
): Promise<EpisodeDetail> {
    const parsed = parseEpisodeEnvelope(
        await authenticatedRequest(`/api/proxy/episodes/${episodeId}`, tenantHost),
    )
    if (parsed === null) {
        throw new Error('Der Server hat eine ungültige Folge gesendet.')
    }

    return parsed.data
}

export async function createEpisode(
    tenantHost: string,
    input: CreateEpisodeInput,
): Promise<EpisodeDetail> {
    const parsed = parseEpisodeEnvelope(
        await authenticatedRequest('/api/proxy/episodes', tenantHost, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(input),
        }),
    )
    if (parsed === null) {
        throw new Error('Der Server hat eine ungültige Folge gesendet.')
    }

    return parsed.data
}

export async function updateEpisode(
    tenantHost: string,
    episodeId: number,
    input: UpdateEpisodeInput,
): Promise<EpisodeDetail> {
    const parsed = parseEpisodeEnvelope(
        await authenticatedRequest(`/api/proxy/episodes/${episodeId}`, tenantHost, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(input),
        }),
    )
    if (parsed === null) {
        throw new Error('Der Server hat eine ungültige Folge gesendet.')
    }

    return parsed.data
}

export async function publishEpisode(
    tenantHost: string,
    episodeId: number,
    options?: PublishOptions,
): Promise<EpisodeDetail> {
    const parsed = parseEpisodeEnvelope(
        await authenticatedRequest(
            `/api/proxy/episodes/${episodeId}/publish`,
            tenantHost,
            {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    notifySubscribers: options?.notifySubscribers === true,
                }),
            },
        ),
    )
    if (parsed === null) {
        throw new Error('Der Server hat eine ungültige Folge gesendet.')
    }

    return parsed.data
}

export async function scheduleEpisode(
    tenantHost: string,
    episodeId: number,
    options: ScheduleOptions,
): Promise<EpisodeDetail> {
    const parsed = parseEpisodeEnvelope(
        await authenticatedRequest(
            `/api/proxy/episodes/${episodeId}/schedule`,
            tenantHost,
            {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    scheduledAt: options.scheduledAt,
                    notifySubscribers: options.notifySubscribers === true,
                }),
            },
        ),
    )
    if (parsed === null) {
        throw new Error('Der Server hat eine ungültige Folge gesendet.')
    }

    return parsed.data
}

export async function cancelScheduleEpisode(
    tenantHost: string,
    episodeId: number,
): Promise<EpisodeDetail> {
    const parsed = parseEpisodeEnvelope(
        await authenticatedRequest(
            `/api/proxy/episodes/${episodeId}/cancel-schedule`,
            tenantHost,
            {method: 'POST'},
        ),
    )
    if (parsed === null) {
        throw new Error('Der Server hat eine ungültige Folge gesendet.')
    }

    return parsed.data
}

export async function unpublishEpisode(
    tenantHost: string,
    episodeId: number,
): Promise<EpisodeDetail> {
    const parsed = parseEpisodeEnvelope(
        await authenticatedRequest(
            `/api/proxy/episodes/${episodeId}/unpublish`,
            tenantHost,
            {method: 'POST'},
        ),
    )
    if (parsed === null) {
        throw new Error('Der Server hat eine ungültige Folge gesendet.')
    }

    return parsed.data
}

export async function archiveEpisode(
    tenantHost: string,
    episodeId: number,
): Promise<EpisodeDetail> {
    const parsed = parseEpisodeEnvelope(
        await authenticatedRequest(
            `/api/proxy/episodes/${episodeId}/archive`,
            tenantHost,
            {method: 'POST'},
        ),
    )
    if (parsed === null) {
        throw new Error('Der Server hat eine ungültige Folge gesendet.')
    }

    return parsed.data
}

export async function unarchiveEpisode(
    tenantHost: string,
    episodeId: number,
): Promise<EpisodeDetail> {
    const parsed = parseEpisodeEnvelope(
        await authenticatedRequest(
            `/api/proxy/episodes/${episodeId}/unarchive`,
            tenantHost,
            {method: 'POST'},
        ),
    )
    if (parsed === null) {
        throw new Error('Der Server hat eine ungültige Folge gesendet.')
    }

    return parsed.data
}

export async function setEpisodeEnclosureEnabled(
    tenantHost: string,
    episodeId: number,
    enabled: boolean,
): Promise<EpisodeDetail> {
    const parsed = parseEpisodeEnvelope(
        await authenticatedRequest(
            `/api/proxy/episodes/${episodeId}/enclosure-enabled`,
            tenantHost,
            {
                method: 'PUT',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({enabled}),
            },
        ),
    )
    if (parsed === null) {
        throw new Error('Der Server hat eine ungültige Folge gesendet.')
    }

    return parsed.data
}

export async function attachEpisodeAudio(
    tenantHost: string,
    episodeId: number,
    audioAssetId: number,
): Promise<EpisodeDetail> {
    const parsed = parseEpisodeEnvelope(
        await authenticatedRequest(
            `/api/proxy/episodes/${episodeId}/audio`,
            tenantHost,
            {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({audioAssetId}),
            },
        ),
    )
    if (parsed === null) {
        throw new Error('Der Server hat eine ungültige Folge gesendet.')
    }

    return parsed.data
}

export async function listSeries(tenantHost: string): Promise<SeriesSummary[]> {
    const parsed = parseSeriesListEnvelope(
        await authenticatedRequest('/api/proxy/series', tenantHost),
    )
    if (parsed === null) {
        throw new Error('Der Server hat eine ungültige Sendungsliste gesendet.')
    }

    return parsed.data
}

export async function getSeries(
    tenantHost: string,
    seriesId: number,
): Promise<SeriesDetail> {
    const parsed = parseSeriesEnvelope(
        await authenticatedRequest(`/api/proxy/series/${seriesId}`, tenantHost),
    )
    if (parsed === null) {
        throw new Error('Der Server hat eine ungültige Sendung gesendet.')
    }

    return parsed.data
}

export async function createSeries(
    tenantHost: string,
    input: CreateSeriesInput,
): Promise<SeriesDetail> {
    const parsed = parseSeriesEnvelope(
        await authenticatedRequest('/api/proxy/series', tenantHost, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(input),
        }),
    )
    if (parsed === null) {
        throw new Error('Der Server hat eine ungültige Sendung gesendet.')
    }

    return parsed.data
}

export async function updateSeries(
    tenantHost: string,
    seriesId: number,
    input: UpdateSeriesInput,
): Promise<SeriesDetail> {
    const parsed = parseSeriesEnvelope(
        await authenticatedRequest(`/api/proxy/series/${seriesId}`, tenantHost, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(input),
        }),
    )
    if (parsed === null) {
        throw new Error('Der Server hat eine ungültige Sendung gesendet.')
    }

    return parsed.data
}

export async function confirmUpload(
    tenantHost: string,
    assetId: number,
): Promise<MediaAsset> {
    const parsed = parseMediaAssetEnvelope(
        await authenticatedRequest(`/api/proxy/media/${assetId}/confirm`, tenantHost, {
            method: 'POST',
        }),
    )
    if (parsed === null) {
        throw new Error('Der Server hat ein ungültiges Medium gesendet.')
    }

    return parsed.data
}

export async function listMedia(tenantHost: string): Promise<MediaAsset[]> {
    const parsed = parseMediaListEnvelope(
        await authenticatedRequest('/api/proxy/media', tenantHost),
    )
    if (parsed === null) {
        throw new Error('Der Server hat eine ungültige Medienliste gesendet.')
    }

    return parsed.data
}

export async function getMedia(
    tenantHost: string,
    assetId: number,
): Promise<MediaAsset> {
    const parsed = parseMediaAssetEnvelope(
        await authenticatedRequest(`/api/proxy/media/${assetId}`, tenantHost),
    )
    if (parsed === null) {
        throw new Error('Der Server hat ein ungültiges Medium gesendet.')
    }

    return parsed.data
}

export async function deleteMedia(
    tenantHost: string,
    assetId: number,
): Promise<MediaAsset> {
    const parsed = parseMediaAssetEnvelope(
        await authenticatedRequest(`/api/proxy/media/${assetId}`, tenantHost, {
            method: 'DELETE',
        }),
    )
    if (parsed === null) {
        throw new Error('Der Server hat ein ungültiges Medium gesendet.')
    }

    return parsed.data
}

export async function getMediaPreviewUrl(
    tenantHost: string,
    assetId: number,
): Promise<string> {
    const url = parsePreviewUrlEnvelope(
        await authenticatedRequest(
            `/api/proxy/media/${assetId}/preview-url`,
            tenantHost,
        ),
    )
    if (url === null) {
        throw new Error('Der Server hat keine gültige Audio-Vorschau-URL gesendet.')
    }

    return url
}

export function suggestSlug(title: string): string {
    return title
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 63)
}

export function isEditorRole(roles: string[]): boolean {
    return roles.includes('EDITOR') || roles.includes('TENANT_ADMIN')
}

export function isTenantAdminRole(roles: string[]): boolean {
    return roles.includes('TENANT_ADMIN')
}

export async function getBranding(tenantHost: string): Promise<TenantBranding> {
    return proxyRequest(
        '/api/proxy/tenant/branding',
        tenantHost,
        undefined,
        parseBrandingEnvelope,
        'Der Server hat ungültige Branding-Daten gesendet.',
    )
}

export async function updateBranding(
    tenantHost: string,
    input: UpdateTenantBrandingInput,
): Promise<TenantBranding> {
    return proxyRequest(
        '/api/proxy/tenant/branding',
        tenantHost,
        {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(input),
        },
        parseBrandingEnvelope,
        'Der Server hat ungültige Branding-Daten gesendet.',
    )
}

export async function listDomains(tenantHost: string): Promise<TenantDomain[]> {
    return proxyRequest(
        '/api/proxy/tenant/domains',
        tenantHost,
        undefined,
        parseDomainListEnvelope,
        'Der Server hat eine ungültige Domainliste gesendet.',
    )
}

export async function addDomain(
    tenantHost: string,
    input: AddTenantDomainInput,
): Promise<TenantDomain> {
    return proxyRequest(
        '/api/proxy/tenant/domains',
        tenantHost,
        {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                host: input.host,
                isPrimary: input.isPrimary === true,
            }),
        },
        parseDomainEnvelope,
        'Der Server hat eine ungültige Domain gesendet.',
    )
}

export async function getDomainVerification(
    tenantHost: string,
    host: string,
): Promise<DomainVerificationChallenge> {
    return proxyRequest(
        `/api/proxy/tenant/domains/${encodeURIComponent(host)}/verification`,
        tenantHost,
        undefined,
        parseDomainVerificationEnvelope,
        'Der Server hat ungültige Domain-Verifizierung gesendet.',
    )
}

export async function verifyDomain(
    tenantHost: string,
    host: string,
): Promise<TenantDomain> {
    return proxyRequest(
        `/api/proxy/tenant/domains/${encodeURIComponent(host)}/verify`,
        tenantHost,
        {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({}),
        },
        parseDomainEnvelope,
        'Der Server hat eine ungültige Domain gesendet.',
    )
}

export async function listTenantUsers(tenantHost: string): Promise<TenantUser[]> {
    return proxyRequest(
        '/api/proxy/tenant/users',
        tenantHost,
        undefined,
        parseTenantUserListEnvelope,
        'Der Server hat eine ungültige Benutzerliste gesendet.',
    )
}

export async function inviteTenantUser(
    tenantHost: string,
    input: InviteTenantUserInput,
): Promise<InviteTenantUserResponse> {
    return proxyRequest(
        '/api/proxy/tenant/users/invite',
        tenantHost,
        {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(input),
        },
        parseInviteTenantUserEnvelope,
        'Der Server hat eine ungültige Einladung gesendet.',
    )
}

export async function deactivateTenantUser(
    tenantHost: string,
    userId: number,
): Promise<TenantUser> {
    return proxyRequest(
        `/api/proxy/tenant/users/${userId}/deactivate`,
        tenantHost,
        {method: 'POST'},
        parseTenantUserEnvelope,
        'Der Server hat ungültige Benutzerdaten gesendet.',
    )
}

export async function reactivateTenantUser(
    tenantHost: string,
    userId: number,
): Promise<TenantUser> {
    return proxyRequest(
        `/api/proxy/tenant/users/${userId}/reactivate`,
        tenantHost,
        {method: 'POST'},
        parseTenantUserEnvelope,
        'Der Server hat ungültige Benutzerdaten gesendet.',
    )
}

export async function listSubscribers(
    tenantHost: string,
): Promise<TenantSubscriber[]> {
    return proxyRequest(
        '/api/proxy/tenant/subscribers',
        tenantHost,
        undefined,
        parseSubscriberListEnvelope,
        'Der Server hat eine ungültige Abonnentenliste gesendet.',
    )
}

export async function getContentEmailTemplate(
    tenantHost: string,
    contentType: ContentEmailTemplateType,
): Promise<ContentEmailTemplate | null> {
    return proxyRequest(
        `/api/proxy/tenant/content-email-templates/${contentType}`,
        tenantHost,
        undefined,
        parseContentEmailTemplateEnvelope,
        'Der Server hat ungültige E-Mail-Vorlagen gesendet.',
    )
}

export async function upsertContentEmailTemplate(
    tenantHost: string,
    contentType: ContentEmailTemplateType,
    input: UpsertContentEmailTemplateInput,
): Promise<ContentEmailTemplate> {
    const result = await proxyRequest(
        `/api/proxy/tenant/content-email-templates/${contentType}`,
        tenantHost,
        {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(input),
        },
        parseContentEmailTemplateEnvelope,
        'Der Server hat ungültige E-Mail-Vorlagen gesendet.',
    )
    if (result === null) {
        throw new Error('Der Server hat ungültige E-Mail-Vorlagen gesendet.')
    }
    return result
}

export async function getStripeStatus(tenantHost: string): Promise<StripeStatus> {
    return proxyRequest(
        '/api/proxy/tenant/stripe/status',
        tenantHost,
        undefined,
        parseStripeStatusEnvelope,
        'Der Server hat ungültigen Stripe-Status gesendet.',
    )
}

export async function startStripeOnboard(
    tenantHost: string,
    returnUrl: string,
    refreshUrl: string,
): Promise<string> {
    const url = parseStripeOnboardEnvelope(
        await authenticatedRequest('/api/proxy/tenant/stripe/onboard', tenantHost, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({returnUrl, refreshUrl}),
        }),
    )
    if (url === null) {
        throw new Error('Der Server hat keine Stripe-Onboarding-URL gesendet.')
    }
    return url
}

export async function getBillingDashboard(tenantHost: string): Promise<BillingDashboard> {
    return proxyRequest(
        '/api/proxy/tenant/billing/dashboard',
        tenantHost,
        undefined,
        parseBillingDashboardEnvelope,
        'Der Server hat ungültige Zahlungsdaten gesendet.',
    )
}

export async function syncProductStripe(
    tenantHost: string,
    productId: number,
): Promise<SubscriptionProduct> {
    const parsed = parseProductEnvelope(
        await authenticatedRequest(
            `/api/proxy/tenant/products/${productId}/sync-stripe`,
            tenantHost,
            {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({}),
            },
        ),
    )
    if (parsed === null) {
        throw new Error('Der Server hat ein ungültiges Produkt gesendet.')
    }
    return parsed.data
}

export async function listProducts(
    tenantHost: string,
): Promise<SubscriptionProduct[]> {
    const parsed = parseProductListEnvelope(
        await authenticatedRequest('/api/proxy/tenant/products', tenantHost),
    )
    if (parsed === null) {
        throw new Error('Der Server hat eine ungültige Produktliste gesendet.')
    }

    return parsed.data
}

/**
 * Lists the tenant's active LEVEL subscription products without authentication.
 *
 * @param tenantHost - The tenant's host identifier
 * @returns The tenant's active level summaries, sorted by sortOrder ascending
 */
export async function listPublicLevels(
    tenantHost: string,
): Promise<LevelSummary[]> {
    const parsed = parseLevelListEnvelope(
        await request('/api/proxy/public/levels', tenantHost),
    )
    if (parsed === null) {
        throw new Error('Der Server hat eine ungültige Stufenliste gesendet.')
    }

    return parsed.data
}

export async function createProduct(
    tenantHost: string,
    input: CreateProductInput,
): Promise<SubscriptionProduct> {
    const parsed = parseProductEnvelope(
        await authenticatedRequest('/api/proxy/tenant/products', tenantHost, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(input),
        }),
    )
    if (parsed === null) {
        throw new Error('Der Server hat ein ungültiges Produkt gesendet.')
    }

    return parsed.data
}

export async function updateProduct(
    tenantHost: string,
    productId: number,
    input: UpdateProductInput,
): Promise<SubscriptionProduct> {
    const parsed = parseProductEnvelope(
        await authenticatedRequest(
            `/api/proxy/tenant/products/${productId}`,
            tenantHost,
            {
                method: 'PUT',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(input),
            },
        ),
    )
    if (parsed === null) {
        throw new Error('Der Server hat ein ungültiges Produkt gesendet.')
    }

    return parsed.data
}

export async function deactivateProduct(
    tenantHost: string,
    productId: number,
): Promise<SubscriptionProduct> {
    const parsed = parseProductEnvelope(
        await authenticatedRequest(
            `/api/proxy/tenant/products/${productId}`,
            tenantHost,
            {method: 'DELETE'},
        ),
    )
    if (parsed === null) {
        throw new Error('Der Server hat ein ungültiges Produkt gesendet.')
    }

    return parsed.data
}

export async function listProductRules(
    tenantHost: string,
    productId: number,
): Promise<ProductAccessRule[]> {
    const parsed = parseProductRuleListEnvelope(
        await authenticatedRequest(
            `/api/proxy/tenant/products/${productId}/rules`,
            tenantHost,
        ),
    )
    if (parsed === null) {
        throw new Error('Der Server hat ungültige Produktregeln gesendet.')
    }

    return parsed.data
}

export async function replaceProductRules(
    tenantHost: string,
    productId: number,
    rules: ProductAccessRuleInput[],
): Promise<ProductAccessRule[]> {
    const parsed = parseProductRuleListEnvelope(
        await authenticatedRequest(
            `/api/proxy/tenant/products/${productId}/rules`,
            tenantHost,
            {
                method: 'PUT',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({rules}),
            },
        ),
    )
    if (parsed === null) {
        throw new Error('Der Server hat ungültige Produktregeln gesendet.')
    }

    return parsed.data
}

export async function grantSubscription(
    tenantHost: string,
    input: GrantSubscriptionInput,
): Promise<SubscriptionGrant> {
    const parsed = parseSubscriptionGrantEnvelope(
        await authenticatedRequest(
            '/api/proxy/tenant/subscriptions',
            tenantHost,
            {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(input),
            },
        ),
    )
    if (parsed === null) {
        throw new Error('Der Server hat eine ungültige Freischaltung gesendet.')
    }

    return parsed.data
}

export async function revokeSubscription(
    tenantHost: string,
    subscriptionId: number,
): Promise<SubscriptionGrant> {
    const parsed = parseSubscriptionGrantEnvelope(
        await authenticatedRequest(
            `/api/proxy/tenant/subscriptions/${subscriptionId}`,
            tenantHost,
            {method: 'DELETE'},
        ),
    )
    if (parsed === null) {
        throw new Error('Der Server hat eine ungültige Freischaltung gesendet.')
    }

    return parsed.data
}

/**
 * Lists the subscriber feeds of the current tenant.
 *
 * @param tenantHost - The tenant's host identifier
 * @returns The tenant's subscriber feed summaries
 */
export async function listSubscriberFeeds(
    tenantHost: string,
): Promise<SubscriberFeedSummary[]> {
    const parsed = parseSubscriberFeedListEnvelope(
        await authenticatedRequest(
            '/api/proxy/tenant/subscriber-feeds',
            tenantHost,
        ),
    )
    if (parsed === null) {
        throw new Error('Der Server hat eine ungültige Feed-Liste gesendet.')
    }

    return parsed.data
}

/**
 * Enables or disables a subscriber feed of the current tenant.
 *
 * @param tenantHost - The tenant's host identifier
 * @param feedId - The identifier of the feed to toggle
 * @param enabled - Whether the feed should be enabled
 * @returns The updated subscriber feed
 */
export async function setSubscriberFeedEnabled(
    tenantHost: string,
    feedId: number,
    enabled: boolean,
): Promise<SubscriberFeedSummary> {
    const parsed = parseSubscriberFeedEnvelope(
        await authenticatedRequest(
            `/api/proxy/tenant/subscriber-feeds/${feedId}/enabled`,
            tenantHost,
            {
                method: 'PUT',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({enabled}),
            },
        ),
    )
    if (parsed === null) {
        throw new Error('Der Server hat ein ungültiges Feed gesendet.')
    }

    return parsed.data
}

/**
 * Lists the formats available to the tenant.
 *
 * @param tenantHost - The tenant's host identifier
 * @returns The tenant's available format summaries
 */
export async function listFormats(tenantHost: string): Promise<FormatSummary[]> {
    const parsed = parseFormatListEnvelope(
        await authenticatedRequest('/api/proxy/formats', tenantHost),
    )
    if (parsed === null) {
        throw new Error('Der Server hat eine ungültige Formatliste gesendet.')
    }

    return parsed.data
}

/**
 * Executes an authenticated request and extracts its validated response data.
 *
 * @param path - The API request path
 * @param tenantHost - The tenant host associated with the request
 * @param init - Optional request configuration
 * @param parser - Parses and validates the response value
 * @param errorMessage - Message used when response validation fails
 * @returns The parsed response data
 */
async function proxyRequest<T>(
    path: string,
    tenantHost: string,
    init: RequestInit | undefined,
    parser: (value: unknown) => {data: T} | null,
    errorMessage: string,
): Promise<T> {
    const parsed = parser(await authenticatedRequest(path, tenantHost, init))
    if (parsed === null) {
        throw new Error(errorMessage)
    }

    return parsed.data
}

/**
 * Lists the categories available for a tenant.
 *
 * @returns The tenant's category summaries
 */
export async function listCategories(
    tenantHost: string,
): Promise<CategorySummary[]> {
    const parsed = parseCategoryListEnvelope(
        await authenticatedRequest('/api/proxy/categories', tenantHost),
    )
    if (parsed === null) {
        throw new Error('Der Server hat eine ungültige Kategorieliste gesendet.')
    }

    return parsed.data
}

/**
 * Creates a format for the tenant.
 *
 * @param input - The format data to create
 * @returns The created format
 */
export async function createFormat(
    tenantHost: string,
    input: CreateFormatInput,
): Promise<FormatSummary> {
    return proxyRequest(
        '/api/proxy/formats',
        tenantHost,
        {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(input),
        },
        parseFormatEnvelope,
        'Der Server hat ein ungültiges Format gesendet.',
    )
}

/**
 * Updates a format for the tenant.
 *
 * @param formatId - The identifier of the format to update
 * @param input - The format fields to update
 * @returns The updated format
 */
export async function updateFormat(
    tenantHost: string,
    formatId: number,
    input: UpdateFormatInput,
): Promise<FormatSummary> {
    return proxyRequest(
        `/api/proxy/formats/${formatId}`,
        tenantHost,
        {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(input),
        },
        parseFormatEnvelope,
        'Der Server hat ein ungültiges Format gesendet.',
    )
}

/**
 * Deactivates a format for the tenant.
 *
 * @param formatId - The identifier of the format to deactivate
 * @returns The deactivated format
 */
export async function deactivateFormat(
    tenantHost: string,
    formatId: number,
): Promise<FormatSummary> {
    return proxyRequest(
        `/api/proxy/formats/${formatId}`,
        tenantHost,
        {
            method: 'DELETE',
        },
        parseFormatEnvelope,
        'Der Server hat ein ungültiges Format gesendet.',
    )
}

/**
 * Creates a category for the tenant.
 *
 * @param input - The category details to create
 * @returns The created category
 */
export async function createCategory(
    tenantHost: string,
    input: CreateCategoryInput,
): Promise<CategorySummary> {
    return proxyRequest(
        '/api/proxy/categories',
        tenantHost,
        {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(input),
        },
        parseCategoryEnvelope,
        'Der Server hat eine ungültige Kategorie gesendet.',
    )
}

/**
 * Updates a category.
 *
 * @param categoryId - The identifier of the category to update
 * @param input - The category fields to update
 * @returns The updated category
 */
export async function updateCategory(
    tenantHost: string,
    categoryId: number,
    input: UpdateCategoryInput,
): Promise<CategorySummary> {
    return proxyRequest(
        `/api/proxy/categories/${categoryId}`,
        tenantHost,
        {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(input),
        },
        parseCategoryEnvelope,
        'Der Server hat eine ungültige Kategorie gesendet.',
    )
}

/**
 * Deactivates a category.
 *
 * @param categoryId - The identifier of the category to deactivate
 * @returns The deactivated category
 */
export async function deactivateCategory(
    tenantHost: string,
    categoryId: number,
): Promise<CategorySummary> {
    return proxyRequest(
        `/api/proxy/categories/${categoryId}`,
        tenantHost,
        {
            method: 'DELETE',
        },
        parseCategoryEnvelope,
        'Der Server hat eine ungültige Kategorie gesendet.',
    )
}

/**
 * Replaces the formats associated with an episode.
 *
 * @param episodeId - The episode whose format associations are replaced
 * @param formatIds - The IDs of the formats to associate with the episode
 * @returns The updated episode
 */
export async function replaceEpisodeFormats(
    tenantHost: string,
    episodeId: number,
    formatIds: number[],
): Promise<EpisodeDetail> {
    return proxyRequest(
        `/api/proxy/episodes/${episodeId}/formats`,
        tenantHost,
        {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({formatIds}),
        },
        parseEpisodeEnvelope,
        'Der Server hat eine ungültige Folge gesendet.',
    )
}

/**
 * Replaces the categories associated with an episode.
 *
 * @param episodeId - The episode whose category associations are replaced
 * @param categoryIds - The category IDs to associate with the episode
 * @returns The updated episode
 */
export async function replaceEpisodeCategories(
    tenantHost: string,
    episodeId: number,
    categoryIds: number[],
): Promise<EpisodeDetail> {
    return proxyRequest(
        `/api/proxy/episodes/${episodeId}/categories`,
        tenantHost,
        {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({categoryIds}),
        },
        parseEpisodeEnvelope,
        'Der Server hat eine ungültige Folge gesendet.',
    )
}

/**
 * Replaces the categories assigned to an article.
 *
 * @param categoryIds - The identifiers of the categories to assign to the article
 * @returns The updated article
 */
export async function replaceArticleCategories(
    tenantHost: string,
    articleId: number,
    categoryIds: number[],
): Promise<ArticleDetail> {
    return proxyRequest(
        `/api/proxy/articles/${articleId}/categories`,
        tenantHost,
        {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({categoryIds}),
        },
        parseArticleEnvelope,
        'Der Server hat einen ungültigen Beitrag gesendet.',
    )
}

export {AUTH_REQUIRED}
