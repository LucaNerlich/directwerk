import {AUTH_REQUIRED} from '@directwerk/api/constants'
import {apiErrorCode} from '@directwerk/api/envelope'

const FEATURE_NOT_ENABLED = 'FEATURE_NOT_ENABLED'

const FEATURE_DISABLED_COPY: Record<UserFacingErrorContext, string> = {
    checkout:
        'Abos sind bei diesem Anbieter deaktiviert. Wende dich für Zugang an die Redaktion.',
    portal:
        'Abos sind bei diesem Anbieter deaktiviert. Wende dich für Zugang an die Redaktion.',
    feeds: 'Private Feeds sind bei diesem Anbieter deaktiviert.',
    downloads: 'Bonusdateien sind bei diesem Anbieter deaktiviert.',
    account:
        'Mitgliedschaften sind bei diesem Anbieter deaktiviert. Profil, Zugang und Feeds bleiben verfügbar.',
    preferences:
        'Einstellungen konnten nicht gespeichert werden. Bitte versuche es später erneut.',
    general: 'Diese Funktion ist bei diesem Anbieter deaktiviert.',
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

const FALLBACK_COPY: Record<UserFacingErrorContext, string> = {
    checkout:
        'Checkout ist noch nicht verfügbar. Bitte versuche es später erneut.',
    portal: 'Kundenportal konnte nicht geöffnet werden. Bitte versuche es später erneut.',
    feeds: 'Feeds konnten nicht geladen werden. Bitte versuche es später erneut.',
    downloads:
        'Bonusdateien konnten nicht geladen werden. Bitte versuche es später erneut.',
    account: 'Konto konnte nicht geladen werden. Bitte versuche es später erneut.',
    preferences:
        'Einstellungen konnten nicht gespeichert werden. Bitte versuche es später erneut.',
    general: 'Etwas ist schiefgelaufen. Bitte versuche es später erneut.',
}

function isApprovedStripeUnavailableMessage(message: string): boolean {
    return STRIPE_UNAVAILABLE_MESSAGES.some((pattern) => pattern.test(message))
}

/**
 * Maps API billing errors to subscriber-friendly German copy.
 *
 * Raw backend/transport messages never reach the UI. Only explicitly approved
 * Stripe codes/messages select fixed copy; everything else fails closed to the
 * per-context fallback.
 */
export function userFacingBillingError(
    error: unknown,
    context: UserFacingErrorContext,
): string {
    const fallback = FALLBACK_COPY[context] ?? FALLBACK_COPY.general
    if (!(error instanceof Error)) {
        if (context === 'checkout') {
            return 'Online-Zahlung ist noch nicht aktiv. Du kannst das Produkt merken und später zurückkommen — oder die Redaktion schaltet dich im Studio frei.'
        }
        if (context === 'portal') {
            return 'Stripe ist auf diesem Server noch nicht eingerichtet.'
        }
        return fallback
    }

    const message = error.message.trim()
    if (message === '' || message === AUTH_REQUIRED) {
        return fallback
    }
    if (apiErrorCode(error) === FEATURE_NOT_ENABLED) {
        return FEATURE_DISABLED_COPY[context] ?? FALLBACK_COPY.general
    }
    if (
        STRIPE_UNAVAILABLE_CODES.has(message) ||
        isApprovedStripeUnavailableMessage(message)
    ) {
        if (context === 'checkout') {
            return 'Online-Zahlung ist noch nicht aktiv. Du kannst das Produkt merken und später zurückkommen — oder die Redaktion schaltet dich im Studio frei.'
        }
        if (context === 'portal') {
            return 'Stripe ist auf diesem Server noch nicht eingerichtet.'
        }
        return fallback
    }

    return fallback
}

/** Feed actions (rotate/toggle/preview/save) share one German fallback style. */
export function userFacingFeedsError(error: unknown): string {
    return userFacingBillingError(error, 'feeds')
}

/** Bonus-file list + download errors. */
export function userFacingDownloadsError(error: unknown): string {
    return userFacingBillingError(error, 'downloads')
}

/** Account/profile/access errors. */
export function userFacingAccountError(error: unknown): string {
    return userFacingBillingError(error, 'account')
}

/**
 * Generic German mapping with a caller-provided fallback.
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

const AUTH_FALLBACK_COPY: Record<UserFacingAuthContext, string> = {
    login: 'Anmeldung fehlgeschlagen. Bitte prüfe deine Eingaben und versuche es erneut.',
    register:
        'Registrierung fehlgeschlagen. Bitte prüfe deine Eingaben und versuche es erneut.',
    forgot:
        'Der Reset-Link konnte nicht angefordert werden. Bitte versuche es später erneut.',
    reset: 'Das Passwort konnte nicht zurückgesetzt werden. Bitte versuche es erneut.',
    invite: 'Die Einladung konnte nicht angenommen werden. Bitte versuche es erneut.',
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
 * Maps auth-form API errors to subscriber-friendly German copy.
 *
 * Known backend failures (wrong credentials, rate limits, expired links, and
 * taken emails) become fixed German strings; all unrecognized messages fail
 * closed to the per-context fallback.
 */
export function userFacingAuthError(
    error: unknown,
    context: UserFacingAuthContext,
): string {
    const fallback = AUTH_FALLBACK_COPY[context]
    if (!(error instanceof Error)) {
        return fallback
    }

    const message = error.message.trim()
    if (message.length === 0 || message === AUTH_REQUIRED) {
        return context === 'login' || context === 'register'
            ? 'Sitzung abgelaufen — bitte erneut versuchen.'
            : fallback
    }

    if (matchesAuthPattern(message, INVALID_GRANT_PATTERNS)) {
        return context === 'login'
            ? 'E-Mail oder Passwort falsch. Prüfe deine Eingaben oder fordere einen Reset-Link an.'
            : fallback
    }

    if (matchesAuthPattern(message, RATE_LIMIT_PATTERNS)) {
        return 'Zu viele Versuche. Bitte warte einen Moment und versuche es erneut.'
    }

    if (matchesAuthPattern(message, EMAIL_TAKEN_PATTERNS)) {
        return context === 'register'
            ? 'Diese E-Mail ist bereits registriert. Melde dich an oder fordere einen Reset-Link an.'
            : fallback
    }

    if (
        (context === 'reset' || context === 'invite' || context === 'forgot') &&
        (matchesAuthPattern(message, EXPIRED_LINK_PATTERNS) ||
            matchesAuthPattern(message, INVALID_TOKEN_PATTERNS))
    ) {
        return 'Der Link ist abgelaufen oder ungültig. Bitte fordere einen neuen Link an.'
    }

    return fallback
}
