'use client'

import {createAuthedRequest, createJsonRequest} from '@directwerk/api/client'
import type {ErrorMessageCatalog} from '@directwerk/api/envelope'
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
    parseSubscriberFeedAdminEnvelope,
    parseSubscriberFeedAdminListEnvelope,
} from '@directwerk/api/validation'
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
} from '@directwerk/api/types'
import type {LoginInput} from '@directwerk/api/validation'
import {getValidAccessToken, refreshAccessToken} from '@/lib/auth/session'
import {getClientTenantHost} from '@/lib/tenant/getClientTenantHost'

const INVALID_RESPONSE = 'Der Server hat eine ungültige Antwort gesendet.'

/** Studio error-message catalog (German user-facing strings). */
const ERROR_CATALOG: ErrorMessageCatalog = {
    invalidGrant: 'E-Mail oder Passwort falsch.',
    unauthorized: 'E-Mail oder Passwort falsch.',
    fallback: (status) => `Anfrage fehlgeschlagen (${status}).`,
}

function baseHeaders(): Record<string, string> {
    return {'X-Tenant-Host': getClientTenantHost()}
}

const jsonRequest = createJsonRequest({
    baseHeaders,
    invalidResponseMessage: INVALID_RESPONSE,
    catalog: ERROR_CATALOG,
})

const authedFetch = createAuthedRequest({
    session: {getValidAccessToken, refreshAccessToken},
    clearTokens: () => {},
    baseHeaders: () => ({'X-Tenant-Host': getClientTenantHost()}),
    authFailureMode: 'preserve-transient',
    transientMessage: 'Der Server ist derzeit nicht erreichbar.',
    finalUnauthorized: 'localized-error',
    invalidResponseMessage: INVALID_RESPONSE,
    catalog: ERROR_CATALOG,
})

/** Adapter preserving the historical (path, tenantHost, init) signatures. */
function request(
    path: string,
    _tenantHost: string,
    init?: RequestInit,
): Promise<unknown> {
    return jsonRequest(path, init)
}

function authenticatedRequest(
    path: string,
    _tenantHost: string,
    init?: RequestInit,
): Promise<unknown> {
    return authedFetch(path, init)
}

async function postJson(
    path: string,
    tenantHost: string,
    body: unknown,
): Promise<unknown> {
    return request(path, tenantHost, jsonInit('POST', body))
}

function jsonInit(method: 'POST' | 'PUT', body: unknown): RequestInit {
    return {
        method,
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(body),
    }
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
    return proxyRequest(
        '/api/proxy/me',
        tenantHost,
        undefined,
        parseMeEnvelope,
        'Der Server hat eine ungültige Kontodaten-Antwort gesendet.',
    )
}

export async function listArticles(tenantHost: string): Promise<ArticleDetail[]> {
    return proxyRequest(
        '/api/proxy/articles',
        tenantHost,
        undefined,
        parseArticleListEnvelope,
        'Der Server hat eine ungültige Beitragsliste gesendet.',
    )
}

export async function getArticle(
    tenantHost: string,
    articleId: number,
): Promise<ArticleDetail> {
    return proxyRequest(
        `/api/proxy/articles/${articleId}`,
        tenantHost,
        undefined,
        parseArticleEnvelope,
        'Der Server hat einen ungültigen Beitrag gesendet.',
    )
}

export async function createArticle(
    tenantHost: string,
    input: CreateArticleInput,
): Promise<ArticleDetail> {
    return proxyRequest(
        '/api/proxy/articles',
        tenantHost,
        jsonInit('POST', input),
        parseArticleEnvelope,
        'Der Server hat einen ungültigen Beitrag gesendet.',
    )
}

export async function updateArticle(
    tenantHost: string,
    articleId: number,
    input: UpdateArticleInput,
): Promise<ArticleDetail> {
    return proxyRequest(
        `/api/proxy/articles/${articleId}`,
        tenantHost,
        jsonInit('PUT', input),
        parseArticleEnvelope,
        'Der Server hat einen ungültigen Beitrag gesendet.',
    )
}

export async function publishArticle(
    tenantHost: string,
    articleId: number,
    options?: PublishOptions,
): Promise<ArticleDetail> {
    return proxyRequest(
        `/api/proxy/articles/${articleId}/publish`,
        tenantHost,
        jsonInit('POST', {
            notifySubscribers: options?.notifySubscribers === true,
        }),
        parseArticleEnvelope,
        'Der Server hat einen ungültigen Beitrag gesendet.',
    )
}

