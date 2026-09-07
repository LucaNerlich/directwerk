import type {MediaAsset, TenantDetail, TenantUploadLimits} from '@directwerk/api/types'

export type ActionState<TExtra extends object = object> = {
    error: string | null
    success?: string | null
} & TExtra

function initialActionState<TExtra extends object>(extra: TExtra): ActionState<TExtra> {
    return {error: null, success: null, ...extra}
}

export type CreateTenantState = ActionState<{
    inviteToken: string | null
    /** When true, the tenant list should reload (e.g. after a 409 conflict). */
    refreshList: boolean
}>

export const INITIAL_CREATE_TENANT_STATE: CreateTenantState = initialActionState({
    inviteToken: null,
    refreshList: false,
})

export type TenantEditState = ActionState<{tenant: TenantDetail | null}>

export const INITIAL_TENANT_EDIT_STATE: TenantEditState = initialActionState({tenant: null})

export type DomainVerifyState = ActionState

export const INITIAL_DOMAIN_VERIFY_STATE: DomainVerifyState = initialActionState({})

export type InviteTenantUserState = ActionState<{inviteToken: string | null}>

export const INITIAL_INVITE_TENANT_USER_STATE: InviteTenantUserState = initialActionState({
    inviteToken: null,
})

export type RoleChangeState = ActionState

export const INITIAL_ROLE_CHANGE_STATE: RoleChangeState = {error: null}

export type UploadMediaState = ActionState<{asset: MediaAsset | null}>

export const INITIAL_UPLOAD_MEDIA_STATE: UploadMediaState = initialActionState({asset: null})

export type UploadLimitsState = ActionState<{limits: TenantUploadLimits | null}>

export const INITIAL_UPLOAD_LIMITS_STATE: UploadLimitsState = initialActionState({limits: null})
