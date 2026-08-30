'use server'

import type {MediaAsset, TenantCreationResponse, TenantDetail, TenantDomain, TenantUser} from '@directwerk/api/types'
import {ASSET_VISIBILITIES} from '@directwerk/api/types'

import {performTenantMediaUpload} from '@/lib/server/mediaUpload'
import {validateCreateTenantInput, validateTenantUserInviteInput} from '@/lib/validation'
import {getTenantRoleLabel} from '@/lib/roles'
import {callPlatformApi, statusToFormError} from '@/lib/server/platform'

import {
    INITIAL_CREATE_TENANT_STATE,
    INITIAL_DOMAIN_VERIFY_STATE,
    INITIAL_INVITE_TENANT_USER_STATE,
    INITIAL_ROLE_CHANGE_STATE,
    INITIAL_TENANT_EDIT_STATE,
    INITIAL_UPLOAD_MEDIA_STATE,
    type CreateTenantState,
    type DomainVerifyState,
    type InviteTenantUserState,
    type RoleChangeState,
    type TenantEditState,
    type UploadMediaState,
} from '@/app/tenants/actionState'

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024
const ASSET_VISIBILITY_VALUES = new Set<string>(ASSET_VISIBILITIES)
const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/

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
            error: statusToFormError(result.status, {
                conflict:
                    'A tenant with this slug or primary domain already exists.',
                fallback: 'Tenant creation failed. Check the details and try again.',
            }),
        }
    }

    return {
        error: null,
        success: `Created tenant ${result.data.name} (${result.data.slug}).`,
        inviteToken: result.data.adminInvitation?.inviteToken ?? null,
    }
}

export async function updateTenantAction(
    tenantId: string,
    _previousState: TenantEditState,
    formData: FormData
): Promise<TenantEditState> {
    const name = String(formData.get('name') ?? '').trim()
    const slug = String(formData.get('slug') ?? '').trim()

    if (name.length === 0 && slug.length === 0) {
        return {...INITIAL_TENANT_EDIT_STATE, error: 'Enter a name or slug to update.'}
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

export async function forceVerifyDomainAction(
    tenantId: string,
    _previousState: DomainVerifyState,
    formData: FormData
): Promise<DomainVerifyState> {
    const host = String(formData.get('host') ?? '').trim()
    if (host.length === 0) {
        return {...INITIAL_DOMAIN_VERIFY_STATE, error: 'Enter a domain host.'}
    }

    if (
        host.includes('/') ||
        host === '.' ||
        host === '..' ||
        host.startsWith('.') ||
        host.endsWith('.')
    ) {
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
        inviteToken: result.data.inviteToken,
    }
}

export async function changeTenantUserRoleAction(
    tenantId: string,
    userId: number,
    _previousState: RoleChangeState,
    formData: FormData
): Promise<RoleChangeState> {
    const role = String(formData.get('role') ?? '')

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
