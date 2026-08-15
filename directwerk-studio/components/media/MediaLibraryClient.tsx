'use client'

import SelectControl from '@/components/studio/SelectControl'
import UploadProgress from '@/components/media/UploadProgress'

import {Button} from '@directwerk/ui/components/button'
import EmptyState from '@directwerk/ui/components/empty-state'
import PageHeader from '@directwerk/ui/components/page-header'

import {useEffect, useRef, useState, type ChangeEvent, type DragEvent} from 'react'
import {useRouter} from 'next/navigation'

import {AUTH_REQUIRED} from '@/lib/api/errors'
import {deleteMedia, listMedia} from '@/lib/api/tenantApi'
import type {MediaAsset} from '@/lib/api/types'
import {MEDIA_TYPE_LIMITS} from '@/lib/media/limits'
import {uploadMediaFile} from '@/lib/media/upload'
import {getClientTenantHost} from '@/lib/tenant/getClientTenantHost'

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

export default function MediaLibraryClient(): React.JSX.Element {
    const router = useRouter()
    const fileInputRef = useRef<HTMLInputElement>(null)
    const mountedRef = useRef(true)
    const [assets, setAssets] = useState<MediaAsset[]>([])
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [statusMessage, setStatusMessage] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isBusy, setIsBusy] = useState(false)
    const [isDragging, setIsDragging] = useState(false)
    const [typeFilter, setTypeFilter] = useState('')
    const [uploadProgress, setUploadProgress] = useState<{file: File; progress: number} | null>(
        null,
    )

    async function reload(): Promise<void> {
        const result = await listMedia(getClientTenantHost())
        setAssets(result)
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
                if (error instanceof Error && error.message === AUTH_REQUIRED) {
                    router.replace('/login')
                    return
                }
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
            if (error instanceof Error && error.message === AUTH_REQUIRED) {
                router.replace('/login')
                return
            }
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

    async function handleDelete(assetId: number): Promise<void> {
        setIsBusy(true)
        setErrorMessage(null)
        setStatusMessage(null)
        try {
            await deleteMedia(getClientTenantHost(), assetId)
            setAssets((current) => current.filter((item) => item.id !== assetId))
            setStatusMessage('Medium gelöscht.')
        } catch (error: unknown) {
            if (error instanceof Error && error.message === AUTH_REQUIRED) {
                router.replace('/login')
                return
            }
            setErrorMessage(
                error instanceof Error ? error.message : 'Löschen fehlgeschlagen.',
            )
        } finally {
            setIsBusy(false)
        }
    }

    const visibleAssets =
        typeFilter.length === 0
            ? assets
            : assets.filter((asset) => asset.assetType === typeFilter)

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
                <p className="text-sm text-muted-foreground">Keine Medien dieses Typs.</p>
            ) : (
                <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {visibleAssets.map((asset) => (
                        <li
                            className="flex flex-col gap-3 rounded-xl border bg-card p-4"
                            key={asset.id}
                        >
                            {asset.assetType === 'IMAGE' && asset.cdnUrl != null ? (
                                <img
                                    alt={asset.originalFilename ?? `Bild #${asset.id}`}
                                    className="aspect-video w-full rounded-md object-cover"
                                    src={asset.cdnUrl}
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
                    ))}
                </ul>
            )}
        </div>
    )
}
