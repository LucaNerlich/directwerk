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

import {
    MAX_FOLDER_DEPTH,
    descendantFolderIds,
    flattenFolderTree,
    buildFolderTree,
    folderDepth,
    isValidFolderName,
    siblingNameTaken,
} from '@/lib/media/folders'
import type {MediaFolder} from '@directwerk/api/types'

interface MediaFolderDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    folders: MediaFolder[]
    mode: 'create' | 'rename'
    /** Folder being renamed; unused in create mode. */
    folder?: MediaFolder | null
    /** Preselected parent in create mode (usually the current folder). */
    initialParentId?: number | null
    isSaving: boolean
    errorMessage: string | null
    onSubmit: (name: string, parentId: number | null) => void
}

/**
 * Create/rename dialog for media library folders. The API validates
 * authoritatively (400/409) — client-side checks only give instant feedback.
 */
export default function MediaFolderDialog({
    open,
    onOpenChange,
    folders,
    mode,
    folder = null,
    initialParentId = null,
    isSaving,
    errorMessage,
    onSubmit,
}: MediaFolderDialogProps): React.JSX.Element {
    const [name, setName] = useState('')
    const [parentId, setParentId] = useState('')
    const nameId = useId()
    const parentIdInput = useId()

    useEffect(() => {
        if (open) {
            setName(mode === 'rename' ? (folder?.name ?? '') : '')
            setParentId(
                mode === 'create' &&
                    initialParentId !== null &&
                    folderDepth(folders, initialParentId) < MAX_FOLDER_DEPTH
                    ? String(initialParentId)
                    : '',
            )
        }
    }, [open, mode, folder, folders, initialParentId])

    const excludeId = mode === 'rename' ? (folder?.id ?? null) : null
    const excludedIds = new Set<number>()
    if (excludeId !== null) {
        excludedIds.add(excludeId)
        for (const descendant of descendantFolderIds(folders, excludeId)) {
            excludedIds.add(descendant)
        }
    }
    const options = flattenFolderTree(buildFolderTree(folders)).filter(
        (node) =>
            !excludedIds.has(node.folder.id) &&
            folderDepth(folders, node.folder.id) < MAX_FOLDER_DEPTH,
    )

    const resolvedParentId = mode === 'rename' ? null : parentId === '' ? null : Number(parentId)
    const nameValid = isValidFolderName(name)
    const duplicate =
        nameValid &&
        siblingNameTaken(
            folders,
            mode === 'rename' ? (folder?.parentId ?? null) : resolvedParentId,
            name,
            excludeId ?? undefined,
        )

    return (
        <Dialog onOpenChange={onOpenChange} open={open}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>
                        {mode === 'create' ? 'Neuer Ordner' : 'Ordner umbenennen'}
                    </DialogTitle>
                    <DialogDescription>
                        {mode === 'create'
                            ? 'Ordnernamen sind pro Ablageort einmalig. Die Tiefe ist auf 8 Ebenen begrenzt.'
                            : `„${folder?.name ?? ''}“ umbenennen.`}
                    </DialogDescription>
                </DialogHeader>
                <label className="grid gap-2 text-sm font-medium" htmlFor={nameId}>
                    <span>Name</span>
                    <Input
                        aria-invalid={name.trim().length > 0 && (!nameValid || duplicate)}
                        autoComplete="off"
                        disabled={isSaving}
                        id={nameId}
                        maxLength={255}
                        onChange={(event) => setName(event.target.value)}
                        placeholder="z. B. Interviews"
                        value={name}
                    />
                </label>
                {!nameValid && name.trim().length > 0 ? (
                    <p className="text-xs text-destructive" role="alert">
                        Der Name darf nicht leer sein (max. 255 Zeichen).
                    </p>
                ) : duplicate ? (
                    <p className="text-xs text-destructive" role="alert">
                        An diesem Ort gibt es bereits einen Ordner mit diesem Namen.
                    </p>
                ) : null}
                {mode === 'create' ? (
                    <label className="grid gap-2 text-sm font-medium" htmlFor={parentIdInput}>
                        <span>Ablageort</span>
                        <select
                            className="native-select"
                            disabled={isSaving}
                            id={parentIdInput}
                            onChange={(event) => setParentId(event.target.value)}
                            value={parentId}
                        >
                            <option value="">Bibliothek (oberste Ebene)</option>
                            {options.map((node) => (
                                <option key={node.folder.id} value={node.folder.id}>
                                    {`${'— '.repeat(node.depth)}${node.folder.name}`}
                                </option>
                            ))}
                        </select>
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
                        disabled={isSaving || !nameValid || duplicate}
                        onClick={() => onSubmit(name.trim(), resolvedParentId)}
                        type="button"
                    >
                        {isSaving
                            ? 'Speichert…'
                            : mode === 'create'
                              ? 'Ordner anlegen'
                              : 'Umbenennen'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
