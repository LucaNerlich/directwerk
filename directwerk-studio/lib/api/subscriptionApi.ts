'use client'

import {parseBillingDashboardEnvelope, parseLevelListEnvelope, parseProductEnvelope, parseProductListEnvelope, parseProductRuleListEnvelope, parseStripeOnboardEnvelope, parseStripeStatusEnvelope, parseSubscriptionGrantEnvelope, parseSubscriberFeedAdminEnvelope, parseSubscriberFeedAdminListEnvelope, parseArticleFeedAdminEnvelope, parseArticleFeedAdminListEnvelope} from '@directwerk/api/validation/catalog'

import type {
    ArticleFeedAdminView,
    BillingDashboard,
    GrantSubscriptionInput,
    LevelSummary,
    ProductAccessRule,
    ProductAccessRuleInput,
    StripeStatus,
    SubscriberFeedAdminView,
    SubscriptionGrant,
    SubscriptionProduct,
    CreateProductInput,
    UpdateProductInput,
} from '@directwerk/api/types'
import {
    authenticatedRequest,
    jsonInit,
    request,
    studioGet,
    studioMutate,
} from './studioApiCore'

const invalidProductMessage = 'Der Server hat ein ungültiges Produkt gesendet.'
const invalidGrantMessage = 'Der Server hat eine ungültige Freischaltung gesendet.'
const invalidFeedMessage = 'Der Server hat ein ungültiges Feed gesendet.'

export async function getStripeStatus(tenantHost: string): Promise<StripeStatus> {
    return studioGet(
        '/api/proxy/tenant/stripe/status',
        tenantHost,
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
    return studioGet(
        '/api/proxy/tenant/billing/dashboard',
        tenantHost,
        parseBillingDashboardEnvelope,
        'Der Server hat ungültige Zahlungsdaten gesendet.',
    )
}

export async function syncProductStripe(
    tenantHost: string,
    productId: number,
): Promise<SubscriptionProduct> {
    return studioMutate(
        `/api/proxy/tenant/products/${productId}/sync-stripe`,
        tenantHost,
        jsonInit('POST', {}),
        parseProductEnvelope,
        invalidProductMessage,
    )
}

export async function listProducts(
    tenantHost: string,
): Promise<SubscriptionProduct[]> {
    return studioGet(
        '/api/proxy/tenant/products',
        tenantHost,
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
    return studioMutate(
        '/api/proxy/tenant/products',
        tenantHost,
        jsonInit('POST', input),
        parseProductEnvelope,
        invalidProductMessage,
    )
}

export async function updateProduct(
    tenantHost: string,
    productId: number,
    input: UpdateProductInput,
): Promise<SubscriptionProduct> {
    return studioMutate(
        `/api/proxy/tenant/products/${productId}`,
        tenantHost,
        jsonInit('PUT', input),
        parseProductEnvelope,
        invalidProductMessage,
    )
}

export async function deactivateProduct(
    tenantHost: string,
    productId: number,
): Promise<SubscriptionProduct> {
    return studioMutate(
        `/api/proxy/tenant/products/${productId}`,
        tenantHost,
        {method: 'DELETE'},
        parseProductEnvelope,
        invalidProductMessage,
    )
}

export async function listProductRules(
    tenantHost: string,
    productId: number,
): Promise<ProductAccessRule[]> {
    return studioGet(
        `/api/proxy/tenant/products/${productId}/rules`,
        tenantHost,
        parseProductRuleListEnvelope,
        'Der Server hat ungültige Produktregeln gesendet.',
    )
}

export async function replaceProductRules(
    tenantHost: string,
    productId: number,
    rules: ProductAccessRuleInput[],
): Promise<ProductAccessRule[]> {
    return studioMutate(
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
    return studioMutate(
        '/api/proxy/tenant/subscriptions',
        tenantHost,
        jsonInit('POST', input),
        parseSubscriptionGrantEnvelope,
        invalidGrantMessage,
    )
}

export async function revokeSubscription(
    tenantHost: string,
    subscriptionId: number,
): Promise<SubscriptionGrant> {
    return studioMutate(
        `/api/proxy/tenant/subscriptions/${subscriptionId}`,
        tenantHost,
        {method: 'DELETE'},
        parseSubscriptionGrantEnvelope,
        invalidGrantMessage,
    )
}

export async function listSubscriberFeeds(
    tenantHost: string,
): Promise<SubscriberFeedAdminView[]> {
    return studioGet(
        '/api/proxy/tenant/subscriber-feeds',
        tenantHost,
        parseSubscriberFeedAdminListEnvelope,
        'Der Server hat eine ungültige Feed-Liste gesendet.',
    )
}

export async function setSubscriberFeedEnabled(
    tenantHost: string,
    feedId: number,
    enabled: boolean,
): Promise<SubscriberFeedAdminView> {
    return studioMutate(
        `/api/proxy/tenant/subscriber-feeds/${feedId}/enabled`,
        tenantHost,
        jsonInit('PUT', {enabled}),
        parseSubscriberFeedAdminEnvelope,
        invalidFeedMessage,
    )
}

export async function listArticleFeeds(
    tenantHost: string,
): Promise<ArticleFeedAdminView[]> {
    return studioGet(
        '/api/proxy/tenant/article-feeds',
        tenantHost,
        parseArticleFeedAdminListEnvelope,
        'Der Server hat eine ungültige Feed-Liste gesendet.',
    )
}

export async function setArticleFeedEnabled(
    tenantHost: string,
    feedId: number,
    enabled: boolean,
): Promise<ArticleFeedAdminView> {
    return studioMutate(
        `/api/proxy/tenant/article-feeds/${feedId}/enabled`,
        tenantHost,
        jsonInit('PUT', {enabled}),
        parseArticleFeedAdminEnvelope,
        invalidFeedMessage,
    )
}