export async function scheduleArticle(
    tenantHost: string,
    articleId: number,
    options: ScheduleOptions,
): Promise<ArticleDetail> {
    return proxyRequest(
        `/api/proxy/articles/${articleId}/schedule`,
        tenantHost,
        jsonInit('POST', {
            scheduledAt: options.scheduledAt,
            notifySubscribers: options.notifySubscribers === true,
        }),
        parseArticleEnvelope,
        'Der Server hat einen ungültigen Beitrag gesendet.',
    )
}

export async function cancelScheduleArticle(
    tenantHost: string,
    articleId: number,
): Promise<ArticleDetail> {
    return proxyRequest(
        `/api/proxy/articles/${articleId}/cancel-schedule`,
        tenantHost,
        {method: 'POST'},
        parseArticleEnvelope,
        'Der Server hat einen ungültigen Beitrag gesendet.',
    )
}

export async function unpublishArticle(
    tenantHost: string,
    articleId: number,
): Promise<ArticleDetail> {
    return proxyRequest(
        `/api/proxy/articles/${articleId}/unpublish`,
        tenantHost,
        {method: 'POST'},
        parseArticleEnvelope,
        'Der Server hat einen ungültigen Beitrag gesendet.',
    )
}

export async function archiveArticle(
    tenantHost: string,
    articleId: number,
): Promise<ArticleDetail> {
    return proxyRequest(
        `/api/proxy/articles/${articleId}/archive`,
        tenantHost,
        {method: 'POST'},
        parseArticleEnvelope,
        'Der Server hat einen ungültigen Beitrag gesendet.',
    )
}

export async function unarchiveArticle(
    tenantHost: string,
    articleId: number,
): Promise<ArticleDetail> {
    return proxyRequest(
        `/api/proxy/articles/${articleId}/unarchive`,
        tenantHost,
        {method: 'POST'},
        parseArticleEnvelope,
        'Der Server hat einen ungültigen Beitrag gesendet.',
    )
}

export async function listEpisodes(tenantHost: string): Promise<EpisodeDetail[]> {
    return proxyRequest(
        '/api/proxy/episodes',
        tenantHost,
        undefined,
        parseEpisodeListEnvelope,
        'Der Server hat eine ungültige Folgenliste gesendet.',
    )
}

export async function getEpisode(
    tenantHost: string,
    episodeId: number,
): Promise<EpisodeDetail> {
    return proxyRequest(
        `/api/proxy/episodes/${episodeId}`,
        tenantHost,
        undefined,
        parseEpisodeEnvelope,
        'Der Server hat eine ungültige Folge gesendet.',
    )
}

export async function createEpisode(
    tenantHost: string,
    input: CreateEpisodeInput,
): Promise<EpisodeDetail> {
    return proxyRequest(
        '/api/proxy/episodes',
        tenantHost,
        jsonInit('POST', input),
        parseEpisodeEnvelope,
        'Der Server hat eine ungültige Folge gesendet.',
    )
}

export async function updateEpisode(
    tenantHost: string,
    episodeId: number,
    input: UpdateEpisodeInput,
): Promise<EpisodeDetail> {
    return proxyRequest(
        `/api/proxy/episodes/${episodeId}`,
        tenantHost,
        jsonInit('PUT', input),
        parseEpisodeEnvelope,
        'Der Server hat eine ungültige Folge gesendet.',
    )
}

export async function publishEpisode(
    tenantHost: string,
    episodeId: number,
    options?: PublishOptions,
): Promise<EpisodeDetail> {
    return proxyRequest(
        `/api/proxy/episodes/${episodeId}/publish`,
        tenantHost,
        jsonInit('POST', {
            notifySubscribers: options?.notifySubscribers === true,
        }),
        parseEpisodeEnvelope,
        'Der Server hat eine ungültige Folge gesendet.',
    )
}

export async function scheduleEpisode(
    tenantHost: string,
    episodeId: number,
    options: ScheduleOptions,
): Promise<EpisodeDetail> {
    return proxyRequest(
        `/api/proxy/episodes/${episodeId}/schedule`,
        tenantHost,
        jsonInit('POST', {
            scheduledAt: options.scheduledAt,
            notifySubscribers: options.notifySubscribers === true,
        }),
        parseEpisodeEnvelope,
        'Der Server hat eine ungültige Folge gesendet.',
    )
}

export async function cancelScheduleEpisode(
    tenantHost: string,
    episodeId: number,
): Promise<EpisodeDetail> {
    return proxyRequest(
        `/api/proxy/episodes/${episodeId}/cancel-schedule`,
        tenantHost,
        {method: 'POST'},
        parseEpisodeEnvelope,
        'Der Server hat eine ungültige Folge gesendet.',
    )
}

