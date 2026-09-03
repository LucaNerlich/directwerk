'use client'

import SelectControl from '@/components/studio/SelectControl'
import UploadProgress from '@/components/media/UploadProgress'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Badge} from '@directwerk/ui/components/badge'
import {Button} from '@directwerk/ui/components/button'
import {Checkbox} from '@directwerk/ui/components/checkbox'
import EmptyState from '@directwerk/ui/components/empty-state'
import {EntityListSection} from '@directwerk/ui/components/entity-list-section'
import type {EntityListViewItem} from '@directwerk/ui/components/entity-list-view'
import {Label} from '@directwerk/ui/components/label'
import PageHeader from '@directwerk/ui/components/page-header'
import PageStack from '@directwerk/ui/components/page-stack'
import SectionHeader from '@directwerk/ui/components/section-header'
import {Skeleton} from '@directwerk/ui/components/skeleton'
import {useEntityListSelection} from '@directwerk/ui/hooks/use-entity-list-selection'
import {useListViewMode} from '@directwerk/ui/hooks/use-list-view-mode'

import {useMemo, useEffect, useRef, useState, type ChangeEvent, type DragEvent} from 'react'
import {useRouter} from 'next/navigation'

import {deleteMedia, getMediaPreviewUrl, listMedia} from '@/lib/api/mediaApi'
import type {MediaAsset} from '@directwerk/api/types'
import {MEDIA_TYPE_LIMITS} from '@/lib/media/limits'
import {uploadMediaFile} from '@/lib/media/upload'
import {assetTypeLabel, mediaStatusLabel, visibilityLabel} from '@/lib/subscription/displayLabels'
import {getClientTenantHost} from '@directwerk/api/tenant'
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
    const {viewMode, setViewMode} = useListViewMode('grid')

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

        await deleteAssets(
            pending,
            (count) => `${count} ausstehende Upload(s) entfernt.`,
        )
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

    const visibleAssets = useMemo(
        () =>
            assets.filter((asset) => {
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
            }),
        [assets, orphanOnly, statusFilter, typeFilter],
    )

    const visibleAssetIds = useMemo(
        () => visibleAssets.map((asset) => asset.id),
        [visibleAssets],
    )

    const {
        selectedIds,
        selectedCount,
        allSelected,
        toggleSelection,
        toggleSelectAll,
        clearSelection,
    } = useEntityListSelection<number>(visibleAssetIds)

    async function deleteAssets(
        targets: MediaAsset[],
        successMessage: (count: number) => string,
        onSettled?: (failureCount: number) => void,
    ): Promise<void> {
        setIsBusy(true)
        setErrorMessage(null)
        setStatusMessage(null)
        try {
            const host = getClientTenantHost()
            const results = await Promise.allSettled(
                targets.map((asset) => deleteMedia(host, asset.id)),
            )
            const deletedIds = new Set(
                targets
                    .filter((_, index) => results[index].status === 'fulfilled')
                    .map((asset) => asset.id),
            )
            const rejected = targets
                .map((asset, index) => ({asset, result: results[index]}))
                .filter(
                    (entry): entry is {
                        asset: MediaAsset
                        result: PromiseRejectedResult
                    } => entry.result.status === 'rejected',
                )

            setAssets((current) =>
                current.filter((item) => !deletedIds.has(item.id)),
            )
            onSettled?.(rejected.length)

            if (deletedIds.size > 0) {
                setStatusMessage(successMessage(deletedIds.size))
            }
            if (rejected.length > 0) {
                if (rejected.some(({result}) => authRedirect(result.reason))) return
                setErrorMessage(
                    `Löschen fehlgeschlagen für Medien-IDs: ${rejected
                        .map(({asset}) => asset.id)
                        .join(', ')}.`,
                )
            }
        } finally {
            setIsBusy(false)
        }
    }

    async function handleBulkDeleteSelected(): Promise<void> {
        const selected = visibleAssets.filter((asset) => selectedIds.has(asset.id))
        if (selected.length === 0) {
            return
        }
        if (
            !window.confirm(
                `${selected.length} ausgewählte Datei(en) endgültig löschen?`,
            )
        ) {
            return
        }

        await deleteAssets(
            selected,
            (count) => `${count} Medium/Medien gelöscht.`,
            (failureCount) => {
                if (failureCount === 0) {
                    clearSelection()
                }
            },
        )
    }

    function renderAssetPreview(asset: MediaAsset): React.JSX.Element {
        const imgSrc =
            safeImageSrc(asset.cdnUrl) ?? safeImageSrc(previewUrls[asset.id])
        if (asset.assetType === 'IMAGE' && imgSrc !== null) {
            return (
                <img
                    alt={asset.originalFilename ?? `Bild #${asset.id}`}
                    className="aspect-video w-full rounded-md object-cover"
                    src={imgSrc}
                />
            )
        }
        return (
            <div className="flex aspect-video items-center justify-center rounded-md bg-muted text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {asset.assetType}
            </div>
        )
    }

    function renderAssetMeta(asset: MediaAsset): React.JSX.Element {
        return (
            <p className="text-sm text-muted-foreground">
                {assetTypeLabel(asset.assetType)} · {mediaStatusLabel(asset.status)}
                {asset.visibility ? ` · ${visibilityLabel(asset.visibility)}` : ''}
                {' · '}
                {formatBytes(asset.sizeBytes)}
            </p>
        )
    }

    const pendingCount = assets.filter((asset) => asset.status === 'PENDING').length
    const hasActiveFilters = typeFilter.length > 0 || statusFilter.length > 0 || orphanOnly

    function resetFilters(): void {
        setTypeFilter('')
        setStatusFilter('')
        setOrphanOnly(false)
    }

    const mediaItems: EntityListViewItem<number>[] = visibleAssets.map((asset) => ({
        id: asset.id,
        title: asset.originalFilename ?? `Asset #${asset.id}`,
        trailing: (
            <Badge variant={asset.status === 'READY' ? 'secondary' : 'outline'}>
                {mediaStatusLabel(asset.status)}
            </Badge>
        ),
        leading:
            viewMode === 'list' ? (
                <div className="size-16 shrink-0 overflow-hidden rounded-md">
                    {renderAssetPreview(asset)}
                </div>
            ) : undefined,
        extra:
            viewMode === 'grid' ? (
                <>
                    {renderAssetPreview(asset)}
                    {renderAssetMeta(asset)}
                </>
            ) : undefined,
        description: viewMode === 'list' ? renderAssetMeta(asset) : undefined,
        actions: (
            <Button
                disabled={isBusy}
                onClick={() => {
                    void handleDelete(asset.id)
                }}
                size="sm"
                type="button"
                variant="outline"
            >
                Löschen
            </Button>
        ),
    }))

    if (isLoading) {
        return (
            <PageStack>
                <PageHeader
                    eyebrow="Medien"
                    title="Bibliothek"
                    description="Lade Audio, Bilder und Dokumente hoch — per Klick oder per Drag-and-drop."
                />
                <p className="text-sm text-muted-foreground" role="status">Wird geladen…</p>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
                    {[0, 1, 2].map((index) => (
                        <Skeleton className="h-44 w-full" key={index} />
                    ))}
                </div>
            </PageStack>
        )
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
        <PageStack>
            <PageHeader
                eyebrow="Medien"
                title="Bibliothek"
                description="Lade Audio, Bilder und Dokumente hoch — per Klick oder per Drag-and-drop."
                actions={uploadButton}
            />

            <input
                ref={fileInputRef}
                accept="audio/*,image/*,video/*,.pdf,.doc,.docx"
                aria-hidden="true"
                disabled={isBusy}
                hidden
                onChange={(event) => {
                    void handleUpload(event)
                }}
                tabIndex={-1}
                type="file"
            />

            <div
                aria-disabled={isBusy}
                aria-label="Datei-Upload per Drag-and-drop oder Tastatur"
                className={`rounded-xl border border-dashed px-6 py-8 text-center text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 ${
                    isDragging
                        ? 'border-primary bg-primary/5'
                        : 'border-border bg-muted/20'
                }`}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onKeyDown={(event) => {
                    if (isBusy) {
                        return
                    }
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        fileInputRef.current?.click()
                    }
                }}
                role="button"
                tabIndex={isBusy ? -1 : 0}
            >
                <p className="font-medium">
                    {isDragging ? 'Datei hier ablegen' : 'Datei hierher ziehen'}
                </p>
                <p className="mt-1 text-muted-foreground">
                    Audio, Bilder, Video oder PDF/DOC. Alternativ über „Datei hochladen“ oder Enter drücken.
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

            <section aria-labelledby="media-filter-heading" className="flex flex-col gap-4">
                <SectionHeader
                    id="media-filter-heading"
                    title="Filter"
                    description={`${visibleAssets.length} von ${assets.length} Dateien angezeigt.`}
                    action={
                        hasActiveFilters ? (
                            <Button onClick={resetFilters} size="sm" type="button" variant="ghost">
                                Filter zurücksetzen
                            </Button>
                        ) : undefined
                    }
                />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <label className="grid gap-2 text-sm font-medium" htmlFor="typeFilter">
                    Typ filtern
                    <SelectControl
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
                <Label className="flex items-end gap-2 text-sm font-medium">
                    <Checkbox
                        checked={orphanOnly}
                        id="orphanFilter"
                        onCheckedChange={(checked) => setOrphanOnly(checked === true)}
                    />
                    <span>Nur unverknüpfte Dateien</span>
                </Label>
            </div>
            </section>

            {pendingCount > 0 ? (
                <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed bg-muted/30 px-4 py-3 text-sm">
                    <Badge variant="outline">{pendingCount} ausstehend</Badge>
                    <span className="text-muted-foreground">Ausstehende Uploads wurden noch nicht bestätigt.</span>
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
                <Alert variant="destructive">
                    <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
            ) : null}
            {statusMessage !== null ? (
                <Alert role="status">
                    <AlertDescription>{statusMessage}</AlertDescription>
                </Alert>
            ) : null}

            {assets.length === 0 ? (
                <EmptyState
                    title="Noch keine Medien"
                    description="Lade die erste Datei hoch, um sie später in Folgen und Beiträgen zu verwenden."
                    action={uploadButton}
                />
            ) : visibleAssets.length === 0 ? (
                <EmptyState
                    title="Keine Medien für diesen Filter"
                    description="Passe Typ, Status oder die Auswahl „Nur unverknüpfte Dateien“ an."
                    action={
                        <Button onClick={resetFilters} type="button" variant="outline">
                            Filter zurücksetzen
                        </Button>
                    }
                />
            ) : (
                <EntityListSection
                    allSelected={allSelected}
                    bulkActions={
                        selectedCount > 0 ? (
                            <Button
                                disabled={isBusy}
                                onClick={() => void handleBulkDeleteSelected()}
                                size="sm"
                                type="button"
                                variant="outline"
                            >
                                {isBusy ? 'Wird gelöscht…' : `${selectedCount} löschen`}
                            </Button>
                        ) : null
                    }
                    disabled={isBusy}
                    gridClassName="lg:grid-cols-3"
                    items={mediaItems}
                    onToggleSelectAll={toggleSelectAll}
                    onToggleSelection={toggleSelection}
                    onViewModeChange={setViewMode}
                    selectAllLabel="Alle Medien auswählen"
                    selectedIds={selectedIds}
                    selectable
                    viewMode={viewMode}
                />
            )}
        </PageStack>
    )
}
