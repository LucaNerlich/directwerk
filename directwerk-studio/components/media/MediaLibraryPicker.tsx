'use client'

import {useEffect, useId, useLayoutEffect, useMemo, useRef, useState} from 'react'
import {createPortal} from 'react-dom'

import {Button} from '@directwerk/ui/components/button'
import {Input} from '@directwerk/ui/components/input'
import {ChevronDownIcon} from 'lucide-react'

import {useDictionary} from '@/components/i18n/LocaleProvider'
import {AUTH_REQUIRED} from '@directwerk/api/constants'
import {isPubliclySelectable, isReadyAsset} from '@directwerk/api/media/readiness'
import {listAllMedia} from '@/lib/api/listAllMedia'
import {listMediaFolders} from '@/lib/api/mediaApi'
import type {AssetType, MediaAsset, MediaFolder} from '@directwerk/api/types'
import {t} from '@/lib/i18n/dictionary'
import {assetLabel, filterAssetsByQuery} from '@/lib/media/assetSearch'
import {buildFolderTree, flattenFolderTree} from '@/lib/media/folders'
import {assetTypeLabel} from '@/lib/subscription/displayLabels'

interface MediaLibraryPickerProps {
    assetType: AssetType
    label: string
    selectedId: number | null
    /**
     * #553: covers and heroes are public-facing, so a PRIVATE asset can never render there —
     * the server only builds a public CDN URL for PUBLIC assets. Pickers that embed the asset
     * in a public page must set this; AUDIO/DOCUMENT pickers stay as they are.
     */
    requirePublic?: boolean
    disabled?: boolean
    onSelect: (asset: MediaAsset) => void
    onAuthRequired: () => void
}

interface AssetGroup {
    key: string
    label: string
    assets: MediaAsset[]
}

function groupReadyAssets(
    assets: MediaAsset[],
    folders: MediaFolder[],
    rootLabel: string,
): AssetGroup[] {
    const byFolder = new Map<number | null, MediaAsset[]>()
    for (const asset of assets) {
        const folderId = asset.folderId ?? null
        const bucket = byFolder.get(folderId) ?? []
        bucket.push(asset)
        byFolder.set(folderId, bucket)
    }

    const groups: AssetGroup[] = []
    const rootAssets = byFolder.get(null)
    if (rootAssets !== undefined && rootAssets.length > 0) {
        groups.push({key: 'root', label: rootLabel, assets: rootAssets})
        byFolder.delete(null)
    }

    for (const node of flattenFolderTree(buildFolderTree(folders))) {
        const folderAssets = byFolder.get(node.folder.id)
        if (folderAssets === undefined || folderAssets.length === 0) {
            continue
        }
        groups.push({
            key: String(node.folder.id),
            label: `${'— '.repeat(Math.max(0, node.depth - 1))}${node.folder.name}`,
            assets: folderAssets,
        })
        byFolder.delete(node.folder.id)
    }

    for (const [folderId, folderAssets] of byFolder) {
        if (folderId === null || folderAssets.length === 0) {
            continue
        }
        groups.push({
            key: `orphan-${folderId}`,
            label: `Ordner ${folderId}`,
            assets: folderAssets,
        })
    }

    return groups
}

