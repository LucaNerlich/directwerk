'use client'

import Form from 'next/form'
import {useActionState} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Button} from '@directwerk/ui/components/button'
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@directwerk/ui/components/card'
import {Input} from '@directwerk/ui/components/input'
import {Label} from '@directwerk/ui/components/label'

import {postPlatformData} from '@/lib/api/client'
import {clearTokens, getAccessToken} from '@/lib/auth/tokenStore'
import {AUTH_REQUIRED} from '@/lib/api/errors'
import {
    ASSET_TYPES,
    ASSET_VISIBILITIES,
    type AssetVisibility,
    type MediaAsset,
} from '@/lib/api/types'

interface TenantStorageUploadFormProps {
    tenantId: string
    onUploaded?: (asset?: MediaAsset) => void
}

interface UploadFormState {
    error: string | null
    success: string | null
}

const INITIAL_STATE: UploadFormState = {
    error: null,
    success: null,
}

function isMediaAsset(value: unknown): value is MediaAsset {
    if (typeof value !== 'object' || value === null) {
        return false
    }

    const asset = value as Record<string, unknown>
    return typeof asset.id === 'number' && typeof asset.s3Key === 'string'
}

function formatUploadSuccess(asset: MediaAsset, fallbackName: string): string {
    const name = asset.originalFilename ?? fallbackName
    const base = `Uploaded “${name}” (id ${asset.id}, ${asset.status}).`
    if (typeof asset.cdnUrl === 'string' && asset.cdnUrl.length > 0) {
        return `${base} CDN: ${asset.cdnUrl}`
    }
    return base
}

function readEnvelopeData(payload: unknown): unknown {
    if (
        typeof payload !== 'object' ||
        payload === null ||
        !Object.hasOwn(payload, 'data')
    ) {
        return null
    }
    return (payload as {data: unknown}).data
}

function isConfirmRetryPayload(
    payload: unknown
): payload is {assetId: number; retryConfirm: true; error?: string} {
    if (typeof payload !== 'object' || payload === null) {
        return false
    }
    const body = payload as Record<string, unknown>
    return (
        body.retryConfirm === true &&
        typeof body.assetId === 'number' &&
        Number.isSafeInteger(body.assetId) &&
        body.assetId > 0
    )
}

