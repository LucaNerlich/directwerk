import {AUTH_REQUIRED} from '@directwerk/api/constants'

const STRIPE_UNAVAILABLE_CODES = new Set([
    'STRIPE_NOT_IMPLEMENTED',
    'STRIPE_NOT_CONNECTED',
])

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

const TECHNICAL_PATTERNS: RegExp[] = [
    /the server returned/i,
    /failed to fetch/i,
    /network\s?error/i,
    /unexpected .*response/i,
    /\btypeerror\b/i,
    /\breferenceerror\b/i,
    /\bsyntaxerror\b/i,
    /invalid json/i,
    /http\s?\d{3}/i,
    /status\s?\d{3}/i,
    /\b5\d\d\b/,
    /could not/i,
    /cannot (read|parse|fetch|load)/i,
    /not implemented/i,
    /internal server error/i,
    /bad gateway/i,
    /service unavailable/i,
    /gateway timeout/i,
    /invalid .*envelope/i,
    /invalid token response/i,
    /invalid .*preferences/i,
    /invalid .*list/i,
    /invalid account response/i,
    /invalid access response/i,
    /invalid feed/i,
    /invalid download/i,
    /invalid preview/i,
    /fetch failed/i,
    /load failed/i,
]

const BACKEND_CODE_PATTERN = /^[A-Z][A-Z0-9_]{3,}$/

function isTechnicalMessage(message: string): boolean {
    const trimmed = message.trim()
    if (trimmed.length === 0) {
        return true
    }
    if (BACKEND_CODE_PATTERN.test(trimmed)) {
        return true
    }
    return TECHNICAL_PATTERNS.some((pattern) => pattern.test(trimmed))
}

/**
 * Maps API billing errors to subscriber-friendly German copy.
 *
 * Raw backend/transport errors (English, HTTP codes, UPPER_SNAKE codes)
 * never reach the UI — they fall back to per-context German copy.
 * Already-German messages pass through unchanged.
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
    if (
        STRIPE_UNAVAILABLE_CODES.has(message) ||
        message.toLowerCase().includes('not implemented')
    ) {
        if (context === 'checkout') {
            return 'Online-Zahlung ist noch nicht aktiv. Du kannst das Produkt merken und später zurückkommen — oder die Redaktion schaltet dich im Studio frei.'
        }
        if (context === 'portal') {
            return 'Stripe ist auf diesem Server noch nicht eingerichtet.'
        }
        return fallback
    }

    if (isTechnicalMessage(message)) {
        return fallback
    }

    return message
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
 * Technical/English backend messages never reach the UI.
 */
export function userFacingGeneralError(error: unknown, fallback: string): string {
    if (!(error instanceof Error)) {
        return fallback
    }
    const message = error.message.trim()
    if (message === '' || message === AUTH_REQUIRED) {
        return fallback
    }
    if (isTechnicalMessage(message)) {
        return fallback
    }
    return message
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

/**
 * English/technical transport and backend messages that must never reach the
 * German UI untranslated — they fall back to per-context German copy.
 */
const AUTH_TECHNICAL_PATTERNS: RegExp[] = [
    /request failed with status/i,
    /temporarily unreachable/i,
    /invalid response/i,
    /upstream service/i,
    /failed to fetch/i,
    /network/i,
    /invalid token response/i,
    /invalid .*envelope/i,
    /http\s?\d{3}/i,
    /\b5\d\d\b/,
    /could not/i,
    /must be/i,
    /\brequired\b/i,
    /\bunauthorized\b/i,
    /\bforbidden\b/i,
    /\bnot found\b/i,
    /\binternal\b/i,
    /\bfailure\b/i,
    /^VALIDATION_ERROR$/,
    /^REQUEST_FAILED$/,
]

function matchesAuthPattern(message: string, patterns: RegExp[]): boolean {
    return patterns.some((pattern) => pattern.test(message))
}

/**
 * Maps auth-form API errors to subscriber-friendly German copy.
 *
 * Known backend/transport failures (wrong credentials, rate limits, expired
 * links, taken emails, English technical messages) become fixed German
 * strings; already-German messages pass through unchanged.
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

    if (matchesAuthPattern(message, AUTH_TECHNICAL_PATTERNS)) {
        return fallback
    }

    return message
}
