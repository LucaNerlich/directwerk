export const AUTH_REQUIRED = 'AUTH_REQUIRED'
export const API_CONTRACT_ERROR = 'API_CONTRACT_ERROR'
export const REQUEST_FAILED = 'REQUEST_FAILED'
export const CONFLICT = 'CONFLICT'

/** Authorization denied with a valid token — must not clear the session. */
export const FORBIDDEN = 'FORBIDDEN'

/**
 * A refresh/auth failure that is not the user's fault (upstream outage,
 * timeout). The session must survive these.
 */
export const AUTH_TRANSIENT = 'AUTH_TRANSIENT'
