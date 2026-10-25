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

import {
    createMediaFolder,
    deleteMedia,
    deleteMediaFolder,
    getMediaPreviewUrl,
    getMediaUploadLimits,
    listMedia,
    listMediaFolders,
    moveMediaAsset,
    moveMediaFolder,
    renameMediaAsset,
    renameMediaFolder,
    type MediaFolderDeleteMode,
} from '@/lib/api/mediaApi'
import type {MediaAsset, MediaFolder, MediaUploadLimits} from '@directwerk/api/types'
import {MEDIA_TYPE_LIMITS, mediaLimitLabelFor, resolveMediaLimits} from '@/lib/media/limits'
import {
    assetFolderId,
    childFolders,
    descendantFolderIds,
    folderErrorMessage,
    folderParentId,
    folderPath,
    folderTileAssetCount,
} from '@/lib/media/folders'
import MediaAudioPreview from '@/components/media/MediaAudioPreview'
import MediaAssetDetailPanel from '@/components/media/MediaAssetDetailPanel'
import MediaFolderDeleteDialog from '@/components/media/MediaFolderDeleteDialog'
import MediaAssetRenameDialog from '@/components/media/MediaAssetRenameDialog'
import MediaFolderDialog from '@/components/media/MediaFolderDialog'
import MediaMoveDialog from '@/components/media/MediaMoveDialog'
import {uploadMediaFile} from '@/lib/media/upload'
import {formatBytes} from '@directwerk/api/format/bytes'
import {assetTypeLabel, mediaStatusLabel, visibilityLabel} from '@/lib/subscription/displayLabels'
import {getClientTenantHost} from '@directwerk/api/tenant'
import {safeImageSrc} from '@/lib/url/safeUrl'
import {useAuthRequired} from '@directwerk/api/auth/useAuthRequired'
import {useDictionary} from '@/components/i18n/LocaleProvider'

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
                urls[assetId] = await getMediaPreviewUrl( assetId)
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

const MEDIA_PAGE_SIZE = 100

