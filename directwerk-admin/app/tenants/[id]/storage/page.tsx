'use client'

import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {use, useCallback, useEffect, useState} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Badge} from '@directwerk/ui/components/badge'
import {Button} from '@directwerk/ui/components/button'
import {Card, CardContent, CardHeader, CardTitle} from '@directwerk/ui/components/card'
import EmptyState from '@directwerk/ui/components/empty-state'
import {Input} from '@directwerk/ui/components/input'
import {Label} from '@directwerk/ui/components/label'
import PageHeader from '@directwerk/ui/components/page-header'
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from '@directwerk/ui/components/table'

import TenantStorageUploadForm from '@/components/TenantStorageUploadForm'
import {deletePlatformData, getPlatformData} from '@/lib/api/client'
import {AUTH_REQUIRED} from '@directwerk/api/constants'
import {
    ASSET_STATUSES,
    ASSET_TYPES,
    type MediaAsset,
    type Tenant,
    type TenantMediaList,
    type TenantMediaQuery,
} from '@directwerk/api/types'

interface TenantStoragePageProps {
    params: Promise<{id: string}>
}

const DEFAULT_QUERY: TenantMediaQuery = {
    limit: 50,
}

const TIMESTAMP_FORMATTER = new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'short',
    timeStyle: 'medium',
    timeZone: 'UTC',
})

function formatTimestamp(value: string): string {
    const parsed = Date.parse(value)

    if (Number.isNaN(parsed)) {
        return value
    }

    return TIMESTAMP_FORMATTER.format(new Date(parsed))
}

