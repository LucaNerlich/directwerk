'use server'

import type {MediaAsset, TenantCreationResponse, TenantDetail, TenantDomain, TenantUploadLimits, TenantUser} from '@directwerk/api/types'
import {ASSET_VISIBILITIES} from '@directwerk/api/types'

import {performTenantMediaUpload} from '@/lib/server/mediaUpload'
import {validateCreateTenantInput, validateTenantUserInviteInput} from '@/lib/validation'
import {getTenantRoleLabel, isTenantInvitableRole} from '@/lib/roles'
import {parseTenantHost} from '@directwerk/api/proxy'
import {
    callPlatformApi,
    createTenantConflictMessage,
    statusToFormError,
} from '@/lib/server/platform'

import {
    INITIAL_CREATE_TENANT_STATE,
    INITIAL_DOMAIN_VERIFY_STATE,
    INITIAL_INVITE_TENANT_USER_STATE,
    INITIAL_ROLE_CHANGE_STATE,
    INITIAL_TENANT_EDIT_STATE,
    INITIAL_UPLOAD_LIMITS_STATE,
    INITIAL_UPLOAD_MEDIA_STATE,
    type CreateTenantState,
    type DomainVerifyState,
    type InviteTenantUserState,
    type RoleChangeState,
    type TenantEditState,
    type UploadLimitsState,
    type UploadMediaState,
} from '@/app/tenants/actionState'

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024
const MAX_TENANT_NAME_LENGTH = 255
const ASSET_VISIBILITY_VALUES = new Set<string>(ASSET_VISIBILITIES)
const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/
const NUMERIC_ID_PATTERN = /^\d+$/

function invalidTenantIdentifier<T extends {error: string | null}>(
    initial: T,
): T {
    return {...initial, error: 'Invalid tenant identifier.'}
}

export async function createTenantAction(
    _previousState: CreateTenantState,
    formData: FormData
): Promise<CreateTenantState> {
    const validation = validateCreateTenantInput({
        name: formData.get('name'),
        slug: formData.get('slug'),
        primaryDomain: formData.get('primaryDomain'),
        modulePreset: formData.get('modulePreset'),
        adminEmail: formData.get('adminEmail'),
        adminName: formData.get('adminName'),
    })

    if (!validation.success) {
        return {...INITIAL_CREATE_TENANT_STATE, error: validation.error}
    }

    const result = await callPlatformApi<TenantCreationResponse>(['tenants'], {
        method: 'POST',
        body: validation.data,
    })

    if (!result.ok) {
        return {
            ...INITIAL_CREATE_TENANT_STATE,
            error: statusToFormError(
                result.status,
                {
                    conflict: createTenantConflictMessage(
                        result.code,
                        result.message,
                    ),
                    fallback: 'Tenant creation failed. Check the details and try again.',
                },
                result.message,
            ),
            refreshList: result.status === 409,
        }
    }

    return {
        error: null,
        success: `Created tenant ${result.data.name} (${result.data.slug}).`,
        inviteToken:
            process.env.NODE_ENV === 'production'
                ? null
                : result.data.adminInvitation?.inviteToken ?? null,
        refreshList: true,
    }
}

export async function updateTenantAction(
    tenantId: string,
    _previousState: TenantEditState,
    formData: FormData
): Promise<TenantEditState> {
    if (!NUMERIC_ID_PATTERN.test(tenantId)) {
        return invalidTenantIdentifier(INITIAL_TENANT_EDIT_STATE)
    }

    const name = String(formData.get('name') ?? '').trim()
    const slug = String(formData.get('slug') ?? '').trim()

    if (name.length === 0 && slug.length === 0) {
        return {...INITIAL_TENANT_EDIT_STATE, error: 'Enter a name or slug to update.'}
    }
    if (name.length > MAX_TENANT_NAME_LENGTH) {
        return {
            ...INITIAL_TENANT_EDIT_STATE,
            error: `Name must be ${MAX_TENANT_NAME_LENGTH} characters or fewer.`,
        }
    }
    if (slug.length > 0 && !SLUG_PATTERN.test(slug)) {
        return {
            ...INITIAL_TENANT_EDIT_STATE,
            error: 'Slug must be lowercase letters, numbers, and hyphens.',
        }
    }

    const result = await callPlatformApi<TenantDetail>(['tenants', tenantId], {
        method: 'PATCH',
        body: {
            name: name.length > 0 ? name : undefined,
            slug: slug.length > 0 ? slug : undefined,
        },
    })

    if (!result.ok) {
        return {
            ...INITIAL_TENANT_EDIT_STATE,
            error: statusToFormError(result.status, {
                conflict: 'That slug is already in use.',
                fallback: 'Update failed. Check the details and try again.',
            }),
        }
    }

    return {error: null, success: 'Tenant updated.', tenant: result.data}
}

