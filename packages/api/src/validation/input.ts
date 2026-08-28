import {isRecord} from './primitives'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PASSWORD_LENGTH = 12
const MAX_PASSWORD_LENGTH = 128
const MAX_EMAIL_LENGTH = 254

export interface LoginInput {
    email: string
    password: string
}

export interface RefreshTokenInput {
    refresh_token: string
}

function parseEmail(value: unknown, normalize: boolean): string | null {
    if (typeof value !== 'string') {
        return null
    }

    const email = normalize ? value.trim().toLowerCase() : value
    if (
        email.length === 0 ||
        email.length > MAX_EMAIL_LENGTH ||
        !EMAIL_PATTERN.test(email)
    ) {
        return null
    }

    return email
}

function parsePassword(value: unknown): string | null {
    if (
        typeof value !== 'string' ||
        value.length < MIN_PASSWORD_LENGTH ||
        value.length > MAX_PASSWORD_LENGTH
    ) {
        return null
    }

    return value
}

export interface LoginInputOptions {
    /**
     * Trim + lowercase the email before validation
     * (directwerk-web behaviour; studio keeps the raw value).
     */
    normalizeEmail?: boolean
}

/** Validates a login body for the BFF `/api/auth/login` route. */
export function parseLoginInput(
    value: unknown,
    options: LoginInputOptions = {},
): LoginInput | null {
    if (!isRecord(value)) {
        return null
    }

    const email = parseEmail(value.email, options.normalizeEmail === true)
    const password = parsePassword(value.password)
    if (email === null || password === null) {
        return null
    }

    return {email, password}
}

export interface RefreshTokenInputOptions {
    /** Maximum refresh-token length. Studio allows 8192, web 512. */
    maxLength?: number
    /**
     * Trim surrounding whitespace instead of rejecting any whitespace.
     * Web trims (migration fallback), studio rejects whitespace outright.
     */
    trim?: boolean
}

/**
 * Validates a legacy JSON-body refresh token for the BFF refresh route.
 * The httpOnly cookie is preferred; this is only the migration fallback.
 */
export function parseRefreshTokenInput(
    value: unknown,
    options: RefreshTokenInputOptions = {},
): RefreshTokenInput | null {
    if (!isRecord(value) || typeof value.refresh_token !== 'string') {
        return null
    }

    const maxLength = options.maxLength ?? 8192
    if (options.trim === true) {
        const refreshToken = value.refresh_token.trim()
        if (refreshToken.length === 0 || refreshToken.length > maxLength) {
            return null
        }
        return {refresh_token: refreshToken}
    }

    const refreshToken = value.refresh_token
    if (
        refreshToken.length === 0 ||
        refreshToken.length > maxLength ||
        /\s/.test(refreshToken)
    ) {
        return null
    }

    return {refresh_token: refreshToken}
}

// ---------------------------------------------------------------------------
// Subscriber self-service inputs (directwerk-web BFF routes)
// ---------------------------------------------------------------------------

const MAX_NAME_LENGTH = 255
const MAX_TOKEN_LENGTH_WEB = 512

export interface RegisterInput extends LoginInput {
    name?: string
}

export interface AcceptInviteInput {
    token: string
    password: string
    name?: string
}

export interface ForgotPasswordInput {
    email: string
}

export interface ResetPasswordInput {
    token: string
    newPassword: string
}

function parseCredentialsWithNormalizedName(value: unknown): LoginInput | null {
    if (!isRecord(value)) {
        return null
    }

    const email = parseEmail(value.email, true)
    if (
        typeof value.password !== 'string' ||
        value.password.length < MIN_PASSWORD_LENGTH ||
        value.password.length > MAX_PASSWORD_LENGTH ||
        email === null
    ) {
        return null
    }

    return {email, password: value.password}
}

/** Validates a registration body. */
export function parseRegisterInput(value: unknown): RegisterInput | null {
    const credentials = parseCredentialsWithNormalizedName(value)
    if (credentials === null || !isRecord(value)) {
        return null
    }

    if (value.name === undefined) {
        return credentials
    }

    if (typeof value.name !== 'string') {
        return null
    }

    const name = value.name.trim()
    if (name.length === 0 || name.length > MAX_NAME_LENGTH) {
        return null
    }

    return {...credentials, name}
}

function parseOptionalName(value: unknown): string | undefined | null {
    if (!isRecord(value) || value.name === undefined) {
        return undefined
    }

    if (typeof value.name !== 'string') {
        return null
    }

    const name = value.name.trim()
    if (name.length === 0 || name.length > MAX_NAME_LENGTH) {
        return null
    }

    return name
}

/** Validates an invite-acceptance body. */
export function parseAcceptInviteInput(value: unknown): AcceptInviteInput | null {
    if (!isRecord(value)) {
        return null
    }
    if (typeof value.token !== 'string' || typeof value.password !== 'string') {
        return null
    }

    const token = value.token.trim()
    if (
        token.length === 0 ||
        token.length > MAX_TOKEN_LENGTH_WEB ||
        value.password.length < MIN_PASSWORD_LENGTH ||
        value.password.length > MAX_PASSWORD_LENGTH
    ) {
        return null
    }

    const name = parseOptionalName(value)
    if (name === null) {
        return null
    }

    return name === undefined
        ? {token, password: value.password}
        : {token, password: value.password, name}
}

/** Validates a forgot-password body. */
export function parseForgotPasswordInput(value: unknown): ForgotPasswordInput | null {
    if (!isRecord(value) || typeof value.email !== 'string') {
        return null
    }

    const email = value.email.trim().toLowerCase()
    if (email.length === 0 || email.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(email)) {
        return null
    }

    return {email}
}

/** Validates a reset-password body. */
export function parseResetPasswordInput(value: unknown): ResetPasswordInput | null {
    if (!isRecord(value)) {
        return null
    }
    if (typeof value.token !== 'string' || typeof value.newPassword !== 'string') {
        return null
    }

    const token = value.token.trim()
    if (
        token.length === 0 ||
        token.length > MAX_TOKEN_LENGTH_WEB ||
        value.newPassword.length < MIN_PASSWORD_LENGTH ||
        value.newPassword.length > MAX_PASSWORD_LENGTH
    ) {
        return null
    }

    return {token, newPassword: value.newPassword}
}