export async function unpublishEpisode(
    tenantHost: string,
    episodeId: number,
): Promise<EpisodeDetail> {
    return proxyRequest(
        `/api/proxy/episodes/${episodeId}/unpublish`,
        tenantHost,
        {method: 'POST'},
        parseEpisodeEnvelope,
        'Der Server hat eine ungültige Folge gesendet.',
    )
}

export async function archiveEpisode(
    tenantHost: string,
    episodeId: number,
): Promise<EpisodeDetail> {
    return proxyRequest(
        `/api/proxy/episodes/${episodeId}/archive`,
        tenantHost,
        {method: 'POST'},
        parseEpisodeEnvelope,
        'Der Server hat eine ungültige Folge gesendet.',
    )
}

export async function unarchiveEpisode(
    tenantHost: string,
    episodeId: number,
): Promise<EpisodeDetail> {
    return proxyRequest(
        `/api/proxy/episodes/${episodeId}/unarchive`,
        tenantHost,
        {method: 'POST'},
        parseEpisodeEnvelope,
        'Der Server hat eine ungültige Folge gesendet.',
    )
}

export async function setEpisodeEnclosureEnabled(
    tenantHost: string,
    episodeId: number,
    enabled: boolean,
): Promise<EpisodeDetail> {
    return proxyRequest(
        `/api/proxy/episodes/${episodeId}/enclosure-enabled`,
        tenantHost,
        jsonInit('PUT', {enabled}),
        parseEpisodeEnvelope,
        'Der Server hat eine ungültige Folge gesendet.',
    )
}

export async function attachEpisodeAudio(
    tenantHost: string,
    episodeId: number,
    audioAssetId: number,
): Promise<EpisodeDetail> {
    return proxyRequest(
        `/api/proxy/episodes/${episodeId}/audio`,
        tenantHost,
        jsonInit('POST', {audioAssetId}),
        parseEpisodeEnvelope,
        'Der Server hat eine ungültige Folge gesendet.',
    )
}

export async function listSeries(tenantHost: string): Promise<SeriesSummary[]> {
    return proxyRequest(
        '/api/proxy/series',
        tenantHost,
        undefined,
        parseSeriesListEnvelope,
        'Der Server hat eine ungültige Sendungsliste gesendet.',
    )
}

export async function getSeries(
    tenantHost: string,
    seriesId: number,
): Promise<SeriesDetail> {
    return proxyRequest(
        `/api/proxy/series/${seriesId}`,
        tenantHost,
        undefined,
        parseSeriesEnvelope,
        'Der Server hat eine ungültige Sendung gesendet.',
    )
}

export async function createSeries(
    tenantHost: string,
    input: CreateSeriesInput,
): Promise<SeriesDetail> {
    return proxyRequest(
        '/api/proxy/series',
        tenantHost,
        jsonInit('POST', input),
        parseSeriesEnvelope,
        'Der Server hat eine ungültige Sendung gesendet.',
    )
}

export async function updateSeries(
    tenantHost: string,
    seriesId: number,
    input: UpdateSeriesInput,
): Promise<SeriesDetail> {
    return proxyRequest(
        `/api/proxy/series/${seriesId}`,
        tenantHost,
        jsonInit('PUT', input),
        parseSeriesEnvelope,
        'Der Server hat eine ungültige Sendung gesendet.',
    )
}

export async function confirmUpload(
    tenantHost: string,
    assetId: number,
): Promise<MediaAsset> {
    return proxyRequest(
        `/api/proxy/media/${assetId}/confirm`,
        tenantHost,
        {method: 'POST'},
        parseMediaAssetEnvelope,
        'Der Server hat ein ungültiges Medium gesendet.',
    )
}

export async function listMedia(tenantHost: string): Promise<MediaAsset[]> {
    return proxyRequest(
        '/api/proxy/media',
        tenantHost,
        undefined,
        parseMediaListEnvelope,
        'Der Server hat eine ungültige Medienliste gesendet.',
    )
}

export async function getMedia(
    tenantHost: string,
    assetId: number,
): Promise<MediaAsset> {
    return proxyRequest(
        `/api/proxy/media/${assetId}`,
        tenantHost,
        undefined,
        parseMediaAssetEnvelope,
        'Der Server hat ein ungültiges Medium gesendet.',
    )
}

