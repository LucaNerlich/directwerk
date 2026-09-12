import {
    isValidEmail,
    isValidPassword,
    PASSWORD_MAX_LENGTH,
    PASSWORD_MIN_LENGTH,
} from '@directwerk/api/validation/input'

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

/** Inline message for an e-mail input, or `undefined` when it is valid. */
export function emailFieldError(email: string): string | undefined {
    if (email.trim().length === 0) {
        return 'Bitte gib deine E-Mail-Adresse ein.'
    }
    if (!isValidEmail(email)) {
        return 'Bitte gib eine gültige E-Mail-Adresse ein.'
    }
    return undefined
}

/**
 * Inline message for the optional name input. Mirrors `parseRegisterInput`:
 * an omitted name is fine, a whitespace-only value is not.
 */
export function nameFieldError(name: string): string | undefined {
    if (name.length > 0 && name.trim().length === 0) {
        return 'Bitte gib einen Namen ein oder lasse das Feld leer.'
    }
    return undefined
}

/** Inline message for a password input, or `undefined` when it is valid. */
export function passwordFieldError(password: string): string | undefined {
    if (password.length === 0) {
        return 'Bitte gib ein Passwort ein.'
    }
    if (!isValidPassword(password)) {
        return `Das Passwort muss zwischen ${PASSWORD_MIN_LENGTH} und ${PASSWORD_MAX_LENGTH} Zeichen lang sein.`
    }
    return undefined
}

/** Inline message for an invite/reset token input, or `undefined` when valid. */
export function tokenFieldError(token: string): string | undefined {
    if (token.trim().length === 0) {
        return 'Bitte gib das Token ein.'
    }
    return undefined
}

/** True when at least one field carries an error. */
export function hasFieldErrors(errors: AuthFieldErrors): boolean {
    return Object.values(errors).some((message) => message !== undefined)
}
