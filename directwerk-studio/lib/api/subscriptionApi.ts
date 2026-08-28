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

/** Unauthenticated; results are sorted by sortOrder ascending. */
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

export async function listSubscriberFeeds(
    tenantHost: string,
): Promise<SubscriberFeedAdminView[]> {
    return proxyRequest(
        '/api/proxy/tenant/subscriber-feeds',
        tenantHost,
        undefined,
        parseSubscriberFeedAdminListEnvelope,
        'Der Server hat eine ungültige Feed-Liste gesendet.',
    )
}

export async function setSubscriberFeedEnabled(
    tenantHost: string,
    feedId: number,
    enabled: boolean,
): Promise<SubscriberFeedAdminView> {
    return proxyRequest(
        `/api/proxy/tenant/subscriber-feeds/${feedId}/enabled`,
        tenantHost,
        jsonInit('PUT', {enabled}),
        parseSubscriberFeedAdminEnvelope,
        'Der Server hat ein ungültiges Feed gesendet.',
    )
}

