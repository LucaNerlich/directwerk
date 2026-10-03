import {
    isValidEmail,
    isValidPassword,
    PASSWORD_MAX_LENGTH,
    PASSWORD_MIN_LENGTH,
} from '@directwerk/api/validation/input'

import type {Dictionary} from '@/lib/i18n/dictionary'
import {interpolate} from '@/lib/i18n/interpolate'

/**
 * Inline field errors for the auth forms. Keys match input names so the focus
 * helper can resolve the first invalid field generically.
 */
export interface AuthFieldErrors {
    email?: string
    password?: string
    token?: string
    name?: string
}

type AuthMessages = Dictionary['auth']

/** Inline message for an e-mail input, or `undefined` when it is valid. */
export function emailFieldError(
    email: string,
    auth: AuthMessages,
): string | undefined {
    if (email.trim().length === 0) {
        return auth.emailRequired
    }
    if (!isValidEmail(email)) {
        return auth.emailInvalid
    }
    return undefined
}

/**
 * Inline message for the optional name input. Mirrors `parseRegisterInput`:
 * an omitted name is fine, a whitespace-only value is not.
 */
export function nameFieldError(
    name: string,
    auth: AuthMessages,
): string | undefined {
    if (name.length > 0 && name.trim().length === 0) {
        return auth.nameInvalid
    }
    return undefined
}

/** Inline message for a password input, or `undefined` when it is valid. */
export function passwordFieldError(
    password: string,
    auth: AuthMessages,
): string | undefined {
    if (password.length === 0) {
        return auth.passwordRequired
    }
    if (!isValidPassword(password)) {
        return interpolate(auth.passwordLength, {
            min: PASSWORD_MIN_LENGTH,
            max: PASSWORD_MAX_LENGTH,
        })
    }
    return undefined
}

/** Inline message for an invite/reset token input, or `undefined` when valid. */
export function tokenFieldError(
    token: string,
    auth: AuthMessages,
): string | undefined {
    if (token.trim().length === 0) {
        return auth.tokenRequired
    }
    return undefined
}

/** True when at least one field carries an error. */
export function hasFieldErrors(errors: AuthFieldErrors): boolean {
    return Object.values(errors).some((message) => message !== undefined)
}
