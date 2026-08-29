/** Thrown as an `Error` message when the user must (re-)authenticate. */
export const AUTH_REQUIRED = 'AUTH_REQUIRED'

/**
 * A refresh/auth failure that is not the user's fault (upstream outage,
 * timeout, malformed proxy reply). The session must survive these; only
 * definitive auth failures (`AUTH_REQUIRED`) may clear tokens.
 */
export const AUTH_TRANSIENT = 'AUTH_TRANSIENT'

export const API_CONTRACT_ERROR = 'API_CONTRACT_ERROR'
export const REQUEST_FAILED = 'REQUEST_FAILED'
export const CONFLICT = 'CONFLICT'

/** Authorization denied with a valid token — must not clear the session. */
export const FORBIDDEN = 'FORBIDDEN'

/** Known asset types accepted by the media endpoints. */
export const ASSET_TYPES = ['AUDIO', 'IMAGE', 'VIDEO', 'DOCUMENT'] as const

/** Known asset statuses reported by the media endpoints. */
export const ASSET_STATUSES = ['PENDING', 'READY', 'PENDING_DELETE', 'ARCHIVED'] as const

/** Known asset visibilities for media uploads. */
export const ASSET_VISIBILITIES = ['PUBLIC', 'PRIVATE'] as const

/** Known job statuses reported by the platform queue endpoint. */
export const JOB_STATUSES = ['QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED'] as const

/** Known presets from ModulePreset (POST …/modules/preset/{key}). */
export const MODULE_PRESETS = [
    'FREE_PODCAST',
    'WRITER',
    'PODCAST',
    'FULL',
    'PATREON_MIGRATOR',
    'PRO',
    'ENTERPRISE',
] as const

/**
 * Roles the backend accepts for tenant invitations.
 * Mirrors `TenantInvitationService.INVITABLE_ROLES`
 * (TENANT_ADMIN, EDITOR, SUBSCRIBER, GUEST) in directwerk-core.
 */
export const TENANT_INVITABLE_ROLES = [
    'TENANT_ADMIN',
    'EDITOR',
    'SUBSCRIBER',
    'GUEST',
] as const

/** Roles platform admins should invite from directwerk-admin (publisher staff only). */
export const PLATFORM_TENANT_INVITABLE_ROLES = [
    'TENANT_ADMIN',
    'EDITOR',
] as const

export type TenantInvitableRole = (typeof TENANT_INVITABLE_ROLES)[number]
