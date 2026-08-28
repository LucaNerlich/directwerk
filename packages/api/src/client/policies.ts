import type {AuthedRequestConfig} from './authedRequest'
import {AUTH_REQUIRED, CONFLICT, FORBIDDEN, REQUEST_FAILED} from '../constants'
import type {ErrorMessageCatalog} from '../envelope'

/** Partial config shared by all apps — session wiring stays app-local. */
export type TransportPolicy = Omit<AuthedRequestConfig, 'session' | 'clearTokens'>

export const STUDIO_CREATOR_CATALOG: ErrorMessageCatalog = {
    invalidGrant: 'E-Mail oder Passwort falsch.',
    unauthorized: 'E-Mail oder Passwort falsch.',
    fallback: (status) => `Anfrage fehlgeschlagen (${status}).`,
}

export const studioCreatorPolicy: TransportPolicy = {
    authFailureMode: 'preserve-transient',
    transientMessage: 'Der Server ist derzeit nicht erreichbar.',
    finalUnauthorized: 'localized-error',
    invalidResponseMessage: 'Der Server hat eine ungültige Antwort gesendet.',
    catalog: STUDIO_CREATOR_CATALOG,
}

export const SUBSCRIBER_PORTAL_CATALOG: ErrorMessageCatalog = {
    fallback: (status) => `Request failed with status ${status}.`,
}

export const subscriberPortalPolicy: TransportPolicy = {
    authFailureMode: 'preserve-transient',
    transientMessage: 'The server is temporarily unreachable.',
    finalUnauthorized: 'clear-and-auth-required',
    invalidResponseMessage: 'The server returned an invalid response.',
    catalog: SUBSCRIBER_PORTAL_CATALOG,
}

export const platformAdminPolicy: TransportPolicy = {
    authFailureMode: 'auth-required',
    finalUnauthorized: 'clear-and-auth-required',
    fixedErrorMessagesOnly: true,
    fixedErrorMessage: REQUEST_FAILED,
    statusErrors: {
        '403': FORBIDDEN,
        '409': CONFLICT,
    },
    nullForEmptyResponses: true,
}

export const platformTenantAdminPolicy: TransportPolicy = {
    ...platformAdminPolicy,
    // Tenant-scoped admin calls use the same envelope semantics as platform admin.
}

export {AUTH_REQUIRED}
