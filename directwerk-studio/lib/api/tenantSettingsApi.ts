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