const BYTES_PER_MB = 1024 * 1024
const MIN_UPLOAD_LIMIT_MB = 1 / BYTES_PER_MB
const MAX_UPLOAD_LIMIT_MB = 5120
const UPLOAD_LIMIT_FIELDS = [
    'maxAudioBytes',
    'maxImageBytes',
    'maxVideoBytes',
    'maxDocumentBytes',
] as const

function parseLimitField(value: FormDataEntryValue | null): number | null | undefined {
    if (value === null) {
        return undefined
    }
    const text = String(value).trim()
    if (text.length === 0) {
        // Empty resets the type to the platform default.
        return null
    }
    const megabytes = Number(text)
    const bytes = megabytes * BYTES_PER_MB
    if (
        !Number.isSafeInteger(bytes) ||
        megabytes < MIN_UPLOAD_LIMIT_MB ||
        megabytes > MAX_UPLOAD_LIMIT_MB
    ) {
        return undefined
    }
    return bytes
}

export async function updateUploadLimitsAction(
    tenantId: string,
    _previousState: UploadLimitsState,
    formData: FormData
): Promise<UploadLimitsState> {
    if (!NUMERIC_ID_PATTERN.test(tenantId)) {
        return invalidTenantIdentifier(INITIAL_UPLOAD_LIMITS_STATE)
    }

    const body: Record<string, number | null> = {}
    for (const field of UPLOAD_LIMIT_FIELDS) {
        const parsed = parseLimitField(formData.get(field))
        if (parsed === undefined) {
            return {
                ...INITIAL_UPLOAD_LIMITS_STATE,
                error: `Enter 1 byte–${MAX_UPLOAD_LIMIT_MB} MB per type in whole-byte increments, or leave empty for the platform default.`,
            }
        }
        body[field] = parsed
    }

    const result = await callPlatformApi<TenantUploadLimits>(
        ['tenants', tenantId, 'upload-limits'],
        {method: 'PUT', body}
    )

    if (!result.ok) {
        return {
            ...INITIAL_UPLOAD_LIMITS_STATE,
            error: statusToFormError(result.status, {
                conflict: 'Upload limits could not be saved.',
                fallback: 'Upload limits could not be saved. Check the values and try again.',
            }),
        }
    }

    return {error: null, success: 'Upload limits updated.', limits: result.data}
}

export async function forceVerifyDomainAction(
    tenantId: string,
    _previousState: DomainVerifyState,
    formData: FormData
): Promise<DomainVerifyState> {
    if (!NUMERIC_ID_PATTERN.test(tenantId)) {
        return invalidTenantIdentifier(INITIAL_DOMAIN_VERIFY_STATE)
    }

    const host = parseTenantHost(String(formData.get('host') ?? ''))
    if (host === null) {
        return {...INITIAL_DOMAIN_VERIFY_STATE, error: 'Enter a valid domain host.'}
    }

    const result = await callPlatformApi<TenantDomain>(
        ['tenants', tenantId, 'domains', host, 'verify'],
        {method: 'POST', body: {}}
    )

    if (!result.ok) {
        return {
            ...INITIAL_DOMAIN_VERIFY_STATE,
            error: statusToFormError(result.status, {
                conflict: 'Force verify failed. Check the host and try again.',
                fallback: 'Force verify failed. Check the host and try again.',
            }),
        }
    }

    return {error: null, success: `${host} force-verified.`}
}

export async function inviteTenantUserAction(
    tenantId: string,
    _previousState: InviteTenantUserState,
    formData: FormData
): Promise<InviteTenantUserState> {
    if (!NUMERIC_ID_PATTERN.test(tenantId)) {
        return invalidTenantIdentifier(INITIAL_INVITE_TENANT_USER_STATE)
    }

    const validation = validateTenantUserInviteInput({
        email: formData.get('email'),
        name: formData.get('name'),
        role: formData.get('role'),
    })

    if (!validation.success) {
        return {...INITIAL_INVITE_TENANT_USER_STATE, error: validation.error}
    }

    const result = await callPlatformApi<{email: string; inviteToken: string | null}>(
        ['tenants', tenantId, 'users', 'invite'],
        {method: 'POST', body: validation.data}
    )

    if (!result.ok) {
        return {
            ...INITIAL_INVITE_TENANT_USER_STATE,
            error: statusToFormError(result.status, {
                conflict: 'This user is already a member of the tenant.',
                fallback: 'Invitation failed. Check the details and try again.',
            }),
        }
    }

    return {
        error: null,
        success: `Invitation sent to ${result.data.email} as ${getTenantRoleLabel(validation.data.role)}.`,
        inviteToken:
            process.env.NODE_ENV === 'production'
                ? null
                : result.data.inviteToken,
    }
}

