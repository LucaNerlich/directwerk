'use client'

import {useEffect, useId, useState} from 'react'

import {useDictionary} from '@/components/i18n/LocaleProvider'
import {getMediaReferences} from '@/lib/api/mediaApi'
import {proposedRenameFromReference} from '@/lib/media/filenameFromReference'
import {t} from '@/lib/i18n/dictionary'
import {Button} from '@directwerk/ui/components/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@directwerk/ui/components/dialog'
import {Input} from '@directwerk/ui/components/input'

import type {MediaAsset} from '@directwerk/api/types'

interface MediaAssetRenameDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    asset: MediaAsset | null
    isSaving: boolean
    errorMessage: string | null
    onSubmit: (filename: string) => void
}

function isValidAssetFilename(name: string): boolean {
    const trimmed = name.trim()
    if (trimmed.length === 0 || trimmed.length > 255) {
        return false
    }
    if (trimmed.includes('/') || trimmed.includes('\\') || trimmed.includes('..')) {
        return false
    }
    return true
}

/**
 * Rename dialog for a single media asset. The backend sanitizes
 * authoritatively (400 on invalid) — client checks only give instant feedback.
 *
 * When the asset has ≥1 content reference and the URL-safe proposal from the
 * first reference title differs from {@code originalFilename}, offers
 * “from reference” to fill the input (submit still via Umbenennen).
 */
export default function MediaAssetRenameDialog({
    open,
    onOpenChange,
    asset,
    isSaving,
    errorMessage,
    onSubmit,
}: MediaAssetRenameDialogProps): React.JSX.Element {
    const dict = useDictionary()
    const [filename, setFilename] = useState('')
    const [proposedFromReference, setProposedFromReference] = useState<string | null>(null)
    const filenameId = useId()

    const assetId = asset?.id

    useEffect(() => {
        if (open) {
            setFilename(asset?.originalFilename ?? '')
            setProposedFromReference(null)
        }
    }, [open, asset])

    useEffect(() => {
        if (!open || assetId === undefined || asset === null) {
            return
        }
        let cancelled = false
        void getMediaReferences(assetId)
            .then((rows) => {
                if (cancelled) {
                    return
                }
                setProposedFromReference(
                    proposedRenameFromReference(asset.originalFilename, rows),
                )
            })
            .catch(() => {
                if (!cancelled) {
                    setProposedFromReference(null)
                }
            })
        return () => {
            cancelled = true
        }
    }, [open, assetId, asset])

    const trimmed = filename.trim()
    const valid = isValidAssetFilename(filename)
    const unchanged = trimmed === (asset?.originalFilename ?? '')
    const showApplyFromReference =
        proposedFromReference !== null && trimmed !== proposedFromReference

    return (
        <Dialog onOpenChange={onOpenChange} open={open}>
            <DialogContent className="sm:max-w-md" closeLabel={dict.media.schliessen}>
                <DialogHeader>
                    <DialogTitle>{dict.media.dateiUmbenennen}</DialogTitle>
                    <DialogDescription>
                        {asset !== null
                            ? t(dict.media.dateiUmbenennenBeschreibung, {
                                  filename: asset.originalFilename ?? `Asset #${asset.id}`,
                              })
                            : dict.media.dateiUmbenennen2}
                    </DialogDescription>
                </DialogHeader>
                <label className="grid gap-2 text-sm font-medium" htmlFor={filenameId}>
                    <span>{dict.media.dateiname}</span>
                    <Input
                        aria-invalid={trimmed.length > 0 && !valid}
                        autoComplete="off"
                        disabled={isSaving}
                        id={filenameId}
                        maxLength={255}
                        onChange={(event) => setFilename(event.target.value)}
                        placeholder={dict.media.dateinamePlatzhalter}
                        value={filename}
                    />
                </label>
                {proposedFromReference !== null ? (
                    <div className="space-y-2 rounded-md border px-3 py-3 text-sm">
                        <p className="text-xs text-muted-foreground">
                            {dict.media.vonReferenzUmbenennenHinweis}
                        </p>
                        <p className="font-medium">
                            {t(dict.media.vonReferenzUmbenennenVorschlag, {
                                filename: proposedFromReference,
                            })}
                        </p>
                        {showApplyFromReference ? (
                            <Button
                                disabled={isSaving}
                                onClick={() => setFilename(proposedFromReference)}
                                size="sm"
                                type="button"
                                variant="secondary"
                            >
                                {dict.media.vonReferenzUmbenennen}
                            </Button>
                        ) : null}
                    </div>
                ) : null}
                {trimmed.length > 0 && !valid ? (
                    <p className="text-xs text-destructive" role="alert">
                        {dict.media.dateinameUngueltig}
                    </p>
                ) : null}
                {errorMessage !== null ? (
                    <p className="text-sm text-destructive" role="alert">
                        {errorMessage}
                    </p>
                ) : null}
                <DialogFooter>
                    <Button
                        onClick={() => onOpenChange(false)}
                        type="button"
                        variant="outline"
                    >
                        {dict.common.cancel}
                    </Button>
                    <Button
                        disabled={isSaving || !valid || unchanged}
                        onClick={() => onSubmit(trimmed)}
                        type="button"
                    >
                        {isSaving ? dict.media.speichert : dict.media.umbenennenAktion}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
