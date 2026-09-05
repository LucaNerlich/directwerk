'use client'

import {useEffect, useId, useMemo, useState} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Badge} from '@directwerk/ui/components/badge'
import {Button} from '@directwerk/ui/components/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@directwerk/ui/components/dialog'
import {Input} from '@directwerk/ui/components/input'
import {Skeleton} from '@directwerk/ui/components/skeleton'
import EmptyState from '@directwerk/ui/components/empty-state'

import Link from 'next/link'

import {AUTH_REQUIRED} from '@directwerk/api/constants'
import {listMedia, listMediaFolders} from '@/lib/api/mediaApi'
import type {MediaAsset, MediaFolder} from '@directwerk/api/types'
import {getClientTenantHost} from '@directwerk/api/tenant'
import {buildFolderTree, flattenFolderTree} from '@/lib/media/folders'
import {formatBytes} from '@/lib/media/format'
import {assetTypeLabel} from '@/lib/subscription/displayLabels'
import {safeImageSrc, safeLinkHref} from '@/lib/url/safeUrl'

export type EmbeddableAssetFilter = 'ALL' | 'IMAGE' | 'AUDIO' | 'VIDEO' | 'DOCUMENT'

/**
 * A media asset that can be embedded inline into rich text: it must be READY,
 * PUBLIC, and carry a stable https CDN URL. Private assets only have short-lived
 * (1h) preview URLs and would break publicly — they are listed as unavailable.
 */
export function isInlineEmbeddable(asset: MediaAsset): boolean {
    if (asset.status !== 'READY' || asset.visibility !== 'PUBLIC') {
        return false
    }
    if (asset.cdnUrl == null) {
        return false
    }
    if (asset.assetType === 'IMAGE') {
        return safeImageSrc(asset.cdnUrl) !== null
    }
    return safeLinkHref(asset.cdnUrl) !== null
}

export function inlineInsertKind(asset: MediaAsset): 'image' | 'link' {
    return asset.assetType === 'IMAGE' ? 'image' : 'link'
}

interface MediaInlinePickerDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onInsert: (asset: MediaAsset) => void
    onAuthRequired: () => void
    initialFilter?: EmbeddableAssetFilter
}

/**
 * Library picker for inline media in rich text (episode show notes, article body).
 * Only PUBLIC + READY assets with a stable CDN URL can be embedded — private
 * preview URLs expire and must never end up in public HTML.
 */