export async function changeTenantUserRoleAction(
    tenantId: string,
    userId: number,
    _previousState: RoleChangeState,
    formData: FormData
): Promise<RoleChangeState> {
    if (
        !NUMERIC_ID_PATTERN.test(tenantId) ||
        !Number.isSafeInteger(userId) ||
        userId < 1
    ) {
        return {error: 'Invalid tenant or user identifier.'}
    }

    const role = String(formData.get('role') ?? '')
    if (!isTenantInvitableRole(role)) {
        return {error: 'Choose a valid role.'}
    }

    const result = await callPlatformApi<TenantUser>(
        ['tenants', tenantId, 'users', String(userId)],
        {method: 'PATCH', body: {role}}
    )

    if (!result.ok) {
        return {
            error: statusToFormError(result.status, {
                conflict:
                    "This would leave the tenant without an active admin, or you're trying to change your own access.",
                fallback: 'Role change failed. Try again.',
            }),
        }
    }

    return {error: null}
}

function formatUploadSuccess(asset: MediaAsset, fallbackName: string): string {
    const name = asset.originalFilename ?? fallbackName
    const base = `Uploaded “${name}” (id ${asset.id}, ${asset.status}).`
    if (typeof asset.cdnUrl === 'string' && asset.cdnUrl.length > 0) {
        return `${base} CDN: ${asset.cdnUrl}`
    }
    return base
}

export async function uploadTenantMediaAction(
    tenantId: string,
    _previousState: UploadMediaState,
    formData: FormData
): Promise<UploadMediaState> {
    if (!NUMERIC_ID_PATTERN.test(tenantId)) {
        return invalidTenantIdentifier(INITIAL_UPLOAD_MEDIA_STATE)
    }

    const fileEntry = formData.get('file')
    const visibilityRaw = String(formData.get('visibility') ?? 'PUBLIC').trim()

    if (!(fileEntry instanceof File) || fileEntry.size === 0) {
        return {...INITIAL_UPLOAD_MEDIA_STATE, error: 'Choose a non-empty file to upload.'}
    }
    if (fileEntry.size > MAX_UPLOAD_BYTES) {
        return {
            ...INITIAL_UPLOAD_MEDIA_STATE,
            error: `File exceeds ${MAX_UPLOAD_BYTES} byte test-upload limit.`,
        }
    }
    if (!ASSET_VISIBILITY_VALUES.has(visibilityRaw)) {
        return {...INITIAL_UPLOAD_MEDIA_STATE, error: 'Choose a valid visibility.'}
    }

    const uploadBody = new FormData()
    uploadBody.set('file', fileEntry)
    uploadBody.set('visibility', visibilityRaw)
    const assetTypeRaw = String(formData.get('assetType') ?? '').trim()
    if (assetTypeRaw) {
        uploadBody.set('assetType', assetTypeRaw)
    }

    const result = await performTenantMediaUpload(tenantId, uploadBody)

    if (!result.ok) {
        if (result.retryConfirm === true && typeof result.assetId === 'number') {
            const retry = await callPlatformApi<MediaAsset>(
                ['tenants', tenantId, 'media', String(result.assetId), 'confirm'],
                {method: 'POST', body: {}}
            )
            if (!retry.ok) {
                return {
                    ...INITIAL_UPLOAD_MEDIA_STATE,
                    error: `Upload reached storage (asset ${result.assetId}) but confirmation failed. Retry confirm for that asset id.`,
                }
            }
            return {
                error: null,
                success: formatUploadSuccess(retry.data, fileEntry.name),
                asset: retry.data,
            }
        }

        const message =
            typeof result.body?.error === 'string'
                ? result.body.error
                : 'Upload failed. Is Directwerk reachable with storage enabled?'
        return {...INITIAL_UPLOAD_MEDIA_STATE, error: message}
    }

    return {
        error: null,
        success: formatUploadSuccess(result.asset, fileEntry.name),
        asset: result.asset,
    }
}