export default function MediaLibraryPicker({
    assetType,
    label,
    selectedId,
    requirePublic = false,
    disabled = false,
    onSelect,
    onAuthRequired,
}: MediaLibraryPickerProps): React.JSX.Element {
    const dict = useDictionary()
    const [assets, setAssets] = useState<MediaAsset[]>([])
    const [folders, setFolders] = useState<MediaFolder[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [hasLoaded, setHasLoaded] = useState(false)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [reloadToken, setReloadToken] = useState(0)
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState('')
    const helpId = useId()
    const searchId = useId()
    const listboxId = useId()
    const rootRef = useRef<HTMLDivElement>(null)
    const triggerRef = useRef<HTMLButtonElement>(null)
    const panelRef = useRef<HTMLDivElement>(null)
    const [panelStyle, setPanelStyle] = useState<{
        top: number
        left: number
        width: number
    } | null>(null)

    useEffect(() => {
        setAssets([])
        setFolders([])
        setHasLoaded(false)
        setErrorMessage(null)
    }, [assetType, requirePublic])

    useEffect(() => {
        if (!open) {
            return
        }
        let active = true
        setIsLoading(true)
        setErrorMessage(null)

        async function load(): Promise<void> {
            try {
                const loadedFoldersPromise = listMediaFolders().catch(() => [])
                const loaded = await listAllMedia({assetType})
                const loadedFolders = await loadedFoldersPromise
                if (active) {
                    setAssets(
                        loaded.filter(
                            (item) =>
                                item.assetType === assetType
                                && isReadyAsset(item)
                                && (!requirePublic || isPubliclySelectable(item)),
                        ),
                    )
                    setFolders(loadedFolders)
                    setHasLoaded(true)
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
                        : dict.media.mediathekKonnteGeladen,
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
    }, [open, assetType, dict.media.mediathekKonnteGeladen, onAuthRequired, requirePublic, reloadToken])

    useLayoutEffect(() => {
        if (!open) {
            setPanelStyle(null)
            return
        }

        function updatePanelPosition(): void {
            const trigger = triggerRef.current
            if (trigger === null) {
                return
            }
            const rect = trigger.getBoundingClientRect()
            setPanelStyle({
                top: rect.bottom + 4,
                left: rect.left,
                width: rect.width,
            })
        }

        updatePanelPosition()
        window.addEventListener('resize', updatePanelPosition)
        window.addEventListener('scroll', updatePanelPosition, true)
        return () => {
            window.removeEventListener('resize', updatePanelPosition)
            window.removeEventListener('scroll', updatePanelPosition, true)
        }
    }, [open])

    useEffect(() => {
        if (!open) {
            return
        }

        function onPointerDown(event: MouseEvent): void {
            const target = event.target as Node
            if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) {
                return
            }
            setOpen(false)
        }

        function onKeyDown(event: KeyboardEvent): void {
            if (event.key === 'Escape') {
                setOpen(false)
            }
        }

        document.addEventListener('mousedown', onPointerDown)
        document.addEventListener('keydown', onKeyDown)
        return () => {
            document.removeEventListener('mousedown', onPointerDown)
            document.removeEventListener('keydown', onKeyDown)
        }
    }, [open])

    useEffect(() => {
        if (!open) {
            setQuery('')
        }
    }, [open])

    const filteredAssets = useMemo(
        () => filterAssetsByQuery(assets, query),
        [assets, query],
    )

    const groups = useMemo(
        () => groupReadyAssets(filteredAssets, folders, dict.media.bibliothekObersteEbene),
        [dict.media.bibliothekObersteEbene, filteredAssets, folders],
    )

    const selectedAsset = useMemo(
        () => assets.find((asset) => asset.id === selectedId) ?? null,
        [assets, selectedId],
    )

    const triggerLabel =
        selectedAsset !== null
            ? assetLabel(selectedAsset)
            : selectedId !== null
              ? `Asset ${selectedId}`
              : assets.length === 0
                ? dict.media.keinePassendenMedien
                : dict.media.mediathekWaehlen

    const controlsDisabled = disabled || (hasLoaded && !isLoading && assets.length === 0)

    return (
        <div className="grid gap-2">
            <div className="grid gap-2 text-sm font-medium">
                <span id={`${helpId}-label`}>{label}</span>
                <div className="relative" ref={rootRef}>
                    <Button
                        ref={triggerRef}
                        aria-controls={listboxId}
                        aria-describedby={`${helpId}-help`}
                        aria-expanded={open}
                        aria-haspopup="listbox"
                        aria-label={label}
                        className="w-full justify-between font-normal"
                        disabled={controlsDisabled}
                        id={`${helpId}-select`}
                        onClick={() => setOpen((value) => !value)}
                        type="button"
                        variant="outline"
                    >
                        <span className="truncate">{triggerLabel}</span>
                        <ChevronDownIcon aria-hidden="true" className="size-4 shrink-0 opacity-60" />
                    </Button>
                    {open && panelStyle !== null
                        ? createPortal(
                              <div
                                  ref={panelRef}
                                  className="fixed z-50 grid gap-2 rounded-lg border bg-popover p-2 text-popover-foreground shadow-md ring-1 ring-foreground/10"
                                  role="presentation"
                                  style={{
                                      top: panelStyle.top,
                                      left: panelStyle.left,
                                      width: panelStyle.width,
                                  }}
                              >
                                  {isLoading ? (
                                      <p className="px-1 py-2 text-sm text-muted-foreground" role="status">
                                          {dict.media.mediathekGeladen}
                                      </p>
                                  ) : (
                                      <>
                                          <label className="grid gap-1.5 text-sm font-medium" htmlFor={searchId}>
                                              <span className="sr-only">{dict.media.mediathekDurchsuchen}</span>
                                              <Input
                                                  autoFocus
                                                  id={searchId}
                                                  onChange={(event) => setQuery(event.target.value)}
                                                  placeholder={dict.media.dateinameSuchen}
                                                  type="search"
                                                  value={query}
                                              />
                                          </label>
                                          {groups.length === 0 ? (
                                              <p className="px-1 py-2 text-sm text-muted-foreground" role="status">
                                                  {dict.media.diesenFilterGibtKeineTreffer}
                                              </p>
                                          ) : (
                                              <ul
                                                  aria-label={label}
                                                  className="grid max-h-64 gap-2 overflow-y-auto pr-1"
                                                  id={listboxId}
                                                  role="listbox"
                                              >
                                                  {groups.map((group) => (
                                                      <li key={group.key}>
                                                          <p className="px-1.5 py-1 text-xs font-medium text-muted-foreground">
                                                              {group.label}
                                                          </p>
                                                          <ul className="grid gap-0.5" role="group" aria-label={group.label}>
                                                              {group.assets.map((asset) => {
                                                                  const isSelected = asset.id === selectedId
                                                                  return (
                                                                      <li key={asset.id} role="presentation">
                                                                          <button
                                                                              aria-selected={isSelected}
                                                                              className="flex w-full items-center rounded-md px-1.5 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
                                                                              disabled={isSelected}
                                                                              onClick={() => {
                                                                                  onSelect(asset)
                                                                                  setOpen(false)
                                                                              }}
                                                                              role="option"
                                                                              type="button"
                                                                          >
                                                                              <span className="truncate">
                                                                                  {assetLabel(asset)}
                                                                              </span>
                                                                          </button>
                                                                      </li>
                                                                  )
                                                              })}
                                                          </ul>
                                                      </li>
                                                  ))}
                                              </ul>
                                          )}
                                      </>
                                  )}
                              </div>,
                              document.body,
                          )
                        : null}
                </div>
                {errorMessage !== null ? (
                    <div className="grid gap-1.5">
                        <p className="text-sm text-destructive" role="alert">
                            {errorMessage}
                        </p>
                        <button
                            className="justify-self-start text-sm font-medium text-primary underline-offset-4 hover:underline"
                            onClick={() => {
                                setOpen(true)
                                setReloadToken((value) => value + 1)
                            }}
                            type="button"
                        >
                            Erneut versuchen
                        </button>
                    </div>
                ) : null}
            </div>
            <p className="text-xs text-muted-foreground" id={`${helpId}-help`}>
                Nur bereite {assetTypeLabel(assetType)}-Dateien stehen zur Auswahl.
                {hasLoaded && assets.length === 0 && !isLoading
                    ? ` ${dict.media.ladeZuerstPassendeDateiMediathekHoch}`
                    : hasLoaded
                      ? ` ${t(dict.media.verfuegbar, {'assets.length': assets.length})}`
                      : ''}
            </p>
        </div>
    )
}
