'use client'

import Form from 'next/form'
import {useActionState, useEffect, useRef} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Button} from '@directwerk/ui/components/button'
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@directwerk/ui/components/card'
import {Input} from '@directwerk/ui/components/input'
import {Label} from '@directwerk/ui/components/label'

import {
    ASSET_TYPES,
    ASSET_VISIBILITIES,
    type MediaAsset,
} from '@directwerk/api/types'

import {uploadTenantMediaAction} from '@/app/tenants/actions'
import {INITIAL_UPLOAD_MEDIA_STATE} from '@/app/tenants/actionState'

interface TenantStorageUploadFormProps {
    tenantId: string
    onUploaded?: (asset?: MediaAsset) => void
}

function formatUploadSuccess(asset: MediaAsset, fallbackName: string): string {
    const name = asset.originalFilename ?? fallbackName
    const base = `Uploaded “${name}” (id ${asset.id}, ${asset.status}).`
    if (typeof asset.cdnUrl === 'string' && asset.cdnUrl.length > 0) {
        return `${base} CDN: ${asset.cdnUrl}`
    }
    return base
}

export default function TenantStorageUploadForm({
    tenantId,
    onUploaded,
}: TenantStorageUploadFormProps) {
    const [state, formAction, isPending] = useActionState(
        uploadTenantMediaAction.bind(null, tenantId),
        INITIAL_UPLOAD_MEDIA_STATE
    )

    // Notify the parent once per completed action result (never on mount).
    const handledState = useRef(state)
    useEffect(() => {
        if (state === handledState.current) {
            return
        }
        handledState.current = state
        if (state.error === null && state.asset !== null) {
            onUploaded?.(state.asset)
        }
    }, [state, onUploaded])

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
