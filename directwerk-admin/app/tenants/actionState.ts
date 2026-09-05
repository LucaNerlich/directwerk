import type {MediaAsset, TenantDetail, TenantUploadLimits} from '@directwerk/api/types'

export interface CreateTenantState {
    error: string | null
    success: string | null
    inviteToken: string | null
    /** When true, the tenant list should reload (e.g. after a 409 conflict). */
    refreshList: boolean
}

export const INITIAL_CREATE_TENANT_STATE: CreateTenantState = {
    error: null,
    success: null,
    inviteToken: null,
    refreshList: false,
}

export interface TenantEditState {
    error: string | null
    success: string | null
    tenant: TenantDetail | null
}

export const INITIAL_TENANT_EDIT_STATE: TenantEditState = {
    error: null,
    success: null,
    tenant: null,
}

export interface DomainVerifyState {
    error: string | null
    success: string | null
}

export const INITIAL_DOMAIN_VERIFY_STATE: DomainVerifyState = {
    error: null,
    success: null,
}

export interface InviteTenantUserState {
    error: string | null
    success: string | null
    inviteToken: string | null
}

export const INITIAL_INVITE_TENANT_USER_STATE: InviteTenantUserState = {
    error: null,
    success: null,
    inviteToken: null,
}

export interface RoleChangeState {
    error: string | null
}

export const INITIAL_ROLE_CHANGE_STATE: RoleChangeState = {error: null}

export interface UploadMediaState {
    error: string | null
    success: string | null
    asset: MediaAsset | null
}

export const INITIAL_UPLOAD_MEDIA_STATE: UploadMediaState = {
    error: null,
    success: null,
    asset: null,
}

export interface UploadLimitsState {
    error: string | null
    success: string | null
    limits: TenantUploadLimits | null
}

export const INITIAL_UPLOAD_LIMITS_STATE: UploadLimitsState = {
    error: null,
    success: null,
    limits: null,
}
