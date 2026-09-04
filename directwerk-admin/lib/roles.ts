import {
    PLATFORM_TENANT_INVITABLE_ROLES,
    type TenantInvitableRole,
} from '@directwerk/api/types'

const TENANT_ROLE_LABELS: Record<TenantInvitableRole, string> = {
    TENANT_ADMIN: 'Tenant admin',
    EDITOR: 'Editor',
    SUBSCRIBER: 'Subscriber',
    GUEST: 'Guest',
}

export function getTenantRoleLabel(role: TenantInvitableRole): string {
    return TENANT_ROLE_LABELS[role]
}

const INVITABLE_ROLE_VALUES = new Set<string>(
    PLATFORM_TENANT_INVITABLE_ROLES,
)

/**
 * Allow-list guard for role values submitted to tenant role server actions.
 * The UI only offers invitable roles; anything else must be rejected before
 * it reaches the platform API.
 */
export function isTenantInvitableRole(
    value: unknown,
): value is TenantInvitableRole {
    return typeof value === 'string' && INVITABLE_ROLE_VALUES.has(value)
}