export default function MediaLibraryClient(): React.JSX.Element {
    const dict = useDictionary()
    const router = useRouter()
    const authRedirect = useAuthRequired()
    const fileInputRef = useRef<HTMLInputElement>(null)
    const mountedRef = useRef(true)
    const loadSequenceRef = useRef(0)
    const folderViewRef = useRef<number | null>(null)
    const includeSubfoldersRef = useRef(false)
    const orphanOnlyRef = useRef(false)
    const [assets, setAssets] = useState<MediaAsset[]>([])
    // The endpoint pages with offset/limit (media-library pages are capped at 100 rows).
    const [hasMoreAssets, setHasMoreAssets] = useState(false)
    const [folders, setFolders] = useState<MediaFolder[]>([])
    const [uploadLimits, setUploadLimits] = useState(() => MEDIA_TYPE_LIMITS)
    const [previewUrls, setPreviewUrls] = useState<Record<number, string>>({})
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [statusMessage, setStatusMessage] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isBusy, setIsBusy] = useState(false)
    const [isDragging, setIsDragging] = useState(false)
    const [reloadToken, setReloadToken] = useState(0)
    const [typeFilter, setTypeFilter] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [orphanOnly, setOrphanOnly] = useState(false)
    const [folderView, setFolderView] = useState<number | null>(null)
    const [includeSubfolders, setIncludeSubfolders] = useState(false)
    const [folderDialog, setFolderDialog] = useState<
        {mode: 'create'} | {mode: 'rename'; folder: MediaFolder} | null
    >(null)
    const [moveState, setMoveState] = useState<
        {assets: MediaAsset[]; title: string} | null
    >(null)
    const [moveFolderState, setMoveFolderState] = useState<MediaFolder | null>(null)
    const moveExcludeFolderIds = useMemo(
        () =>
            moveFolderState === null
                ? undefined
                : new Set([
                      moveFolderState.id,
                      ...descendantFolderIds(folders, moveFolderState.id),
                  ]),
        [folders, moveFolderState],
    )
    const [deleteFolderTarget, setDeleteFolderTarget] = useState<MediaFolder | null>(null)
    const [renameAssetTarget, setRenameAssetTarget] = useState<MediaAsset | null>(null)
    const [detailAsset, setDetailAsset] = useState<MediaAsset | null>(null)
    const [renameAssetError, setRenameAssetError] = useState<string | null>(null)
    const [folderDialogError, setFolderDialogError] = useState<string | null>(null)
    const [uploadProgress, setUploadProgress] = useState<{file: File; progress: number} | null>(
        null,
    )
    const [failedUpload, setFailedUpload] = useState<{file: File} | null>(null)
    const {viewMode, setViewMode} = useListViewMode('grid')

    // Keep the refs current so a reload started before the user navigated (e.g. the post-upload
    // refresh) loads the folder they are looking at now (issue #587).
    useEffect(() => {
        folderViewRef.current = folderView
    }, [folderView])
    useEffect(() => {
        includeSubfoldersRef.current = includeSubfolders
    }, [includeSubfolders])
    useEffect(() => {
        orphanOnlyRef.current = orphanOnly
    }, [orphanOnly])

    async function loadMoreAssets(): Promise<void> {
        const currentFolderView = folderViewRef.current
        const currentIncludeSubfolders = includeSubfoldersRef.current
        const currentOrphanOnly = orphanOnlyRef.current
        const page = await listMedia({
            limit: MEDIA_PAGE_SIZE,
            offset: assets.length,
            folderId: currentFolderView ?? undefined,
            recursive: currentIncludeSubfolders,
            unassignedOnly: currentFolderView === null && !currentIncludeSubfolders,
            ...(currentOrphanOnly ? {unreferencedOnly: true} : {}),
        })
        setAssets((current) => [
            ...current,
            ...page.filter((item) => !current.some((existing) => existing.id === item.id)),
        ])
        setHasMoreAssets(page.length === MEDIA_PAGE_SIZE)
    }

    async function reload(): Promise<void> {
        const sequence = ++loadSequenceRef.current
        const currentFolderView = folderViewRef.current
        const currentIncludeSubfolders = includeSubfoldersRef.current
        const currentOrphanOnly = orphanOnlyRef.current
        let result: [MediaAsset[], MediaFolder[]]
        try {
            result = await Promise.all([
                listMedia( {
                    limit: MEDIA_PAGE_SIZE,
                    offset: 0,
                    folderId: currentFolderView ?? undefined,
                    recursive: currentIncludeSubfolders,
                    unassignedOnly: currentFolderView === null && !currentIncludeSubfolders,
                    ...(currentOrphanOnly ? {unreferencedOnly: true} : {}),
                }),
                listMediaFolders(),
            ])
        } catch (error) {
            // A failed post-upload reload has no effect catch of its own, so a superseding
            // load must end its own skeleton here instead of leaving it up forever.
            if (sequence === loadSequenceRef.current && mountedRef.current) {
                setIsLoading(false)
            }
            throw error
        }
        const [assetResult, folderResult] = result
        // Limits are display hints only — the backend enforces the truth, so a
        // failed fetch keeps the platform defaults instead of failing the page.
        let effective: MediaUploadLimits | null = null
        try {
            effective = await getMediaUploadLimits()
        } catch {
            effective = null
        }
        // Issue #587: a slower, older response must not overwrite a newer load.
        // Only the load whose rows are applied may end the skeleton: a discarded response must
        // not show the previous folder's (empty) list, and an upload reload that supersedes the
        // effect's load still has to clear it.
        if (sequence !== loadSequenceRef.current || !mountedRef.current) {
            return
        }
        setAssets(assetResult)
        setHasMoreAssets(assetResult.length === MEDIA_PAGE_SIZE)
        setFolders(folderResult)
        setUploadLimits(resolveMediaLimits(effective))

        const privateImageIds = assetResult
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
        setIsLoading(false)
    }

    useEffect(() => {
        mountedRef.current = true
        let active = true

        setIsLoading(true)
        setErrorMessage(null)
        reload()
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
    }, [folderView, includeSubfolders, orphanOnly, reloadToken, router])

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
        setFailedUpload(null)
        setUploadProgress({file, progress: 0})

        try {
            await uploadMediaFile(getClientTenantHost(), file, {
                assetType,
                visibility: 'PRIVATE',
                folderId: folderView ?? undefined,
                limits: uploadLimits,
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
            setFailedUpload({file})
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
            await deleteMedia( assetId)
            // Reload so folder tiles pick up fresh API assetCount (not stale optimistic list).
            await reload()
            if (!mountedRef.current) {
                return
            }
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

    async function handleRenameAsset(filename: string): Promise<void> {
        if (renameAssetTarget === null) {
            return
        }
        const target = renameAssetTarget
        setIsBusy(true)
        setRenameAssetError(null)
        setErrorMessage(null)
        setStatusMessage(null)
        try {
            const renamed = await renameMediaAsset( target.id, filename)
            setAssets((current) =>
                current.map((item) => (item.id === renamed.id ? renamed : item)),
            )
            setRenameAssetTarget(null)
            setStatusMessage(`Datei in „${renamed.originalFilename ?? renamed.id}“ umbenannt.`)
        } catch (error: unknown) {
            if (authRedirect(error)) return
            setRenameAssetError(
                error instanceof Error ? error.message : 'Umbenennen fehlgeschlagen.',
            )
        } finally {
            setIsBusy(false)
        }
    }

    const visibleAssets = useMemo(() => {
        const acceptedFolders = new Set<number | null>()
        if (folderView === null) {
            acceptedFolders.add(null)
            if (includeSubfolders) {
                for (const folder of folders) {
                    acceptedFolders.add(folder.id)
                }
            }
        } else {
            acceptedFolders.add(folderView)
            if (includeSubfolders) {
                for (const id of descendantFolderIds(folders, folderView)) {
                    acceptedFolders.add(id)
                }
            }
        }
        return assets.filter((asset) => {
            if (typeFilter.length > 0 && asset.assetType !== typeFilter) {
                return false
            }
            if (statusFilter.length > 0 && asset.status !== statusFilter) {
                return false
            }
            if (!acceptedFolders.has(assetFolderId(asset))) {
                return false
            }
            return true
        })
    }, [assets, folders, folderView, includeSubfolders, statusFilter, typeFilter])

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
            const results = await Promise.allSettled(
                targets.map((asset) => deleteMedia( asset.id)),
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

            onSettled?.(rejected.length)

            if (deletedIds.size > 0) {
                // Reload so folder tiles pick up fresh API assetCount (not stale optimistic list).
                await reload()
                if (!mountedRef.current) {
                    return
                }
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

    function openFolderDialog(dialog: {mode: 'create'} | {mode: 'rename'; folder: MediaFolder}): void {
        setFolderDialogError(null)
        setFolderDialog(dialog)
    }

    async function handleFolderSubmit(name: string, parentId: number | null): Promise<void> {
        if (folderDialog === null) {
            return
        }
        setIsBusy(true)
        setFolderDialogError(null)
        try {
            const folder =
                folderDialog.mode === 'create'
                    ? await createMediaFolder( name, parentId)
                    : await renameMediaFolder( folderDialog.folder.id, name)
            setFolders((current) => {
                const next = current.filter((entry) => entry.id !== folder.id)
                return [...next, folder]
            })
            setFolderDialog(null)
            setStatusMessage(
                folderDialog.mode === 'create'
                    ? `Ordner „${folder.name}“ angelegt.`
                    : `Ordner in „${folder.name}“ umbenannt.`,
            )
        } catch (error) {
            if (authRedirect(error)) return
            setFolderDialogError(folderErrorMessage(error))
        } finally {
            setIsBusy(false)
        }
    }

    async function handleMoveSubmit(targetId: number | null): Promise<void> {
        if (moveState === null && moveFolderState === null) {
            return
        }
        if (moveFolderState !== null) {
            const movedId = moveFolderState.id
            setIsBusy(true)
            setFolderDialogError(null)
            try {
                const moved = await moveMediaFolder( movedId, targetId)
                setFolders((current) =>
                    current.map((entry) => (entry.id === moved.id ? moved : entry)),
                )
                setMoveFolderState(null)
                setStatusMessage(`Ordner „${moved.name}“ verschoben.`)
            } catch (error) {
                if (authRedirect(error)) return
                setFolderDialogError(folderErrorMessage(error))
            } finally {
                setIsBusy(false)
            }
            return
        }

        const targets = moveState?.assets ?? []
        setIsBusy(true)
        setFolderDialogError(null)
        setErrorMessage(null)
        setStatusMessage(null)
        try {
            const results = await Promise.allSettled(
                targets.map((asset) => moveMediaAsset( asset.id, targetId)),
            )
            const movedById = new Map<number, MediaAsset>()
            const failures: number[] = []
            results.forEach((result, index) => {
                if (result.status === 'fulfilled') {
                    movedById.set(result.value.id, result.value)
                } else {
                    failures.push(targets[index].id)
                }
            })
            if (movedById.size > 0) {
                // Reload so folder tiles pick up fresh API assetCount (not stale optimistic list).
                await reload()
                if (!mountedRef.current) {
                    return
                }
                clearSelection()
            }
            if (failures.length === 0) {
                setMoveState(null)
                setStatusMessage(
                    targetId === null
                        ? `${movedById.size} Datei(en) in die Bibliothek verschoben.`
                        : `${movedById.size} Datei(en) verschoben.`,
                )
            } else {
                if (results.some((result) => result.status === 'rejected'
                    && authRedirect((result as PromiseRejectedResult).reason))) {
                    return
                }
                setFolderDialogError(
                    `Verschieben fehlgeschlagen für Medien-IDs: ${failures.join(', ')}.`,
                )
            }
        } finally {
            setIsBusy(false)
        }
    }

    async function handleDeleteFolder(mode: MediaFolderDeleteMode): Promise<void> {
        if (deleteFolderTarget === null) {
            return
        }
        const target = deleteFolderTarget
        setIsBusy(true)
        setFolderDialogError(null)
        try {
            await deleteMediaFolder( target.id, mode)
            setDeleteFolderTarget(null)
            // Issue #412: setFolderView triggers the [folderView] load effect. Calling reload()
            // here would close over the *previous* render's folderView — i.e. the folder just
            // deleted — so it queried the deleted folder and flashed stale content.
            setFolderView(folderParentId(target))
            setStatusMessage(`Ordner „${target.name}“ gelöscht.`)
        } catch (error) {
            if (authRedirect(error)) return
            setFolderDialogError(folderErrorMessage(error))
        } finally {
            setIsBusy(false)
        }
    }

    function rememberPreviewUrl(assetId: number, url: string): void {
        setPreviewUrls((prev) => {
            if (prev[assetId] === url) {
                return prev
            }
            return {...prev, [assetId]: url}
        })
    }

    function renderTypePlaceholder(assetType: string): React.JSX.Element {
        return (
            <div className="flex aspect-video items-center justify-center rounded-md bg-muted text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {assetType}
            </div>
        )
    }

    function renderAudioPreview(asset: MediaAsset): React.JSX.Element {
        return (
            <MediaAudioPreview
                assetId={asset.id}
                cachedPreviewUrl={previewUrls[asset.id] ?? null}
                cdnUrl={asset.cdnUrl}
                onPreviewUrl={rememberPreviewUrl}
                status={asset.status}
            />
        )
    }

    function renderAssetPreview(asset: MediaAsset): React.JSX.Element {
        if (asset.assetType === 'AUDIO') {
            return renderAudioPreview(asset)
        }
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
        return renderTypePlaceholder(asset.assetType)
    }

    function renderAssetMeta(asset: MediaAsset): React.JSX.Element {
        return (
            <p className="text-sm text-muted-foreground">
                {assetTypeLabel(asset.assetType)} · {mediaStatusLabel(asset.status)}
                {asset.visibility ? ` · ${visibilityLabel(asset.visibility)}` : ''}
                {' · '}
                {formatBytes(asset.sizeBytes) ?? '—'}
            </p>
        )
    }

    const pendingCount = assets.filter((asset) => asset.status === 'PENDING').length
    const hasActiveFilters = typeFilter.length > 0 || statusFilter.length > 0 || orphanOnly
    const breadcrumb = folderPath(folders, folderView)
    const currentFolder =
        folderView !== null
            ? (folders.find((folder) => folder.id === folderView) ?? null)
            : null
    const visibleChildFolders = childFolders(folders, folderView)
    const currentFolderName =
        currentFolder !== null ? currentFolder.name : 'Bibliothek'

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
                    {/* List thumbs are too small for controls; audio plays in `extra`. */}
                    {asset.assetType === 'AUDIO'
                        ? renderTypePlaceholder(asset.assetType)
                        : renderAssetPreview(asset)}
                </div>
            ) : undefined,
        extra:
            viewMode === 'grid' ? (
                <>
                    {renderAssetPreview(asset)}
                    {renderAssetMeta(asset)}
                </>
            ) : asset.assetType === 'AUDIO' ? (
                renderAudioPreview(asset)
            ) : undefined,
        description: viewMode === 'list' ? renderAssetMeta(asset) : undefined,
        actions: (
            <span className="flex flex-wrap gap-1">
                <Button
                    disabled={isBusy}
                    onClick={() => {
                        setDetailAsset(asset)
                    }}
                    size="sm"
                    type="button"
                    variant="outline"
                >
                    {dict.media.details}
                </Button>
                <Button
                    disabled={isBusy}
                    onClick={() => {
                        setRenameAssetError(null)
                        setRenameAssetTarget(asset)
                    }}
                    size="sm"
                    type="button"
                    variant="outline"
                >
                    Umbenennen
                </Button>
                <Button
                    disabled={isBusy}
                    onClick={() => {
                        setFolderDialogError(null)
                        setMoveState({
                            assets: [asset],
                            title: `„${asset.originalFilename ?? `Asset #${asset.id}`}“ verschieben`,
                        })
                    }}
                    size="sm"
                    type="button"
                    variant="outline"
                >
                    Verschieben
                </Button>
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
            </span>
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
                    {folderView !== null && currentFolder !== null
                        ? ` Uploads landen in „${currentFolder.name}“.`
                        : ''}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                    Audio bis {mediaLimitLabelFor(uploadLimits, 'AUDIO')} · Video bis {mediaLimitLabelFor(uploadLimits, 'VIDEO')}
                    {' · '}Bilder bis {mediaLimitLabelFor(uploadLimits, 'IMAGE')} · Dokumente bis {mediaLimitLabelFor(uploadLimits, 'DOCUMENT')}
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
                    description={`${visibleAssets.length} von ${assets.length} geladenen Dateien angezeigt · Ort: ${currentFolderName}${includeSubfolders ? ' (inkl. Unterordner)' : ''}.`}
                    action={
                        hasActiveFilters ? (
                            <Button onClick={resetFilters} size="sm" type="button" variant="ghost">
                                Filter zurücksetzen
                            </Button>
                        ) : undefined
                    }
                />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
                    <span>{dict.media.unverknuepfteDateien}</span>
                </Label>
                <Label className="flex items-end gap-2 text-sm font-medium">
                    <Checkbox
                        checked={includeSubfolders}
                        id="subfolderFilter"
                        onCheckedChange={(checked) => setIncludeSubfolders(checked === true)}
                    />
                    <span>{dict.media.unterordnerEinbeziehen}</span>
                </Label>
            </div>
            </section>

            <section aria-label="Ordner" className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-1">
                    <nav aria-label="Brotkrumen" className="flex min-w-0 flex-wrap items-center gap-1 text-sm">
                        <Button
                            onClick={() => setFolderView(null)}
                            size="sm"
                            type="button"
                            variant={folderView === null ? 'secondary' : 'ghost'}
                        >
                            Bibliothek
                        </Button>
                        {breadcrumb.map((segment) => (
                            <span className="flex items-center gap-1" key={segment.id}>
                                <span aria-hidden="true" className="text-muted-foreground">/</span>
                                <Button
                                    onClick={() => setFolderView(segment.id)}
                                    size="sm"
                                    type="button"
                                    variant={segment.id === folderView ? 'secondary' : 'ghost'}
                                >
                                    {segment.name}
                                </Button>
                            </span>
                        ))}
                    </nav>
                    <Button
                        className="ml-auto"
                        disabled={isBusy}
                        onClick={() => openFolderDialog({mode: 'create'})}
                        size="sm"
                        type="button"
                        variant="outline"
                    >
                        Neuer Ordner
                    </Button>
                </div>
                {currentFolder !== null ? (
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                        <span className="text-muted-foreground">
                            Ordner „{currentFolder.name}“ verwalten:
                        </span>
                        <Button
                            disabled={isBusy}
                            onClick={() => openFolderDialog({mode: 'rename', folder: currentFolder})}
                            size="sm"
                            type="button"
                            variant="outline"
                        >
                            Umbenennen
                        </Button>
                        <Button
                            disabled={isBusy}
                            onClick={() => {
                                setFolderDialogError(null)
                                setMoveFolderState(currentFolder)
                            }}
                            size="sm"
                            type="button"
                            variant="outline"
                        >
                            Verschieben
                        </Button>
                        <Button
                            disabled={isBusy}
                            onClick={() => {
                                setFolderDialogError(null)
                                setDeleteFolderTarget(currentFolder)
                            }}
                            size="sm"
                            type="button"
                            variant="outline"
                        >
                            Löschen
                        </Button>
                    </div>
                ) : null}
                {visibleChildFolders.length > 0 ? (
                    <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                        {visibleChildFolders.map((folder) => {
                            const fileCount = folderTileAssetCount(folder, assets)
                            const subCount = childFolders(folders, folder.id).length
                            return (
                                <li key={folder.id}>
                                    <button
                                        className="flex w-full flex-col gap-1 rounded-lg border bg-muted/20 p-3 text-left outline-none transition-colors hover:border-primary focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                                        onClick={() => setFolderView(folder.id)}
                                        type="button"
                                    >
                                        <span className="truncate text-sm font-medium">
                                            {folder.name}
                                        </span>
                                        <span className="text-xs text-muted-foreground">
                                            {fileCount} {fileCount === 1 ? 'Datei' : 'Dateien'}
                                            {subCount > 0
                                                ? ` · ${subCount} ${'Ordner'}`
                                                : ''}
                                        </span>
                                    </button>
                                </li>
                            )
                        })}
                    </ul>
                ) : null}
            </section>

            {hasMoreAssets ? (
                <div className="flex justify-center">
                    <Button onClick={() => void loadMoreAssets()} type="button" variant="outline">
                        Weitere Dateien laden
                    </Button>
                </div>
            ) : null}

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
                    {failedUpload !== null ? (
                        <Button
                            className="mt-3"
                            disabled={isBusy}
                            onClick={() => void uploadFile(failedUpload.file)}
                            type="button"
                            variant="outline"
                        >
                            Upload erneut versuchen
                        </Button>
                    ) : (
                        <Button
                            className="mt-3"
                            onClick={() => setReloadToken((value) => value + 1)}
                            type="button"
                            variant="outline"
                        >
                            Erneut versuchen
                        </Button>
                    )}
                </Alert>
            ) : null}
            {statusMessage !== null ? (
                <Alert role="status">
                    <AlertDescription>{statusMessage}</AlertDescription>
                </Alert>
            ) : null}

            {assets.length === 0 && folders.length === 0 ? (
                <EmptyState
                    title="Noch keine Medien"
                    description={dict.media.ladeErsteDateiHochSpaeterFolgen}
                    action={uploadButton}
                />
            ) : visibleChildFolders.length === 0 &&
              visibleAssets.length === 0 &&
              !hasActiveFilters ? (
                <EmptyState
                    title="Dieser Ordner ist leer"
                    description={
                        folderView === null
                            ? 'Lade Dateien hoch oder lege einen Ordner an, um Ordnung zu schaffen.'
                            : `„${currentFolderName}“ enthält noch keine Dateien. Lade direkt hierher hoch oder verschiebe Dateien aus der Bibliothek.`
                    }
                    action={uploadButton}
                />
            ) : visibleAssets.length === 0 ? (
                <EmptyState
                    title={dict.media.keineMedienDiesenFilter}
                    description={dict.media.passeTypStatusAuswahlUnverknuepfteDateien}
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
                            <span className="flex flex-wrap gap-2">
                                <Button
                                    disabled={isBusy}
                                    onClick={() => {
                                        const selected = visibleAssets.filter((asset) =>
                                            selectedIds.has(asset.id),
                                        )
                                        setFolderDialogError(null)
                                        setMoveState({
                                            assets: selected,
                                            title: `${selected.length} Datei(en) verschieben`,
                                        })
                                    }}
                                    size="sm"
                                    type="button"
                                    variant="outline"
                                >
                                    Auswahl verschieben
                                </Button>
                                <Button
                                    disabled={isBusy}
                                    onClick={() => void handleBulkDeleteSelected()}
                                    size="sm"
                                    type="button"
                                    variant="outline"
                                >
                                    {isBusy ? 'Wird gelöscht…' : `${selectedCount} löschen`}
                                </Button>
                            </span>
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
            {folderDialog !== null ? (
                <MediaFolderDialog
                    errorMessage={folderDialogError}
                    folder={folderDialog.mode === 'rename' ? folderDialog.folder : null}
                    folders={folders}
                    initialParentId={folderView}
                    isSaving={isBusy}
                    mode={folderDialog.mode}
                    onOpenChange={(open) => {
                        if (!open) {
                            setFolderDialog(null)
                        }
                    }}
                    onSubmit={(name, parentId) => {
                        void handleFolderSubmit(name, parentId)
                    }}
                    open
                />
            ) : null}
            {moveState !== null || moveFolderState !== null ? (
                <MediaMoveDialog
                    description={
                        moveFolderState !== null
                            ? `„${moveFolderState.name}“ samt Inhalt in einen anderen Ordner legen.`
                            : moveState !== null
                              ? moveState.title
                              : ''
                    }
                    errorMessage={folderDialogError}
                    excludeFolderIds={moveExcludeFolderIds}
                    folders={folders}
                    initialParentId={folderView}
                    isSaving={isBusy}
                    onOpenChange={(open) => {
                        if (!open) {
                            setMoveState(null)
                            setMoveFolderState(null)
                        }
                    }}
                    onSubmit={(targetId) => {
                        void handleMoveSubmit(targetId)
                    }}
                    open
                    title={
                        moveFolderState !== null ? 'Ordner verschieben' : 'Dateien verschieben'
                    }
                />
            ) : null}
            <MediaFolderDeleteDialog
                assets={assets}
                errorMessage={folderDialogError}
                folder={deleteFolderTarget}
                folders={folders}
                isSaving={isBusy}
                onConfirm={(mode) => {
                    void handleDeleteFolder(mode)
                }}
                onOpenChange={(open) => {
                    if (!open) {
                        setDeleteFolderTarget(null)
                    }
                }}
                open={deleteFolderTarget !== null}
            />
            <MediaAssetRenameDialog
                asset={renameAssetTarget}
                errorMessage={renameAssetError}
                isSaving={isBusy}
                onOpenChange={(open) => {
                    if (!open) {
                        setRenameAssetTarget(null)
                        setRenameAssetError(null)
                    }
                }}
                onSubmit={(filename) => {
                    void handleRenameAsset(filename)
                }}
                open={renameAssetTarget !== null}
            />
            <MediaAssetDetailPanel
                asset={detailAsset}
                onOpenChange={(open) => {
                    if (!open) {
                        setDetailAsset(null)
                    }
                }}
                onRenamed={(renamed) => {
                    setAssets((current) =>
                        current.map((item) => (item.id === renamed.id ? renamed : item)),
                    )
                    setDetailAsset((current) =>
                        current !== null && current.id === renamed.id ? renamed : current,
                    )
                    setStatusMessage(
                        `Datei in „${renamed.originalFilename ?? renamed.id}“ umbenannt.`,
                    )
                }}
                open={detailAsset !== null}
            />
        </PageStack>
    )
}
