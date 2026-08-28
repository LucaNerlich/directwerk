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

export async function listFormats(tenantHost: string): Promise<FormatSummary[]> {
    return proxyRequest(
        '/api/proxy/formats',
        tenantHost,
        undefined,
        parseFormatListEnvelope,
        'Der Server hat eine ungültige Formatliste gesendet.',
    )
}

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
