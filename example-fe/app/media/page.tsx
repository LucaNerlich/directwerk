'use client'

import Image from 'next/image'
import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {useEffect, useState, useSyncExternalStore} from 'react'
import useSWR from 'swr'

import {Alert, AlertDescription} from '@publish/ui/components/alert'
import {Card, CardContent, CardHeader, CardTitle} from '@publish/ui/components/card'
import EmptyState from '@publish/ui/components/empty-state'
import PageHeader from '@publish/ui/components/page-header'

import {fetchImagePreviewUrl, fetchImages, getMe} from '@/lib/api/client'
import {AUTH_REQUIRED} from '@/lib/api/errors'
import type {MediaAsset} from '@/lib/api/types'
import {subscribeToTokenStore} from '@/lib/auth/tokenStore'
import {getSelectedTenant, subscribeToTenantStore} from '@/lib/tenantStore'
import type {TenantHost} from '@/lib/tenants'

const PREVIEW_BATCH_SIZE = 2

function formatSizeKb(sizeBytes: number | null): string {
    if (sizeBytes === null) {
        return 'Unknown'
    }
    const kb = sizeBytes / 1024
    return `${kb.toFixed(1)} KB`
}

function hasEditorAccess(roles: string[]): boolean {
    return roles.includes('EDITOR') || roles.includes('TENANT_ADMIN')
}

export default function MediaPage() {
    const router = useRouter()

    const tokenReady = useSyncExternalStore(
        subscribeToTokenStore,
        () => true,
        () => false,
    )
    const tenantHost = useSyncExternalStore<TenantHost | null>(
        subscribeToTenantStore,
        getSelectedTenant,
        () => null,
    )

    const swrKey =
        tokenReady && tenantHost !== null
            ? (['/api/media', tenantHost] as const)
            : null
    const {data: images, error, isLoading} = useSWR<MediaAsset[]>(
        swrKey,
        ([, host]: readonly [string, TenantHost]) =>
            fetchImages(host).then((r) => r.data),
    )

    useEffect(() => {
        if (error instanceof Error && error.message === AUTH_REQUIRED) {
            router.replace('/login')
        }
    }, [error, router])

    const [roleHint, setRoleHint] = useState<string | null>(null)
    const [previewUrls, setPreviewUrls] = useState<Map<number, string>>(new Map())
    const [previewErrors, setPreviewErrors] = useState(0)
    const imageIdsKey = images?.map((i) => i.id).join(',') ?? ''

    useEffect(() => {
        if (tenantHost === null) {
            return
        }

        let isCurrent = true
        getMe(tenantHost)
            .then((response) => {
                if (!isCurrent) {
                    return
                }

                if (!hasEditorAccess(response.data.roles)) {
                    setRoleHint(
                        'Media library access requires an EDITOR or TENANT_ADMIN account.',
                    )
                }
            })
            .catch((requestError: unknown) => {
                if (!isCurrent) {
                    return
                }

                if (
                    requestError instanceof Error &&
                    requestError.message === AUTH_REQUIRED
                ) {
                    router.replace('/login')
                }
            })

        return () => {
            isCurrent = false
        }
    }, [router, tenantHost])

    useEffect(() => {
        if (!imageIdsKey || tenantHost === null) {
            return
        }

        const ids = images
            ?.filter((image) => image.cdnUrl === null)
            .map((image) => image.id) ?? []
        if (ids.length === 0) {
            return
        }

        let isCurrent = true
        setPreviewErrors(0)

        async function loadPreviews() {
            let failedCount = 0

            for (let i = 0; i < ids.length; i += PREVIEW_BATCH_SIZE) {
                if (!isCurrent) {
                    return
                }

                const batch = ids.slice(i, i + PREVIEW_BATCH_SIZE)
                const results = await Promise.allSettled(
                    batch.map(async (id) => {
                        const url = await fetchImagePreviewUrl(tenantHost!, id)
                        return {id, url}
                    }),
                )

                // Check for AUTH_REQUIRED in rejected results
                for (const result of results) {
                    if (
                        result.status === 'rejected' &&
                        result.reason instanceof Error &&
                        result.reason.message === AUTH_REQUIRED
                    ) {
                        throw result.reason
                    }
                }

                if (!isCurrent) {
                    return
                }

                setPreviewUrls((prev) => {
                    const next = new Map(prev)
                    for (const result of results) {
                        if (
                            result.status === 'fulfilled' &&
                            result.value.url !== null
                        ) {
                            next.set(result.value.id, result.value.url)
                        }
                    }
                    return next
                })

                failedCount += results.filter(
                    (result) =>
                        result.status === 'rejected' ||
                        (result.status === 'fulfilled' &&
                            result.value.url === null),
                ).length
            }

            if (isCurrent && failedCount > 0) {
                setPreviewErrors(failedCount)
            }
        }

        loadPreviews().catch((previewError: unknown) => {
            if (
                previewError instanceof Error &&
                previewError.message === AUTH_REQUIRED
            ) {
                router.replace('/login')
            }
        })

        return () => {
            isCurrent = false
        }
    }, [imageIdsKey, router, tenantHost, images])

    const errorMessage =
        error instanceof Error && error.message !== AUTH_REQUIRED
            ? error.message
            : error
              ? 'Unable to load the media library.'
              : null

    return (
        <div className="page-container space-y-8">
            <PageHeader title="Media" description="Images available to the selected tenant." />
            {roleHint !== null && <Alert role="status"><AlertDescription>{roleHint}</AlertDescription></Alert>}
            {isLoading && <p>Loading images…</p>}
            {errorMessage !== null && <Alert variant="destructive"><AlertDescription>{errorMessage}</AlertDescription></Alert>}
            {previewErrors > 0 && (
                <Alert role="status"><AlertDescription>
                    Some previews are unavailable ({previewErrors} failed).
                </AlertDescription></Alert>
            )}
            {!isLoading && errorMessage === null && images !== undefined && images.length === 0 && (
                <EmptyState title="No images found" />
            )}
            {!isLoading && errorMessage === null && images !== undefined && images.length > 0 && (
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {images.map((image) => (
                        <Card className="[content-visibility:auto] [contain-intrinsic-size:200px_300px]" key={image.id}>
                            {(image.cdnUrl !== null || previewUrls.has(image.id)) && (
                                <div className="relative aspect-4/3 w-full bg-muted">
                                    <Image
                                        src={image.cdnUrl ?? previewUrls.get(image.id)!}
                                        alt={
                                            image.originalFilename ??
                                            image.s3Key
                                        }
                                        fill
                                        sizes="(max-width: 768px) 100vw, 200px"
                                        className="object-contain"
                                    />
                                </div>
                            )}
                            <CardHeader><CardTitle className="break-all">
                                {image.originalFilename ?? image.s3Key}
                            </CardTitle></CardHeader>
                            <CardContent><dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm [&_dt]:font-medium">
                                <dt>Type</dt>
                                <dd>{image.assetType}</dd>
                                <dt>Status</dt>
                                <dd>{image.status}</dd>
                                <dt>Mime</dt>
                                <dd>{image.mimeType ?? 'Unknown'}</dd>
                                <dt>Size</dt>
                                <dd>{formatSizeKb(image.sizeBytes)}</dd>
                            </dl></CardContent>
                        </Card>
                    ))}
                </div>
            )}
            <p>
                <Link href="/">Back to tenant selection</Link>
            </p>
        </div>
    )
}
