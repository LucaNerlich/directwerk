import {AUTH_REQUIRED} from '@directwerk/api/constants'
import {apiErrorCode} from '@directwerk/api/envelope'

import type {Dictionary} from '@/lib/i18n/dictionary'

const FEATURE_NOT_ENABLED = 'FEATURE_NOT_ENABLED'

type ErrorCopy = Dictionary['errors']

const FEATURE_DISABLED_KEYS: Record<
    UserFacingErrorContext,
    keyof ErrorCopy
> = {
    checkout: 'billingCheckoutDisabled',
    portal: 'billingPortalDisabled',
    feeds: 'billingFeedsDisabled',
    downloads: 'billingDownloadsDisabled',
    account: 'billingAccountDisabled',
    preferences: 'billingPreferences',
    general: 'billingFeatureDisabled',
}

const STRIPE_UNAVAILABLE_CODES = new Set([
    'STRIPE_NOT_IMPLEMENTED',
    'STRIPE_NOT_CONNECTED',
])

const STRIPE_UNAVAILABLE_MESSAGES: RegExp[] = [
    /^Stripe checkout is not implemented yet for product=[a-z0-9-]+$/i,
    /^Stripe customer portal is not configured$/i,
    /^Stripe Connect onboarding is not implemented yet\.$/i,
    /^Stripe Connect is not connected$/i,
    /^Stripe Connect cannot take charges yet$/i,
    /^No Stripe customer exists for this member$/i,
]

export type UserFacingErrorContext =
    | 'checkout'
    | 'portal'
    | 'feeds'
    | 'downloads'
    | 'account'
    | 'preferences'
    | 'general'

const FALLBACK_KEYS: Record<UserFacingErrorContext, keyof ErrorCopy> = {
    checkout: 'billingCheckout',
    portal: 'billingPortal',
    feeds: 'billingFeeds',
    downloads: 'billingDownloads',
    account: 'billingAccount',
    preferences: 'billingPreferences',
    general: 'billingGeneral',
}

function isApprovedStripeUnavailableMessage(message: string): boolean {
    return STRIPE_UNAVAILABLE_MESSAGES.some((pattern) => pattern.test(message))
}

/**
 * Maps API billing errors to subscriber-friendly localized copy.
 *
 * Raw backend/transport messages never reach the UI. Only explicitly approved
 * Stripe codes/messages select fixed copy; everything else fails closed to the
 * per-context fallback.
 */
export function userFacingBillingError(
    error: unknown,
    context: UserFacingErrorContext,
    errors: ErrorCopy,
): string {
    const fallback = errors[FALLBACK_KEYS[context]] ?? errors.billingGeneral
    if (!(error instanceof Error)) {
        if (context === 'checkout') {
            return errors.billingStripeCheckoutInactive
        }
        if (context === 'portal') {
            return errors.billingStripePortalNotConfigured
        }
        return fallback
    }

    const message = error.message.trim()
    if (message === '' || message === AUTH_REQUIRED) {
        return fallback
    }
    if (apiErrorCode(error) === FEATURE_NOT_ENABLED) {
        return errors[FEATURE_DISABLED_KEYS[context]] ?? errors.billingFeatureDisabled
    }
    if (
        STRIPE_UNAVAILABLE_CODES.has(message) ||
        isApprovedStripeUnavailableMessage(message)
    ) {
        if (context === 'checkout') {
            return errors.billingStripeCheckoutInactive
        }
        if (context === 'portal') {
            return errors.billingStripePortalNotConfigured
        }
        return fallback
    }

    return fallback
}

/** Feed actions (rotate/toggle/preview/save) share one fallback style. */
export function userFacingFeedsError(error: unknown, errors: ErrorCopy): string {
    return userFacingBillingError(error, 'feeds', errors)
}

/** Bonus-file list + download errors. */
export function userFacingDownloadsError(
    error: unknown,
    errors: ErrorCopy,
): string {
    return userFacingBillingError(error, 'downloads', errors)
}

/** Account/profile/access errors. */
export function userFacingAccountError(
    error: unknown,
    errors: ErrorCopy,
): string {
    return userFacingBillingError(error, 'account', errors)
}

/**
 * Generic mapping with a caller-provided fallback.
 * Backend messages never reach the UI.
 */
export function userFacingGeneralError(error: unknown, fallback: string): string {
    if (!(error instanceof Error)) {
        return fallback
    }
    return fallback
}

// ---------------------------------------------------------------------------
// Auth forms (login / register / forgot / reset / invite)
// ---------------------------------------------------------------------------

export type UserFacingAuthContext =
    | 'login'
    | 'register'
    | 'forgot'
    | 'reset'
    | 'invite'

const AUTH_FALLBACK_KEYS: Record<UserFacingAuthContext, keyof ErrorCopy> = {
    login: 'authLogin',
    register: 'authRegister',
    forgot: 'authForgot',
    reset: 'authReset',
    invite: 'authInvite',
}

const INVALID_GRANT_PATTERNS: RegExp[] = [
    /invalid_grant/i,
    /invalid credentials/i,
    /^INVALID_CREDENTIALS$/,
]

const RATE_LIMIT_PATTERNS: RegExp[] = [
    /rate.?limit/i,
    /too many requests/i,
    /\b429\b/,
    /zu viele versuche/i,
]

const EMAIL_TAKEN_PATTERNS: RegExp[] = [
    /^CONFLICT$/,
    /already (registered|exists|taken|in use)/i,
    /bereits registriert/i,
    /email .*(taken|exists|already)/i,
]

const EXPIRED_LINK_PATTERNS: RegExp[] = [/expired/i, /abgelaufen/i]

const INVALID_TOKEN_PATTERNS: RegExp[] = [
    /invalid.*token/i,
    /token.*(invalid|unknown|not found)/i,
    /ungültig/i,
]

function matchesAuthPattern(message: string, patterns: RegExp[]): boolean {
    return patterns.some((pattern) => pattern.test(message))
}

/**
 * Maps auth-form API errors to subscriber-friendly localized copy.
 */
export function userFacingAuthError(
    error: unknown,
    context: UserFacingAuthContext,
    errors: ErrorCopy,
): string {
    const fallback = errors[AUTH_FALLBACK_KEYS[context]]
    if (!(error instanceof Error)) {
        return fallback
    }

    const message = error.message.trim()
    if (message.length === 0 || message === AUTH_REQUIRED) {
        return context === 'login' || context === 'register'
            ? errors.authSessionExpired
            : fallback
    }

    if (matchesAuthPattern(message, INVALID_GRANT_PATTERNS)) {
        return context === 'login' ? errors.authInvalidCredentials : fallback
    }

    if (matchesAuthPattern(message, RATE_LIMIT_PATTERNS)) {
        return errors.authRateLimit
    }

    if (matchesAuthPattern(message, EMAIL_TAKEN_PATTERNS)) {
        return context === 'register' ? errors.authEmailTaken : fallback
    }

    if (
        (context === 'reset' || context === 'invite' || context === 'forgot') &&
        (matchesAuthPattern(message, EXPIRED_LINK_PATTERNS) ||
            matchesAuthPattern(message, INVALID_TOKEN_PATTERNS))
    ) {
        return errors.authLinkExpired
    }

    return fallback
}
