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

