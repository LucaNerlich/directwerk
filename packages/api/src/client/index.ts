import type {ErrorMessageCatalog} from '../envelope'
import {extractApiErrorMessage} from '../envelope'

/**
 * Browser-side authenticated request loop shared by all three frontends.
 *
 * One factory covers the three historically drifted variants:
 * - directwerk-studio (`tenantApi.authenticatedRequest`): keeps tokens on a
 *   final 401 and surfaces the server-provided localized message;
 *   transient refresh failures use a localized "unreachable" message.
 * - directwerk-web (`api/client.authenticatedRequest`): clears tokens and
 *   throws `AUTH_REQUIRED` on a final 401.
 * - directwerk-admin (`platformRequest` / `tenantRequest`): maps every auth
 *   failure to `AUTH_REQUIRED`, distinguishes 403/409 via `statusErrors`,
 *   returns `null` for 204/205 and unwraps `{data}` envelopes.
 */

export interface AuthedRequestSession {
    getValidAccessToken(): Promise<string>
    refreshAccessToken(): Promise<string>
}

export interface AuthedRequestConfig {
    session: AuthedRequestSession
    clearTokens(): void

    /**
     * Extra headers added to every request (e.g. `X-Tenant-Host`). Evaluated
     * per call so it can read current state.
     */
    baseHeaders?: () => Record<string, string>

    /**
     * How refresh/token-acquisition failures are surfaced:
     * - `'preserve-transient'`: definitive failures rethrow as-is; everything
     *   else becomes {@link AuthedRequestConfig.transientMessage} (studio/web).
     * - `'auth-required'`: every failure becomes `AUTH_REQUIRED` after
     *   clearing tokens (admin).
     */
    authFailureMode: 'preserve-transient' | 'auth-required'
    /** Message used for transient refresh failures in `preserve-transient` mode. */
    transientMessage?: string

    /**
     * Behaviour when a retried request still answers 401:
     * - `'localized-error'`: keep tokens, throw the structured error message
     *   (authorization failure, not authentication).
     * - `'clear-and-auth-required'`: clear tokens and throw `AUTH_REQUIRED`.
     */
    finalUnauthorized: 'localized-error' | 'clear-and-auth-required'

    /** Catalog used to extract user-facing messages from error bodies. */
    catalog?: ErrorMessageCatalog
    /** Message thrown when a response is not JSON (extract mode only). */
    invalidResponseMessage?: string

    /**
     * Fixed messages per status code, checked before generic error handling
     * (admin: `403 → FORBIDDEN`, `409 → CONFLICT`). The session survives these.
     */
    statusErrors?: Record<string, string>

    /** Message for any other non-OK response when no catalog extraction applies. */
    fixedErrorMessage?: string
    /**
     * When true, non-OK responses always throw {@link AuthedRequestConfig.fixedErrorMessage}
     * instead of extracting the body message (admin behaviour).
     */
    fixedErrorMessagesOnly?: boolean

    /** Return `null` for 204/205 responses (admin behaviour). */
    nullForEmptyResponses?: boolean
}

async function parseJsonResponse(
    response: Response,
    invalidResponseMessage: string,
): Promise<unknown> {
    const contentType = response.headers.get('content-type') ?? ''
    if (!contentType.toLowerCase().includes('application/json')) {
        throw new Error(invalidResponseMessage)
    }

    return response.json()
}

export interface AuthedRequestFn {
    (path: string, init?: RequestInit, retried?: boolean): Promise<unknown>
}