function formatBytes(value: number | null): string {
    if (value === null || value < 0) {
        return '—'
    }

    if (value < 1024) {
        return `${value} B`
    }

    if (value < 1024 * 1024) {
        return `${(value / 1024).toFixed(1)} KB`
    }

    return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

function buildMediaPath(tenantId: string, query: TenantMediaQuery): string {
    const params = new URLSearchParams()

    if (query.assetType) {
        params.set('assetType', query.assetType)
    }

    if (query.status) {
        params.set('status', query.status)
    }

    if (query.limit !== undefined) {
        params.set('limit', String(query.limit))
    }

    const queryString = params.toString()
    return queryString.length > 0
        ? `tenants/${tenantId}/media?${queryString}`
        : `tenants/${tenantId}/media`
}

/**
 * Prefer API `cdnUrl`; otherwise derive from public CDN origin + public s3 key.
 */
function resolveCdnUrl(
    asset: MediaAsset,
    publicCdnBaseUrl: string | null
): string | null {
    let candidate: string | null = null

    if (typeof asset.cdnUrl === 'string' && asset.cdnUrl.length > 0) {
        candidate = asset.cdnUrl
    } else if (
        asset.visibility === 'PUBLIC' &&
        asset.status === 'READY' &&
        asset.s3Key.includes('/public/') &&
        publicCdnBaseUrl
    ) {
        const base = publicCdnBaseUrl.replace(/\/+$/, '')
        const key = asset.s3Key.replace(/^\/+/, '')
        candidate = `${base}/${key}`
    }

    if (candidate === null) {
        return null
    }

    try {
        return new URL(candidate).protocol === 'https:' ? candidate : null
    } catch {
        return null
    }
}

export default function TenantStoragePage({params}: TenantStoragePageProps) {
    const {id} = use(params)
    const router = useRouter()
    const [tenant, setTenant] = useState<Tenant | null>(null)
    const [assets, setAssets] = useState<MediaAsset[] | null>(null)
    const [publicCdnBaseUrl, setPublicCdnBaseUrl] = useState<string | null>(
        null
    )
    const [query, setQuery] = useState<TenantMediaQuery>(DEFAULT_QUERY)
    const [error, setError] = useState<string | null>(null)
    const [isInitialLoad, setIsInitialLoad] = useState(true)
    const [deletingAssetId, setDeletingAssetId] = useState<number | null>(null)

    const {assetType, status, limit} = query

    const loadStorage = useCallback(
        (nextQuery: TenantMediaQuery) => {
            if (!/^\d+$/.test(id)) {
                setError('Invalid tenant identifier.')
                setTenant(null)
                setAssets(null)
                setPublicCdnBaseUrl(null)
                setIsInitialLoad(false)
                return () => undefined
            }

            setError(null)

            let isCurrent = true

            Promise.all([
                getPlatformData<Tenant>(`tenants/${id}`),
                getPlatformData<TenantMediaList>(buildMediaPath(id, nextQuery)),
            ])
                .then(([nextTenant, media]) => {
                    if (!isCurrent) {
                        return
                    }

                    setTenant(nextTenant)
                    setAssets(media.content)
                    setPublicCdnBaseUrl(
                        typeof media.publicCdnBaseUrl === 'string' &&
                            media.publicCdnBaseUrl.length > 0
                            ? media.publicCdnBaseUrl
                            : null
                    )
                    setIsInitialLoad(false)
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
                        return
                    }

                    setTenant(null)
                    setAssets(null)
                    setPublicCdnBaseUrl(null)
                    setError('Could not load tenant storage.')
                    setIsInitialLoad(false)
                })

            return () => {
                isCurrent = false
            }
        },
        [id, router]
    )

    useEffect(() => {
        return loadStorage({assetType, status, limit})
    }, [loadStorage, assetType, status, limit])

    function applyFilters(formData: FormData): void {
        const assetTypeRaw = String(formData.get('assetType') ?? '').trim()
        const statusRaw = String(formData.get('status') ?? '').trim()
        const limitRaw = String(formData.get('limit') ?? '').trim()

        const nextQuery: TenantMediaQuery = {}

        if (assetTypeRaw) {
            if (
                !ASSET_TYPES.includes(
                    assetTypeRaw as (typeof ASSET_TYPES)[number]
                )
            ) {
                setError('Choose a valid asset type.')
                return
            }
            nextQuery.assetType = assetTypeRaw as (typeof ASSET_TYPES)[number]
        }

        if (statusRaw) {
            if (
                !ASSET_STATUSES.includes(
                    statusRaw as (typeof ASSET_STATUSES)[number]
                )
            ) {
                setError('Choose a valid asset status.')
                return
            }
            nextQuery.status = statusRaw as (typeof ASSET_STATUSES)[number]
        }

        const parsedLimit = limitRaw ? Number(limitRaw) : 50
        if (
            !Number.isSafeInteger(parsedLimit) ||
            parsedLimit < 1 ||
            parsedLimit > 100
        ) {
            setError('Limit must be between 1 and 100.')
            return
        }
        nextQuery.limit = parsedLimit

        setError(null)
        setQuery(nextQuery)
    }

    async function handleDeleteAsset(asset: MediaAsset): Promise<void> {
        if (
            asset.status === 'ARCHIVED' ||
            asset.status === 'PENDING_DELETE' ||
            deletingAssetId !== null
        ) {
            return
        }

        const label = asset.originalFilename ?? `asset #${asset.id}`
        const confirmed = window.confirm(
            `Queue permanent delete for "${label}"? The file will be removed from storage and cannot be restored.`
        )
        if (!confirmed) {
            return
        }

        setDeletingAssetId(asset.id)
        setError(null)

        try {
            const queued = await deletePlatformData<MediaAsset>(
                `tenants/${id}/media/${asset.id}`
            )
            setAssets((current) =>
                current
                    ? current.map((row) =>
                          row.id === asset.id
                              ? {
                                    ...row,
                                    ...queued,
                                    status: queued.status ?? 'PENDING_DELETE',
                                    cdnUrl: null,
                                }
                              : row
                      )
                    : current
            )
        } catch (requestError: unknown) {
            if (
                requestError instanceof Error &&
                requestError.message === AUTH_REQUIRED
            ) {
                router.replace('/login')
                return
            }
            setError('Could not queue media asset deletion.')
        } finally {
            setDeletingAssetId(null)
        }
    }

    return (
        <div className="space-y-8">
                <Link className="text-sm font-medium underline-offset-4 hover:underline" href={`/tenants/${id}`}>← Tenant</Link>

                {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
                {!error && isInitialLoad ? <p aria-live="polite" className="text-sm text-muted-foreground">Loading tenant storage…</p> : null}

                {tenant ? (
                    <>
                        <PageHeader eyebrow="Tenant storage" title={tenant.name} />
                        <p className="max-w-4xl text-sm leading-6 text-muted-foreground">
                            Media for <code>{tenant.slug}</code>. Platform admins
                            can list, test-upload, and queue permanent deletes
                            (S3 remove + CDN purge via background jobs; row
                            tombstones as ARCHIVED when done). Tenant EDITOR /
                            TENANT_ADMIN use studio for day-to-day uploads;
                            USER-scoped deletes require ownership (or
                            TENANT_ADMIN).
                        </p>

                        <TenantStorageUploadForm
                            onUploaded={(uploaded) => {
                                if (uploaded) {
                                    setAssets((current) => {
                                        if (!current) {
                                            return [uploaded]
                                        }
                                        const without = current.filter(
                                            (asset) => asset.id !== uploaded.id
                                        )
                                        return [uploaded, ...without]
                                    })
                                }
                                loadStorage({assetType, status, limit})
                            }}
                            tenantId={id}
                        />

                        <h2 className="text-2xl font-semibold tracking-tight">Assets</h2>

                        <Card>
                            <CardHeader><CardTitle>Filter assets</CardTitle></CardHeader>
                            <CardContent>
                        <form
                            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
                            onSubmit={(event) => {
                                event.preventDefault()
                                applyFilters(new FormData(event.currentTarget))
                            }}
                        >
                            <div className="space-y-2">
                                <Label htmlFor="asset-type-filter">Type</Label>
                                <select
                                    className="native-select"
                                    defaultValue={query.assetType ?? ''}
                                    id="asset-type-filter"
                                    name="assetType"
                                >
                                    <option value="">All</option>
                                    {ASSET_TYPES.map((typeOption) => (
                                        <option key={typeOption} value={typeOption}>
                                            {typeOption}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="asset-status-filter">Status</Label>
                                <select
                                    className="native-select"
                                    defaultValue={query.status ?? ''}
                                    id="asset-status-filter"
                                    name="status"
                                >
                                    <option value="">All</option>
                                    {ASSET_STATUSES.map((statusOption) => (
                                        <option key={statusOption} value={statusOption}>
                                            {statusOption}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="asset-limit-filter">Limit</Label>
                                <Input
                                    defaultValue={query.limit ?? 50}
                                    id="asset-limit-filter"
                                    max={100}
                                    min={1}
                                    name="limit"
                                    type="number"
                                />
                            </div>
                            <Button className="self-end" type="submit">Apply</Button>
                        </form>
                            </CardContent>
                        </Card>

                        {assets && assets.length > 0 ? (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead scope="col">ID</TableHead>
                                        <TableHead scope="col">Filename</TableHead>
                                        <TableHead scope="col">Type</TableHead>
                                        <TableHead scope="col">Status</TableHead>
                                        <TableHead scope="col">Visibility</TableHead>
                                        <TableHead scope="col">Scope</TableHead>
                                        <TableHead scope="col">Owner</TableHead>
                                        <TableHead scope="col">CDN</TableHead>
                                        <TableHead scope="col">Size</TableHead>
                                        <TableHead scope="col">S3 key</TableHead>
                                        <TableHead scope="col">Created</TableHead>
                                        <TableHead scope="col">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {assets.map((asset) => (
                                        <TableRow
                                            className="media-asset-row"
                                            key={asset.id}
                                        >
                                            <TableCell>{asset.id}</TableCell>
                                            <TableCell>
                                                {asset.originalFilename ?? '—'}
                                            </TableCell>
                                            <TableCell>{asset.assetType}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline">{asset.status ===
                                                'PENDING_DELETE'
                                                    ? 'Queued for deletion'
                                                    : asset.status}</Badge>
                                            </TableCell>
                                            <TableCell>{asset.visibility}</TableCell>
                                            <TableCell>{asset.scope}</TableCell>
                                            <TableCell>
                                                {asset.ownerUserId ?? '—'}
                                            </TableCell>
                                            <TableCell>
                                                {(() => {
                                                    const cdnUrl = resolveCdnUrl(
                                                        asset,
                                                        publicCdnBaseUrl
                                                    )
                                                    if (cdnUrl) {
                                                        return (
                                                            <a
                                                                href={cdnUrl}
                                                                rel="noopener noreferrer"
                                                                title={cdnUrl}
                                                                target="_blank"
                                                            >
                                                                <code>{cdnUrl}</code>
                                                            </a>
                                                        )
                                                    }
                                                    if (
                                                        asset.visibility ===
                                                            'PUBLIC' &&
                                                        asset.status === 'READY'
                                                    ) {
                                                        return (
                                                            <span title="Public READY assets should include a CDN URL — check Directwerk public-cdn-base-url and redeploy if missing.">
                                                                missing
                                                            </span>
                                                        )
                                                    }
                                                    return '—'
                                                })()}
                                            </TableCell>
                                            <TableCell>
                                                {formatBytes(asset.sizeBytes)}
                                            </TableCell>
                                            <TableCell>
                                                <code>{asset.s3Key}</code>
                                            </TableCell>
                                            <TableCell>
                                                {formatTimestamp(asset.createdAt)}
                                            </TableCell>
                                            <TableCell>
                                                <Button
                                                    disabled={
                                                        asset.status ===
                                                            'ARCHIVED' ||
                                                        asset.status ===
                                                            'PENDING_DELETE' ||
                                                        deletingAssetId !== null
                                                    }
                                                    onClick={() => {
                                                        void handleDeleteAsset(
                                                            asset
                                                        )
                                                    }}
                                                    type="button"
                                                    variant="destructive"
                                                >
                                                    {deletingAssetId ===
                                                    asset.id
                                                        ? 'Queuing…'
                                                        : asset.status ===
                                                            'PENDING_DELETE'
                                                          ? 'Queued'
                                                          : 'Delete'}
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        ) : null}

                        {assets && assets.length === 0 ? (
                            <EmptyState title="No media assets for this tenant" />
                        ) : null}
                    </>
                ) : null}
        </div>
    )
}
