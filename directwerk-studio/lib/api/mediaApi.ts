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

