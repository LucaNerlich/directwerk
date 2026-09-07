'use client'

import {useEffect, useId, useState} from 'react'

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
 */
export default function MediaAssetRenameDialog({
    open,
    onOpenChange,
    asset,
    isSaving,
    errorMessage,
    onSubmit,
}: MediaAssetRenameDialogProps): React.JSX.Element {
    const [filename, setFilename] = useState('')
    const filenameId = useId()

    useEffect(() => {
        if (open) {
            setFilename(asset?.originalFilename ?? '')
        }
    }, [open, asset])

    const trimmed = filename.trim()
    const valid = isValidAssetFilename(filename)
    const unchanged = trimmed === (asset?.originalFilename ?? '')

    return (
        <Dialog onOpenChange={onOpenChange} open={open}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Datei umbenennen</DialogTitle>
                    <DialogDescription>
                        {asset !== null
                            ? `„${asset.originalFilename ?? `Asset #${asset.id}`}“ umbenennen. Der S3-Schlüssel bleibt unverändert.`
                            : 'Datei umbenennen.'}
                    </DialogDescription>
                </DialogHeader>
                <label className="grid gap-2 text-sm font-medium" htmlFor={filenameId}>
                    <span>Dateiname</span>
                    <Input
                        aria-invalid={trimmed.length > 0 && !valid}
                        autoComplete="off"
                        disabled={isSaving}
                        id={filenameId}
                        maxLength={255}
                        onChange={(event) => setFilename(event.target.value)}
                        placeholder="z. B. interview-final.mp3"
                        value={filename}
                    />
                </label>
                {trimmed.length > 0 && !valid ? (
                    <p className="text-xs text-destructive" role="alert">
                        Der Dateiname darf nicht leer sein, keine Pfade enthalten (max. 255 Zeichen).
                    </p>
                ) : null}
                {errorMessage !== null ? (
                    <p className="text-sm text-destructive" role="alert">
                        {errorMessage}
                    </p>
                ) : null}
                <DialogFooter>
                    <Button
                        disabled={isSaving}
                        onClick={() => onOpenChange(false)}
                        type="button"
                        variant="outline"
                    >
                        Abbrechen
                    </Button>
                    <Button
                        disabled={isSaving || !valid || unchanged}
                        onClick={() => onSubmit(trimmed)}
                        type="button"
                    >
                        {isSaving ? 'Speichert…' : 'Umbenennen'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
