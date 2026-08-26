import type {TenantInvitableRole} from '@directwerk/api/types'

const TENANT_ROLE_LABELS: Record<TenantInvitableRole, string> = {
    TENANT_ADMIN: 'Tenant admin',
    EDITOR: 'Editor',
    SUBSCRIBER: 'Subscriber',
    GUEST: 'Guest',
}

export function getTenantRoleLabel(role: TenantInvitableRole): string {
    return TENANT_ROLE_LABELS[role]
}