export default function TenantStorageUploadForm({
    tenantId,
    onUploaded,
}: TenantStorageUploadFormProps) {
    async function uploadAction(
        _previousState: UploadFormState,
        formData: FormData
    ): Promise<UploadFormState> {
        const fileEntry = formData.get('file')
        const visibilityRaw = String(formData.get('visibility') ?? 'PUBLIC').trim()

        if (!(fileEntry instanceof File) || fileEntry.size === 0) {
            return {...INITIAL_STATE, error: 'Choose a non-empty file to upload.'}
        }

        if (
            !ASSET_VISIBILITIES.includes(
                visibilityRaw as AssetVisibility
            )
        ) {
            return {...INITIAL_STATE, error: 'Choose a valid visibility.'}
        }

        const token = getAccessToken()
        if (!token) {
            return {...INITIAL_STATE, error: 'Session expired. Log in again.'}
        }

        const body = new FormData()
        body.set('file', fileEntry)
        body.set('visibility', visibilityRaw)
        const assetTypeRaw = String(formData.get('assetType') ?? '').trim()
        if (assetTypeRaw) {
            body.set('assetType', assetTypeRaw)
        }

        try {
            // Server route performs upload-url → PUT to S3 → confirm.
            // Browser cannot PUT Bunny S3 directly (no storage CORS; CSP connect-src self).
            const response = await fetch(
                `/api/tenants/${tenantId}/media/upload`,
                {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                    body,
                    cache: 'no-store',
                }
            )

            if (response.status === 401 || response.status === 403) {
                clearTokens()
                return {
                    ...INITIAL_STATE,
                    error: 'Session expired. Log in again.',
                }
            }

            const payload = await response.json().catch(() => null)

            if (!response.ok) {
                // PUT succeeded but confirm failed — retry confirm only (same assetId).
                if (isConfirmRetryPayload(payload)) {
                    try {
                        const confirmed = await postPlatformData<MediaAsset>(
                            `tenants/${tenantId}/media/${payload.assetId}/confirm`,
                            {}
                        )
                        if (!isMediaAsset(confirmed)) {
                            return {
                                ...INITIAL_STATE,
                                error: `Upload reached storage (asset ${payload.assetId}) but confirm retry returned an invalid response.`,
                            }
                        }
                        onUploaded?.(confirmed)
                        return {
                            error: null,
                            success: formatUploadSuccess(confirmed, fileEntry.name),
                        }
                    } catch {
                        return {
                            ...INITIAL_STATE,
                            error: `Upload reached storage (asset ${payload.assetId}) but confirmation failed. Retry confirm for that asset id.`,
                        }
                    }
                }

                const message =
                    payload &&
                    typeof payload === 'object' &&
                    typeof (payload as {error?: unknown}).error === 'string'
                        ? (payload as {error: string}).error
                        : 'Upload failed.'
                return {...INITIAL_STATE, error: message}
            }

            const asset = readEnvelopeData(payload)
            if (!isMediaAsset(asset)) {
                return {
                    ...INITIAL_STATE,
                    error: 'Confirm response was invalid.',
                }
            }

            onUploaded?.(asset)

            return {
                error: null,
                success: formatUploadSuccess(asset, fileEntry.name),
            }
        } catch (error: unknown) {
            if (error instanceof Error && error.message === AUTH_REQUIRED) {
                return {
                    ...INITIAL_STATE,
                    error: 'Session expired. Log in again.',
                }
            }

            return {
                ...INITIAL_STATE,
                error: 'Upload failed. Is Directwerk reachable with storage enabled?',
            }
        }
    }

    const [state, formAction, isPending] = useActionState(
        uploadAction,
        INITIAL_STATE
    )

    return (
        <Card aria-labelledby="tenant-storage-upload-heading" role="region">
            <CardHeader>
            <CardTitle id="tenant-storage-upload-heading">Upload (test flow)</CardTitle>
            <CardDescription>
                Platform admin only. The admin API proxies the file to object
                storage (Bunny S3 has no browser CORS on the storage endpoint).
                Max 10&nbsp;MB for this test form.
            </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">

            <Form action={formAction} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2">
                    <Label htmlFor="storage-upload-file">File</Label>
                    <Input
                        accept="image/*,audio/*,video/*,.pdf,.txt"
                        disabled={isPending}
                        id="storage-upload-file"
                        name="file"
                        required
                        type="file"
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="storage-upload-type">Type</Label>
                    <select className="native-select" defaultValue="" disabled={isPending} id="storage-upload-type" name="assetType">
                        <option value="">Infer from MIME</option>
                        {ASSET_TYPES.map((typeOption) => (
                            <option key={typeOption} value={typeOption}>
                                {typeOption}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="storage-upload-visibility">Visibility</Label>
                    <select
                        className="native-select"
                        defaultValue="PUBLIC"
                        disabled={isPending}
                        id="storage-upload-visibility"
                        name="visibility"
                    >
                        {ASSET_VISIBILITIES.map((visibilityOption) => (
                            <option key={visibilityOption} value={visibilityOption}>
                                {visibilityOption}
                            </option>
                        ))}
                    </select>
                </div>
                <Button className="self-end" disabled={isPending} type="submit">
                    {isPending ? 'Uploading…' : 'Upload'}
                </Button>
            </Form>

            {state.error ? <Alert variant="destructive"><AlertDescription>{state.error}</AlertDescription></Alert> : null}
            {state.success ? <p aria-live="polite" className="text-sm text-muted-foreground" role="status">{state.success}</p> : null}
            </CardContent>
        </Card>
    )
}
