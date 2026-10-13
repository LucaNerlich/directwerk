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

/** Options for {@link passwordFieldError}. */
export interface PasswordFieldOptions {
    /**
     * When `false`, only require a non-empty value within the max length instead of the
     * registration policy — used by the login form (#301).
     */
    enforcePolicy?: boolean
}

/** Inline message for a password input, or `undefined` when it is valid. */
export function passwordFieldError(
    password: string,
    auth: AuthMessages,
    options: PasswordFieldOptions = {},
): string | undefined {
    if (password.length === 0) {
        return auth.passwordRequired
    }
    // Signing in must not enforce the *registration* password policy (#301): an existing
    // account may hold a valid 8-11 character password that the backend still accepts.
    const valid = options.enforcePolicy === false
        ? password.length <= PASSWORD_MAX_LENGTH
        : isValidPassword(password)
    if (!valid) {
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
