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

import type {MediaFolderDeleteMode} from '@/lib/api/mediaApi'
import {assetsInFolder, childFolders, descendantFolderIds, folderParentId} from '@/lib/media/folders'
import type {MediaAsset, MediaFolder} from '@directwerk/api/types'

interface MediaFolderDeleteDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    folder: MediaFolder | null
    folders: MediaFolder[]
    assets: MediaAsset[]
    isSaving: boolean
    errorMessage: string | null
    onConfirm: (mode: MediaFolderDeleteMode) => void
}

/**
 * Folder deletion with the two API modes: contents move up to the parent
 * (or root) by default; destructive deletion removes contained assets through
 * the asset lifecycle and requires typing the folder name.
 */
export default function MediaFolderDeleteDialog({
    open,
    onOpenChange,
    folder,
    folders,
    assets,
    isSaving,
    errorMessage,
    onConfirm,
}: MediaFolderDeleteDialogProps): React.JSX.Element | null {
    const [mode, setMode] = useState<MediaFolderDeleteMode>('move_to_parent')
    const [typedName, setTypedName] = useState('')
    const modeGroupId = useId()
    const confirmId = useId()

    useEffect(() => {
        if (open) {
            setMode('move_to_parent')
            setTypedName('')
        }
    }, [open, folder?.id])

    if (folder === null) {
        return null
    }

    const parentId = folderParentId(folder)
    const parentName = parentId !== null
        ? (folders.find((entry) => entry.id === parentId)?.name ?? 'übergeordneter Ordner')
        : 'Bibliothek (oberste Ebene)'
    const descendantIds = new Set(descendantFolderIds(folders, folder.id))
    const directAssets = assetsInFolder(assets, folder.id).length
    const nestedAssets = assets.filter(
        (asset) => asset.folderId != null && descendantIds.has(asset.folderId),
    ).length
    const subfolderCount = childFolders(folders, folder.id).length
    const totalAssets = directAssets + nestedAssets
    const nameMatches = typedName.trim() === folder.name

    return (
        <Dialog onOpenChange={onOpenChange} open={open}>
            <DialogContent className="sm:max-w-md" closeLabel="Schließen">
                <DialogHeader>
                    <DialogTitle>{`Ordner „${folder.name}“ löschen?`}</DialogTitle>
                    <DialogDescription>
                        {totalAssets === 0 && subfolderCount === 0
                            ? 'Der Ordner ist leer und kann bedenkenlos gelöscht werden.'
                            : `Der Ordner enthält ${totalAssets} Datei(en) und ${subfolderCount} Unterordner.`}
                    </DialogDescription>
                </DialogHeader>
                <fieldset className="m-0 grid gap-2 border-0 p-0" disabled={isSaving}>
                    <legend className="text-sm font-medium">Was soll mit den Inhalten passieren?</legend>
                    <label className="flex cursor-pointer items-start gap-2 text-sm" htmlFor={`${modeGroupId}-move`}>
                        <Input
                            className="mt-0.5 size-4 shrink-0"
                            checked={mode === 'move_to_parent'}
                            id={`${modeGroupId}-move`}
                            name={modeGroupId}
                            onChange={() => setMode('move_to_parent')}
                            type="radio"
                        />
                        <span>
                            In übergeordneten Ordner verschieben
                            <span className="block text-xs font-normal text-muted-foreground">
                                Dateien und Unterordner landen in „{parentName}“.
                            </span>
                        </span>
                    </label>
                    <label className="flex cursor-pointer items-start gap-2 text-sm" htmlFor={`${modeGroupId}-delete`}>
                        <Input
                            className="mt-0.5 size-4 shrink-0"
                            checked={mode === 'delete_contents'}
                            id={`${modeGroupId}-delete`}
                            name={modeGroupId}
                            onChange={() => setMode('delete_contents')}
                            type="radio"
                        />
                        <span>
                            Inhalte endgültig löschen
                            <span className="block text-xs font-normal text-muted-foreground">
                                Alle enthaltenen Dateien werden wie beim Löschen einzelner
                                Medien unwiderruflich entfernt (inkl. S3-Bereinigung).
                            </span>
                        </span>
                    </label>
                </fieldset>
                {mode === 'delete_contents' && totalAssets > 0 ? (
                    <label className="grid gap-2 text-sm font-medium" htmlFor={confirmId}>
                        <span>Ordnernamen zur Bestätigung eingeben</span>
                        <Input
                            autoComplete="off"
                            disabled={isSaving}
                            id={confirmId}
                            onChange={(event) => setTypedName(event.target.value)}
                            placeholder={folder.name}
                            value={typedName}
                        />
                    </label>
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
                        disabled={
                            isSaving || (mode === 'delete_contents' && totalAssets > 0 && !nameMatches)
                        }
                        onClick={() => onConfirm(mode)}
                        type="button"
                        variant="destructive"
                    >
                        {isSaving ? 'Wird gelöscht…' : 'Ordner löschen'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