export async function deleteMedia(
    tenantHost: string,
    assetId: number,
): Promise<MediaAsset> {
    return proxyRequest(
        `/api/proxy/media/${assetId}`,
        tenantHost,
        {method: 'DELETE'},
        parseMediaAssetEnvelope,
        'Der Server hat ein ungültiges Medium gesendet.',
    )
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
    return proxyRequest(
        `/api/proxy/tenant/products/${productId}/sync-stripe`,
        tenantHost,
        jsonInit('POST', {}),
        parseProductEnvelope,
        'Der Server hat ein ungültiges Produkt gesendet.',
    )
}

export async function listProducts(
    tenantHost: string,
): Promise<SubscriptionProduct[]> {
    return proxyRequest(
        '/api/proxy/tenant/products',
        tenantHost,
        undefined,
        parseProductListEnvelope,
        'Der Server hat eine ungültige Produktliste gesendet.',
    )
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
    return proxyRequest(
        '/api/proxy/tenant/products',
        tenantHost,
        jsonInit('POST', input),
        parseProductEnvelope,
        'Der Server hat ein ungültiges Produkt gesendet.',
    )
}

export async function updateProduct(
    tenantHost: string,
    productId: number,
    input: UpdateProductInput,
): Promise<SubscriptionProduct> {
    return proxyRequest(
        `/api/proxy/tenant/products/${productId}`,
        tenantHost,
        jsonInit('PUT', input),
        parseProductEnvelope,
        'Der Server hat ein ungültiges Produkt gesendet.',
    )
}

export async function deactivateProduct(
    tenantHost: string,
    productId: number,
): Promise<SubscriptionProduct> {
    return proxyRequest(
        `/api/proxy/tenant/products/${productId}`,
        tenantHost,
        {method: 'DELETE'},
        parseProductEnvelope,
        'Der Server hat ein ungültiges Produkt gesendet.',
    )
}

export async function listProductRules(
    tenantHost: string,
    productId: number,
): Promise<ProductAccessRule[]> {
    return proxyRequest(
        `/api/proxy/tenant/products/${productId}/rules`,
        tenantHost,
        undefined,
        parseProductRuleListEnvelope,
        'Der Server hat ungültige Produktregeln gesendet.',
    )
}

export async function replaceProductRules(
    tenantHost: string,
    productId: number,
    rules: ProductAccessRuleInput[],
): Promise<ProductAccessRule[]> {
    return proxyRequest(
        `/api/proxy/tenant/products/${productId}/rules`,
        tenantHost,
        jsonInit('PUT', {rules}),
        parseProductRuleListEnvelope,
        'Der Server hat ungültige Produktregeln gesendet.',
    )
}

export async function grantSubscription(
    tenantHost: string,
    input: GrantSubscriptionInput,
): Promise<SubscriptionGrant> {
    return proxyRequest(
        '/api/proxy/tenant/subscriptions',
        tenantHost,
        jsonInit('POST', input),
        parseSubscriptionGrantEnvelope,
        'Der Server hat eine ungültige Freischaltung gesendet.',
    )
}

export async function revokeSubscription(
    tenantHost: string,
    subscriptionId: number,
): Promise<SubscriptionGrant> {
    return proxyRequest(
        `/api/proxy/tenant/subscriptions/${subscriptionId}`,
        tenantHost,
        {method: 'DELETE'},
        parseSubscriptionGrantEnvelope,
        'Der Server hat eine ungültige Freischaltung gesendet.',
    )
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
    return proxyRequest(
        '/api/proxy/tenant/subscriber-feeds',
        tenantHost,
        undefined,
        parseSubscriberFeedAdminListEnvelope,
        'Der Server hat eine ungültige Feed-Liste gesendet.',
    )
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
    return proxyRequest(
        `/api/proxy/tenant/subscriber-feeds/${feedId}/enabled`,
        tenantHost,
        jsonInit('PUT', {enabled}),
        parseSubscriberFeedAdminEnvelope,
        'Der Server hat ein ungültiges Feed gesendet.',
    )
}

/**
 * Lists the formats available to the tenant.
 *
 * @param tenantHost - The tenant's host identifier
 * @returns The tenant's available format summaries
 */
export async function listFormats(tenantHost: string): Promise<FormatSummary[]> {
    return proxyRequest(
        '/api/proxy/formats',
        tenantHost,
        undefined,
        parseFormatListEnvelope,
        'Der Server hat eine ungültige Formatliste gesendet.',
    )
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
    return proxyRequest(
        '/api/proxy/categories',
        tenantHost,
        undefined,
        parseCategoryListEnvelope,
        'Der Server hat eine ungültige Kategorieliste gesendet.',
    )
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