export function createAuthedRequest(config: AuthedRequestConfig): AuthedRequestFn {
    const invalidResponseMessage =
        config.invalidResponseMessage ?? 'The server returned an invalid response.'

    async function acquireToken(): Promise<string> {
        try {
            return await config.session.getValidAccessToken()
        } catch (error: unknown) {
            if (config.authFailureMode === 'auth-required') {
                // The coordinator has already cleared tokens for definitive
                // failures; surface a stable code either way.
                throw new Error('AUTH_REQUIRED')
            }
            if (error instanceof Error && error.message === 'AUTH_REQUIRED') {
                throw error
            }
            // Transient refresh failures must not be reported as "not
            // authenticated" — consumers would log the user out.
            throw new Error(config.transientMessage ?? invalidResponseMessage)
        }
    }

    async function refreshWithPolicy(): Promise<void> {
        try {
            await config.session.refreshAccessToken()
        } catch (error: unknown) {
            if (config.authFailureMode === 'auth-required') {
                config.clearTokens()
                throw new Error('AUTH_REQUIRED')
            }
            if (error instanceof Error && error.message === 'AUTH_REQUIRED') {
                throw error
            }
            // The session itself is intact — only this request failed.
            throw new Error(config.transientMessage ?? invalidResponseMessage)
        }
    }

    const request: AuthedRequestFn = async (path, init, retried = false) => {
        const accessToken = await acquireToken()

        const response = await fetch(path, {
            ...init,
            headers: {
                Accept: 'application/json',
                ...(config.baseHeaders?.() ?? {}),
                Authorization: `Bearer ${accessToken}`,
                ...init?.headers,
            },
        })

        if (response.status === 401 && !retried) {
            await refreshWithPolicy()
            return request(path, init, true)
        }

        const statusError =
            config.statusErrors !== undefined &&
            Object.hasOwn(config.statusErrors, String(response.status))
                ? (config.statusErrors[String(response.status)] as string)
                : undefined

        if (config.fixedErrorMessagesOnly === true) {
            // Admin-style loop: statuses map to fixed codes without reading
            // the error body.
            if (statusError !== undefined) {
                // Authorization denied with a valid token — the session is fine.
                throw new Error(statusError)
            }

            if (!response.ok) {
                throw new Error(config.fixedErrorMessage ?? 'AUTH_REQUIRED')
            }

            if (
                config.nullForEmptyResponses === true &&
                (response.status === 204 || response.status === 205)
            ) {
                return null
            }

            return response.json()
        }

        // Extract-style loop (studio/web): parse the body first so structured
        // messages can be surfaced.
        const value = await parseJsonResponse(response, invalidResponseMessage)

        if (statusError !== undefined) {
            throw new Error(statusError)
        }

        if (!response.ok) {
            if (
                config.finalUnauthorized === 'clear-and-auth-required' &&
                response.status === 401
            ) {
                config.clearTokens()
                throw new Error('AUTH_REQUIRED')
            }

            throw new Error(
                extractApiErrorMessage(
                    value,
                    response.status,
                    config.catalog ?? {fallback: () => invalidResponseMessage},
                ),
            )
        }

        return value
    }

    return request
}

/**
 * Browser-side unauthenticated request loop (public endpoints, login,
 * registration). Parses JSON strictly and surfaces structured error messages.
 */
export function createJsonRequest(config: {
    baseHeaders?: () => Record<string, string>
    invalidResponseMessage: string
    catalog: ErrorMessageCatalog
}): (path: string, init?: RequestInit) => Promise<unknown> {
    return async (path, init) => {
        const response = await fetch(path, {
            ...init,
            headers: {
                Accept: 'application/json',
                ...(config.baseHeaders?.() ?? {}),
                ...init?.headers,
            },
        })
        const value = await parseJsonResponse(
            response,
            config.invalidResponseMessage,
        )
        if (!response.ok) {
            throw new Error(
                extractApiErrorMessage(value, response.status, config.catalog),
            )
        }

        return value
    }
}

export {useAuthedQuery, type UseAuthedQueryOptions, type UseAuthedQueryResult} from './useAuthedQuery'
export {
    platformAdminPolicy,
    platformTenantAdminPolicy,
    STUDIO_CREATOR_CATALOG,
    studioCreatorPolicy,
    SUBSCRIBER_PORTAL_CATALOG,
    subscriberPortalPolicy,
    type TransportPolicy,
    AUTH_REQUIRED,
} from './policies'

