'use client'

import SelectControl from '@/components/studio/SelectControl'

import {useEffect, useId, useState} from 'react'

import {AUTH_REQUIRED} from '@directwerk/api/constants'
import {listMedia} from '@/lib/api/mediaApi'
import type {AssetType, MediaAsset} from '@directwerk/api/types'
import {getClientTenantHost} from '@directwerk/api/tenant'
import {assetTypeLabel} from '@/lib/subscription/displayLabels'

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
    const helpId = useId()

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
        <div className="grid gap-2">
        <label className="grid gap-2 text-sm font-medium" htmlFor={`${helpId}-select`}>
            <span>{label}</span>
            {isLoading ? (
                <p className="text-xs text-muted-foreground" role="status">Mediathek wird geladen…</p>
            ) : (
                <SelectControl
                    aria-describedby={`${helpId}-help`}
                    disabled={disabled || assets.length === 0}
                    id={`${helpId}-select`}
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
        <p className="text-xs text-muted-foreground" id={`${helpId}-help`}>
            Nur bereite {assetTypeLabel(assetType)}-Dateien stehen zur Auswahl.
            {assets.length === 0 && !isLoading
                ? ' Lade zuerst eine passende Datei in der Mediathek hoch.'
                : ` ${assets.length} verfügbar.`}
        </p>
        </div>
    )
}
