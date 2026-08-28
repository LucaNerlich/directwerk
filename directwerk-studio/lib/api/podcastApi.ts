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
    SubscriberFeedAdminView,
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
import {
    authenticatedRequest,
    jsonInit,
    postJson,
    proxyRequest,
    request,
} from './transport'

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

