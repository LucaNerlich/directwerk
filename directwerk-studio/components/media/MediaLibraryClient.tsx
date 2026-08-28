'use client'

import SelectControl from '@/components/studio/SelectControl'
import UploadProgress from '@/components/media/UploadProgress'

import {Button} from '@directwerk/ui/components/button'
import EmptyState from '@directwerk/ui/components/empty-state'
import PageHeader from '@directwerk/ui/components/page-header'

import {useEffect, useRef, useState, type ChangeEvent, type DragEvent} from 'react'
import {useRouter} from 'next/navigation'

import {deleteMedia, getMediaPreviewUrl, listMedia} from '@/lib/api/mediaApi'
import type {MediaAsset} from '@directwerk/api/types'
import {MEDIA_TYPE_LIMITS} from '@/lib/media/limits'
import {uploadMediaFile} from '@/lib/media/upload'
import {getClientTenantHost} from '@/lib/tenant/getClientTenantHost'
import {safeImageSrc} from '@/lib/url/safeUrl'
import {useAuthRequired} from '@directwerk/api/auth/useAuthRequired'

function formatBytes(sizeBytes: number | null): string {
    if (sizeBytes === null || sizeBytes <= 0) {
        return '—'
    }
    if (sizeBytes < 1024) {
        return `${sizeBytes} B`
    }
    if (sizeBytes < 1024 * 1024) {
        return `${(sizeBytes / 1024).toFixed(1)} KB`
    }
    return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`
}

function resolveAssetType(
    file: File,
): 'AUDIO' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | null {
    const mime = file.type.toLowerCase()
    if (mime.startsWith('audio/')) {
        return 'AUDIO'
    }
    if (mime.startsWith('image/')) {
        return 'IMAGE'
    }
    if (mime.startsWith('video/')) {
        return 'VIDEO'
    }
    const name = file.name.toLowerCase()
    if (
        mime === 'application/pdf' ||
        mime === 'application/msword' ||
        mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        name.endsWith('.pdf') ||
        name.endsWith('.doc') ||
        name.endsWith('.docx')
    ) {
        return 'DOCUMENT'
    }
    return null
}

/**
 * Fetches presigned preview URLs through a small worker pool so a library full of
 * private images cannot fire dozens of presign requests simultaneously.
 * Returns {id, url} pairs; assets whose fetch failed are simply absent.
 */
async function fetchPreviewUrls(
    tenantHost: string,
    assetIds: number[],
    concurrency = 4,
): Promise<Record<number, string>> {
    const urls: Record<number, string> = {}
    let cursor = 0

    async function worker(): Promise<void> {
        while (cursor < assetIds.length) {
            const assetId = assetIds[cursor]
            cursor += 1
            try {
                urls[assetId] = await getMediaPreviewUrl(tenantHost, assetId)
            } catch {
                // Keep the placeholder for this asset.
            }
        }
    }

    await Promise.all(
        Array.from({length: Math.min(concurrency, assetIds.length)}, () => worker()),
    )
    return urls
}

export default function MediaLibraryClient(): React.JSX.Element {
    const router = useRouter()
    const authRedirect = useAuthRequired()
    const fileInputRef = useRef<HTMLInputElement>(null)
    const mountedRef = useRef(true)
    const [assets, setAssets] = useState<MediaAsset[]>([])
    const [previewUrls, setPreviewUrls] = useState<Record<number, string>>({})
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [statusMessage, setStatusMessage] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isBusy, setIsBusy] = useState(false)
    const [isDragging, setIsDragging] = useState(false)
    const [typeFilter, setTypeFilter] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [orphanOnly, setOrphanOnly] = useState(false)
    const [uploadProgress, setUploadProgress] = useState<{file: File; progress: number} | null>(
        null,
    )

    async function reload(): Promise<void> {
        const result = await listMedia(getClientTenantHost())
        setAssets(result)

        const privateImageIds = result
            .filter((a) => a.assetType === 'IMAGE' && a.cdnUrl == null)
            .map((a) => a.id)
        if (privateImageIds.length > 0) {
            void fetchPreviewUrls(getClientTenantHost(), privateImageIds).then(
                (urls) => {
                    if (!mountedRef.current || Object.keys(urls).length === 0) {
                        return
                    }
                    setPreviewUrls((prev) => ({...prev, ...urls}))
                },
            )
        }
    }

    useEffect(() => {
        mountedRef.current = true
        let active = true

        reload()
            .then(() => {
                if (active) {
                    setIsLoading(false)
                }
            })
            .catch((error: unknown) => {
                if (!active) {
                    return
                }
                if (authRedirect(error)) return
                setErrorMessage(
                    error instanceof Error
                        ? error.message
                        : 'Medien konnten nicht geladen werden.',
                )
                setIsLoading(false)
            })

        return () => {
            active = false
            mountedRef.current = false
        }
    }, [router])

    async function uploadFile(file: File | undefined): Promise<void> {
        if (file === undefined) {
            return
        }

        const assetType = resolveAssetType(file)
        if (assetType === null) {
            setErrorMessage(
                'Nur Audio, Bilder, Video oder Dokumente (PDF, DOC, DOCX) sind erlaubt.',
            )
            return
        }

        setIsBusy(true)
        setErrorMessage(null)
        setStatusMessage(null)
        setUploadProgress({file, progress: 0})

        try {
            await uploadMediaFile(getClientTenantHost(), file, {
                assetType,
                visibility: 'PRIVATE',
                onProgress: (percent) => {
                    if (mountedRef.current) {
                        setUploadProgress({file, progress: percent})
                    }
                },
            })
            if (!mountedRef.current) {
                return
            }
            await reload()
            if (!mountedRef.current) {
                return
            }
            setStatusMessage(`Hochgeladen: ${file.name}`)
        } catch (error: unknown) {
            if (!mountedRef.current) {
                return
            }
            if (authRedirect(error)) return
            setErrorMessage(
                error instanceof Error ? error.message : 'Upload fehlgeschlagen.',
            )
        } finally {
            if (mountedRef.current) {
                setIsBusy(false)
                setUploadProgress(null)
            }
        }
    }

    async function handleUpload(event: ChangeEvent<HTMLInputElement>): Promise<void> {
        const file = event.target.files?.[0]
        event.target.value = ''
        await uploadFile(file)
    }

    function handleDragOver(event: DragEvent<HTMLDivElement>): void {
        event.preventDefault()
        event.stopPropagation()
        if (!isBusy) {
            setIsDragging(true)
        }
    }

    function handleDragLeave(event: DragEvent<HTMLDivElement>): void {
        event.preventDefault()
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setIsDragging(false)
        }
    }

    function handleDrop(event: DragEvent<HTMLDivElement>): void {
        event.preventDefault()
        event.stopPropagation()
        setIsDragging(false)
        if (isBusy) {
            return
        }
        void uploadFile(event.dataTransfer.files[0])
    }

    async function handleBulkDeletePending(): Promise<void> {
        const pending = assets.filter((asset) => asset.status === 'PENDING')
        if (pending.length === 0) {
            setStatusMessage('Keine ausstehenden Uploads zum Entfernen.')
            return
        }
        if (
            !window.confirm(
                `${pending.length} ausstehende Upload(s) endgültig löschen?`,
            )
        ) {
            return
        }

        setIsBusy(true)
        setErrorMessage(null)
        setStatusMessage(null)
        try {
            const host = getClientTenantHost()
            await Promise.all(pending.map((asset) => deleteMedia(host, asset.id)))
            setAssets((current) => current.filter((item) => item.status !== 'PENDING'))
            setStatusMessage(`${pending.length} ausstehende Upload(s) entfernt.`)
        } catch (error: unknown) {
            if (authRedirect(error)) return
            setErrorMessage(
                error instanceof Error
                    ? error.message
                    : 'Ausstehende Uploads konnten nicht entfernt werden.',
            )
        } finally {
            setIsBusy(false)
        }
    }

    async function handleDelete(assetId: number): Promise<void> {
        setIsBusy(true)
        setErrorMessage(null)
        setStatusMessage(null)
        try {
            await deleteMedia(getClientTenantHost(), assetId)
            setAssets((current) => current.filter((item) => item.id !== assetId))
            setStatusMessage('Medium gelöscht.')
        } catch (error: unknown) {
            if (authRedirect(error)) return
            setErrorMessage(
                error instanceof Error ? error.message : 'Löschen fehlgeschlagen.',
            )
        } finally {
            setIsBusy(false)
        }
    }

    const visibleAssets = assets.filter((asset) => {
        if (typeFilter.length > 0 && asset.assetType !== typeFilter) {
            return false
        }
        if (statusFilter.length > 0 && asset.status !== statusFilter) {
            return false
        }
        if (orphanOnly && asset.episodeId !== null) {
            return false
        }
        return true
    })

    const pendingCount = assets.filter((asset) => asset.status === 'PENDING').length

    if (isLoading) {
        return <p>Wird geladen…</p>
    }

    const uploadButton = (
        <Button
            disabled={isBusy}
            onClick={() => fileInputRef.current?.click()}
            type="button"
        >
            Datei hochladen
        </Button>
    )

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                eyebrow="Medien"
                title="Bibliothek"
                description="Lade Audio, Bilder und Dokumente hoch — per Klick oder per Drag-and-drop."
                actions={uploadButton}
            />

            <input
                ref={fileInputRef}
                accept="audio/*,image/*,video/*,.pdf,.doc,.docx"
                disabled={isBusy}
                hidden
                onChange={(event) => {
                    void handleUpload(event)
                }}
                type="file"
            />

            <div
                className={`rounded-xl border border-dashed px-6 py-8 text-center text-sm ${
                    isDragging
                        ? 'border-primary bg-primary/5'
                        : 'border-border bg-muted/20'
                }`}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
            >
                <p className="font-medium">
                    {isDragging ? 'Datei hier ablegen' : 'Datei hierher ziehen'}
                </p>
                <p className="mt-1 text-muted-foreground">
                    Audio, Bilder, Video oder PDF/DOC. Alternativ über „Datei hochladen“.
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                    Audio bis {MEDIA_TYPE_LIMITS.AUDIO.label} · Video bis {MEDIA_TYPE_LIMITS.VIDEO.label}
                    {' · '}Bilder bis {MEDIA_TYPE_LIMITS.IMAGE.label} · Dokumente bis {MEDIA_TYPE_LIMITS.DOCUMENT.label}
                </p>
            </div>

            {uploadProgress !== null ? (
                <UploadProgress
                    file={uploadProgress.file}
                    progress={uploadProgress.progress}
                />
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <label className="grid gap-2 text-sm font-medium" htmlFor="typeFilter">
                    Typ filtern
                    <SelectControl
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                        id="typeFilter"
                        onChange={(event) => setTypeFilter(event.target.value)}
                        value={typeFilter}
                    >
                        <option value="">Alle</option>
                        <option value="AUDIO">Audio</option>
                        <option value="IMAGE">Bild</option>
                        <option value="VIDEO">Video</option>
                        <option value="DOCUMENT">Dokument</option>
                    </SelectControl>
                </label>
                <label className="grid gap-2 text-sm font-medium" htmlFor="statusFilter">
                    Status filtern
                    <SelectControl
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                        id="statusFilter"
                        onChange={(event) => setStatusFilter(event.target.value)}
                        value={statusFilter}
                    >
                        <option value="">Alle</option>
                        <option value="PENDING">Ausstehend</option>
                        <option value="READY">Bereit</option>
                        <option value="ARCHIVED">Archiviert</option>
                    </SelectControl>
                </label>
                <label className="flex items-end gap-2 text-sm font-medium">
                    <input
                        checked={orphanOnly}
                        className="size-4 shrink-0"
                        id="orphanFilter"
                        onChange={(event) => setOrphanOnly(event.target.checked)}
                        type="checkbox"
                    />
                    <span>Nur unverknüpfte Dateien</span>
                </label>
            </div>

            {pendingCount > 0 ? (
                <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed bg-muted/30 px-4 py-3 text-sm">
                    <span>{pendingCount} ausstehende Upload(s)</span>
                    <Button
                        disabled={isBusy}
                        onClick={() => void handleBulkDeletePending()}
                        size="sm"
                        type="button"
                        variant="outline"
                    >
                        Alle ausstehenden entfernen
                    </Button>
                </div>
            ) : null}

            {errorMessage !== null ? (
                <p className="text-sm text-destructive" role="alert">
                    {errorMessage}
                </p>
            ) : null}
            {statusMessage !== null ? <p role="status">{statusMessage}</p> : null}

            {assets.length === 0 ? (
                <EmptyState
                    title="Noch keine Medien"
                    description="Lade die erste Datei hoch, um sie später in Folgen und Beiträgen zu verwenden."
                    action={uploadButton}
                />
            ) : visibleAssets.length === 0 ? (
                <p className="text-sm text-muted-foreground">Keine Medien für diesen Filter.</p>
            ) : (
                <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {visibleAssets.map((asset) => {
                        const imgSrc =
                            safeImageSrc(asset.cdnUrl) ??
                            safeImageSrc(previewUrls[asset.id])
                        return (
                            <li
                                className="flex flex-col gap-3 rounded-xl border bg-card p-4"
                                key={asset.id}
                            >
                            {asset.assetType === 'IMAGE' &&
                            imgSrc !== null ? (
                                <img
                                    alt={asset.originalFilename ?? `Bild #${asset.id}`}
                                    className="aspect-video w-full rounded-md object-cover"
                                    src={imgSrc}
                                />
                            ) : (
                                <div className="flex aspect-video items-center justify-center rounded-md bg-muted text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                    {asset.assetType}
                                </div>
                            )}
                            <div className="min-w-0">
                                <strong className="block truncate">
                                    {asset.originalFilename ?? `Asset #${asset.id}`}
                                </strong>
                                <small className="text-muted-foreground">
                                    {asset.assetType} · {asset.status}
                                    {asset.visibility ? ` · ${asset.visibility}` : ''}
                                    {' · '}
                                    {formatBytes(asset.sizeBytes)}
                                </small>
                            </div>
                            <Button
                                disabled={isBusy}
                                onClick={() => {
                                    void handleDelete(asset.id)
                                }}
                                type="button"
                                variant="outline"
                            >
                                Löschen
                            </Button>
                        </li>
                        )
                    })}
                </ul>
            )}
        </div>
    )
}
