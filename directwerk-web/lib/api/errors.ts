export const AUTH_REQUIRED = 'AUTH_REQUIRED'

/**
 * A refresh/auth failure that is not the user's fault (upstream outage,
 * timeout). The session must survive these; only definitive auth failures
 * (`AUTH_REQUIRED`) may clear tokens.
 */
export const AUTH_TRANSIENT = 'AUTH_TRANSIENT'
