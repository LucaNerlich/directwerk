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

export async function getStripeStatus(): Promise<StripeStatus> {
    return studioGet(
        '/api/proxy/tenant/stripe/status',
        
        parseStripeStatusEnvelope,
        'Der Server hat ungültigen Stripe-Status gesendet.',
    )
}

export async function startStripeOnboard(
    returnUrl: string,
    refreshUrl: string,
): Promise<string> {
    const url = parseStripeOnboardEnvelope(
        await authenticatedRequest('/api/proxy/tenant/stripe/onboard', '', {
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

export async function getBillingDashboard(): Promise<BillingDashboard> {
    return studioGet(
        '/api/proxy/tenant/billing/dashboard',
        
        parseBillingDashboardEnvelope,
        'Der Server hat ungültige Zahlungsdaten gesendet.',
    )
}

export async function syncProductStripe(
        productId: number,
): Promise<SubscriptionProduct> {
    return studioMutate(
        `/api/proxy/tenant/products/${productId}/sync-stripe`,
        
        jsonInit('POST', {}),
        parseProductEnvelope,
        invalidProductMessage,
    )
}

export async function listProducts(
    ): Promise<SubscriptionProduct[]> {
    return studioGet(
        '/api/proxy/tenant/products',
        
        parseProductListEnvelope,
        'Der Server hat eine ungültige Produktliste gesendet.',
    )
}

/** Unauthenticated; results are sorted by sortOrder ascending. */
export async function listPublicLevels(): Promise<LevelSummary[]> {
    const parsed = parseLevelListEnvelope(
        await request('/api/proxy/public/levels', ''),
    )
    if (parsed === null) {
        throw new Error('Der Server hat eine ungültige Stufenliste gesendet.')
    }

    return parsed.data
}

export async function createProduct(
        input: CreateProductInput,
): Promise<SubscriptionProduct> {
    return studioMutate(
        '/api/proxy/tenant/products',
        
        jsonInit('POST', input),
        parseProductEnvelope,
        invalidProductMessage,
    )
}

export async function updateProduct(
        productId: number,
    input: UpdateProductInput,
): Promise<SubscriptionProduct> {
    return studioMutate(
        `/api/proxy/tenant/products/${productId}`,
        
        jsonInit('PUT', input),
        parseProductEnvelope,
        invalidProductMessage,
    )
}

export async function deactivateProduct(
        productId: number,
): Promise<SubscriptionProduct> {
    return studioMutate(
        `/api/proxy/tenant/products/${productId}`,
        
        {method: 'DELETE'},
        parseProductEnvelope,
        invalidProductMessage,
    )
}

export async function listProductRules(
        productId: number,
): Promise<ProductAccessRule[]> {
    return studioGet(
        `/api/proxy/tenant/products/${productId}/rules`,
        
        parseProductRuleListEnvelope,
        'Der Server hat ungültige Produktregeln gesendet.',
    )
}

export async function replaceProductRules(
        productId: number,
    rules: ProductAccessRuleInput[],
): Promise<ProductAccessRule[]> {
    return studioMutate(
        `/api/proxy/tenant/products/${productId}/rules`,
        
        jsonInit('PUT', {rules}),
        parseProductRuleListEnvelope,
        'Der Server hat ungültige Produktregeln gesendet.',
    )
}

export async function grantSubscription(
        input: GrantSubscriptionInput,
): Promise<SubscriptionGrant> {
    return studioMutate(
        '/api/proxy/tenant/subscriptions',
        
        jsonInit('POST', input),
        parseSubscriptionGrantEnvelope,
        invalidGrantMessage,
    )
}

export async function revokeSubscription(
        subscriptionId: number,
): Promise<SubscriptionGrant> {
    return studioMutate(
        `/api/proxy/tenant/subscriptions/${subscriptionId}`,
        
        {method: 'DELETE'},
        parseSubscriptionGrantEnvelope,
        invalidGrantMessage,
    )
}

export async function listSubscriberFeeds(
    ): Promise<SubscriberFeedAdminView[]> {
    return studioGet(
        '/api/proxy/tenant/subscriber-feeds',
        
        parseSubscriberFeedAdminListEnvelope,
        'Der Server hat eine ungültige Feed-Liste gesendet.',
    )
}

export async function setSubscriberFeedEnabled(
        feedId: number,
    enabled: boolean,
): Promise<SubscriberFeedAdminView> {
    return studioMutate(
        `/api/proxy/tenant/subscriber-feeds/${feedId}/enabled`,
        
        jsonInit('PUT', {enabled}),
        parseSubscriberFeedAdminEnvelope,
        invalidFeedMessage,
    )
}

export async function listArticleFeeds(
    ): Promise<ArticleFeedAdminView[]> {
    return studioGet(
        '/api/proxy/tenant/article-feeds',
        
        parseArticleFeedAdminListEnvelope,
        'Der Server hat eine ungültige Feed-Liste gesendet.',
    )
}

export async function setArticleFeedEnabled(
        feedId: number,
    enabled: boolean,
): Promise<ArticleFeedAdminView> {
    return studioMutate(
        `/api/proxy/tenant/article-feeds/${feedId}/enabled`,
        
        jsonInit('PUT', {enabled}),
        parseArticleFeedAdminEnvelope,
        invalidFeedMessage,
    )
}