export default function MediaInlinePickerDialog({
    open,
    onOpenChange,
    onInsert,
    onAuthRequired,
    initialFilter = 'ALL',
}: MediaInlinePickerDialogProps): React.JSX.Element {
    const [assets, setAssets] = useState<MediaAsset[]>([])
    const [folders, setFolders] = useState<MediaFolder[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [reloadToken, setReloadToken] = useState(0)
    const [typeFilter, setTypeFilter] = useState<EmbeddableAssetFilter>(initialFilter)
    const [folderFilter, setFolderFilter] = useState<number | 'ALL'>('ALL')
    const [query, setQuery] = useState('')
    const searchId = useId()
    const folderId = useId()

    useEffect(() => {
        if (!open) {
            return
        }
        let active = true
        setIsLoading(true)
        setErrorMessage(null)

        async function load(): Promise<void> {
            try {
                const host = getClientTenantHost()
                const loadedFoldersPromise = listMediaFolders(host).catch(() => [])
                const loadedAssets = await listMedia(host)
                const loadedFolders = await loadedFoldersPromise
                if (active) {
                    setAssets(loadedAssets)
                    setFolders(loadedFolders)
                }
            } catch (error) {
                if (!active) {
                    return
                }
                if (error instanceof Error && error.message === AUTH_REQUIRED) {
                    onAuthRequired()
                    return
                }
                setErrorMessage(
                    error instanceof Error
                        ? error.message
                        : 'Mediathek konnte nicht geladen werden.',
                )
            } finally {
                if (active) {
                    setIsLoading(false)
                }
            }
        }

        void load()

        return () => {
            active = false
        }
    }, [open, onAuthRequired, reloadToken])

    useEffect(() => {
        if (open) {
            setTypeFilter(initialFilter)
        }
    }, [open, initialFilter])

    const embeddable = useMemo(() => assets.filter(isInlineEmbeddable), [assets])
    const privateCount = useMemo(
        () =>
            assets.filter(
                (asset) => asset.status === 'READY' && asset.visibility !== 'PUBLIC',
            ).length,
        [assets],
    )

    const visible = useMemo(
        () =>
            embeddable.filter((asset) => {
                if (typeFilter !== 'ALL' && asset.assetType !== typeFilter) {
                    return false
                }
                if (folderFilter !== 'ALL' && (asset.folderId ?? null) !== folderFilter) {
                    return false
                }
                const needle = query.trim().toLowerCase()
                if (needle.length === 0) {
                    return true
                }
                return (asset.originalFilename ?? `Asset ${asset.id}`)
                    .toLowerCase()
                    .includes(needle)
            }),
        [embeddable, typeFilter, folderFilter, query],
    )

    const folderOptions = useMemo(
        () => flattenFolderTree(buildFolderTree(folders)),
        [folders],
    )
    const folderNameById = useMemo(
        () => new Map(folders.map((folder) => [folder.id, folder.name] as const)),
        [folders],
    )

    return (
        <Dialog onOpenChange={onOpenChange} open={open}>
            <DialogContent className="sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Medium aus Mediathek einfügen</DialogTitle>
                    <DialogDescription>
                        Bilder werden eingebettet, Audio/Video/Dokumente als Link.
                        Nur öffentliche, bereite Dateien funktionieren im
                        veröffentlichten Text.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-3">
                    <div className="flex flex-wrap gap-1" role="group" aria-label="Medientyp filtern">
                        {(
                            [
                                ['ALL', 'Alle'],
                                ['IMAGE', 'Bilder'],
                                ['AUDIO', 'Audio'],
                                ['VIDEO', 'Video'],
                                ['DOCUMENT', 'Dateien'],
                            ] as Array<[EmbeddableAssetFilter, string]>
                        ).map(([value, label]) => (
                            <Button
                                key={value}
                                onClick={() => setTypeFilter(value)}
                                size="sm"
                                type="button"
                                variant={typeFilter === value ? 'secondary' : 'outline'}
                                aria-pressed={typeFilter === value}
                            >
                                {label}
                            </Button>
                        ))}
                    </div>
                    <label className="grid gap-2 text-sm font-medium" htmlFor={searchId}>
                        <span className="sr-only">Mediathek durchsuchen</span>
                        <Input
                            id={searchId}
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="Dateiname suchen…"
                            type="search"
                            value={query}
                        />
                    </label>
                    {folderOptions.length > 0 ? (
                        <label className="grid gap-2 text-sm font-medium" htmlFor={folderId}>
                            <span>Ordner</span>
                            <select
                                className="native-select"
                                id={folderId}
                                onChange={(event) =>
                                    setFolderFilter(
                                        event.target.value === ''
                                            ? 'ALL'
                                            : Number(event.target.value),
                                    )
                                }
                                value={folderFilter === 'ALL' ? '' : folderFilter}
                            >
                                <option value="">Alle Ordner</option>
                                {folderOptions.map((node) => (
                                    <option key={node.folder.id} value={node.folder.id}>
                                        {`${'— '.repeat(node.depth)}${node.folder.name}`}
                                    </option>
                                ))}
                            </select>
                        </label>
                    ) : null}
                    {isLoading ? (
                        <div className="grid gap-2" aria-hidden="true">
                            {[0, 1, 2].map((index) => (
                                <Skeleton className="h-16 w-full" key={index} />
                            ))}
                        </div>
                    ) : errorMessage !== null ? (
                        <Alert variant="destructive">
                            <AlertDescription>{errorMessage}</AlertDescription>
                            <Button
                                className="mt-3"
                                onClick={() => setReloadToken((value) => value + 1)}
                                type="button"
                                variant="outline"
                            >
                                Erneut versuchen
                            </Button>
                        </Alert>
                    ) : visible.length === 0 ? (
                        <EmptyState
                            title="Keine einbettbaren Medien"
                            description={
                                embeddable.length === 0
                                    ? 'Lade zuerst eine Datei als öffentlich (PUBLIC) in der Mediathek hoch — private Dateien laufen nach einer Stunde ab und können nicht eingebettet werden.'
                                    : 'Für diesen Filter gibt es keine Treffer.'
                            }
                            action={
                                <Button nativeButton={false} render={<Link href="/media" />} variant="outline">
                                    Zur Mediathek
                                </Button>
                            }
                        />
                    ) : (
                        <ul className="grid max-h-80 gap-2 overflow-y-auto pr-1">
                            {visible.map((asset) => {
                                const src =
                                    asset.assetType === 'IMAGE'
                                        ? safeImageSrc(asset.cdnUrl)
                                        : null
                                const kind = inlineInsertKind(asset)
                                return (
                                    <li
                                        className="flex items-center gap-3 rounded-lg border p-2"
                                        key={asset.id}
                                    >
                                        {src !== null ? (
                                            <img
                                                alt=""
                                                className="size-14 shrink-0 rounded-md object-cover"
                                                loading="lazy"
                                                src={src}
                                            />
                                        ) : (
                                            <span
                                                aria-hidden="true"
                                                className="flex size-14 shrink-0 items-center justify-center rounded-md bg-muted text-[0.65rem] font-semibold uppercase text-muted-foreground"
                                            >
                                                {asset.assetType}
                                            </span>
                                        )}
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-sm font-medium">
                                                {asset.originalFilename ?? `Asset #${asset.id}`}
                                            </span>
                                            <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                                                <Badge variant="secondary">
                                                    {assetTypeLabel(asset.assetType)}
                                                </Badge>
                                                {asset.folderId != null &&
                                                folderNameById.get(asset.folderId) !== undefined ? (
                                                    <span>{folderNameById.get(asset.folderId)}</span>
                                                ) : null}
                                                <span>{formatBytes(asset.sizeBytes)}</span>
                                                <span>
                                                    {kind === 'image'
                                                        ? 'wird eingebettet'
                                                        : 'wird verlinkt'}
                                                </span>
                                            </span>
                                        </span>
                                        <Button
                                            onClick={() => {
                                                onInsert(asset)
                                                onOpenChange(false)
                                            }}
                                            size="sm"
                                            type="button"
                                        >
                                            Einfügen
                                        </Button>
                                    </li>
                                )
                            })}
                        </ul>
                    )}
                    {!isLoading && errorMessage === null && privateCount > 0 ? (
                        <p className="text-xs text-muted-foreground" role="note">
                            {privateCount} private Datei(en) ausgeblendet — nur
                            öffentliche Dateien mit stabiler URL können eingebettet
                            werden.
                        </p>
                    ) : null}
                </div>
            </DialogContent>
        </Dialog>
    )
}
