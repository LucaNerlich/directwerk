'use client'

import SelectControl from '@/components/studio/SelectControl'

import {useEffect, useState} from 'react'

import {AUTH_REQUIRED} from '@directwerk/api/constants'
import {listMedia} from '@/lib/api/mediaApi'
import type {AssetType, MediaAsset} from '@directwerk/api/types'
import {getClientTenantHost} from '@directwerk/api/tenant'

interface MediaLibraryPickerProps {
    assetType: AssetType
    label: string
    selectedId: number | null
    disabled?: boolean
    onSelect: (asset: MediaAsset) => void
    onAuthRequired: () => void
}

export default function MediaLibraryPicker({
    assetType,
    label,
    selectedId,
    disabled = false,
    onSelect,
    onAuthRequired,
}: MediaLibraryPickerProps): React.JSX.Element {
    const [assets, setAssets] = useState<MediaAsset[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)

    useEffect(() => {
        let active = true

        async function load(): Promise<void> {
            try {
                const loaded = await listMedia(getClientTenantHost())
                if (active) {
                    setAssets(
                        loaded.filter(
                            (item) =>
                                item.assetType === assetType && item.status === 'READY',
                        ),
                    )
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
    }, [assetType, onAuthRequired])

    return (
        <label className="grid gap-2 text-sm font-medium">
            <span>{label}</span>
            {isLoading ? (
                <p className="text-xs text-muted-foreground">Mediathek wird geladen…</p>
            ) : (
                <SelectControl
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
                    disabled={disabled || assets.length === 0}
                    value=""
                    onChange={(event) => {
                        const id = Number(event.target.value)
                        const asset = assets.find((item) => item.id === id)
                        if (asset !== undefined) {
                            onSelect(asset)
                        }
                    }}
                >
                    <option value="">
                        {assets.length === 0
                            ? 'Keine passenden Medien'
                            : 'Aus Mediathek wählen…'}
                    </option>
                    {assets.map((asset) => (
                        <option
                            key={asset.id}
                            disabled={asset.id === selectedId}
                            value={asset.id}
                        >
                            {asset.originalFilename ?? `Asset ${asset.id}`}
                        </option>
                    ))}
                </SelectControl>
            )}
            {errorMessage !== null ? (
                <p className="text-sm text-destructive" role="alert">
                    {errorMessage}
                </p>
            ) : null}
        </label>
    )
}
