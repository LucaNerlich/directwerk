import type {TokenResponse} from '../types'
import {isBoundedString, isRecord} from './primitives'

/**
 * Validates an OAuth token payload: bounded, whitespace-free `access_token`,
 * optional bounded `refresh_token`, optional non-negative finite
 * `expires_in`.
 */
export function parseTokenResponse(value: unknown): TokenResponse | null {
    if (
        !isRecord(value) ||
        !isBoundedString(value.access_token, 8192) ||
        value.access_token.length === 0 ||
        /\s/.test(value.access_token)
    ) {
        return null
    }

    if (
        value.refresh_token !== undefined &&
        (!isBoundedString(value.refresh_token, 8192) ||
            value.refresh_token.length === 0 ||
            /\s/.test(value.refresh_token))
    ) {
        return null
    }

    if (
        value.expires_in !== undefined &&
        (typeof value.expires_in !== 'number' ||
            !Number.isFinite(value.expires_in) ||
            value.expires_in < 0)
    ) {
        return null
    }

    return {
        access_token: value.access_token,
        ...(value.refresh_token === undefined
            ? {}
            : {refresh_token: value.refresh_token}),
        ...(value.expires_in === undefined ? {} : {expires_in: value.expires_in}),
    }
}
