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

import SelectControl from '@/components/studio/SelectControl'
import {buildFolderTree, flattenFolderTree} from '@/lib/media/folders'
import type {MediaFolder} from '@directwerk/api/types'

/** Base UI Select treats "" as "no value"; use a sentinel for library root. */
const LIBRARY_ROOT = '__library_root__'

interface MediaMoveDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    folders: MediaFolder[]
    /** Folder ids that cannot be move targets (moved folder + descendants). */
    excludeFolderIds?: Set<number>
    title: string
    description: string
    /** Preselected target (usually the current folder). */
    initialParentId?: number | null
    isSaving: boolean
    errorMessage: string | null
    onSubmit: (parentId: number | null) => void
}

/**
 * Target picker for moving assets and/or folders. Moving to the library root
 * is always available; excluded folders (the moved folder and its subtree)
 * cannot be selected.
 */
export default function MediaMoveDialog({
    open,
    onOpenChange,
    folders,
    excludeFolderIds,
    title,
    description,
    initialParentId = null,
    isSaving,
    errorMessage,
    onSubmit,
}: MediaMoveDialogProps): React.JSX.Element {
    const [target, setTarget] = useState(LIBRARY_ROOT)
    const targetId = useId()

    useEffect(() => {
        if (!open) {
            return
        }
        setTarget(
            initialParentId !== null && !excludeFolderIds?.has(initialParentId)
                ? String(initialParentId)
                : LIBRARY_ROOT,
        )
        // Reset only when the dialog opens; excludeFolderIds may be a new Set
        // identity on every parent re-render (e.g. submit busy state).
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open])

    const options = flattenFolderTree(buildFolderTree(folders)).filter(
        (node) => excludeFolderIds === undefined || !excludeFolderIds.has(node.folder.id),
    )

    return (
        <Dialog onOpenChange={onOpenChange} open={open}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>
                <label className="grid gap-2 text-sm font-medium" htmlFor={targetId}>
                    <span>Zielordner</span>
                    <SelectControl
                        disabled={isSaving}
                        id={targetId}
                        onChange={(event) => setTarget(event.target.value)}
                        value={target}
                    >
                        <option value={LIBRARY_ROOT}>Bibliothek (oberste Ebene)</option>
                        {options.map((node) => (
                            <option key={node.folder.id} value={node.folder.id}>
                                {`${'— '.repeat(node.depth)}${node.folder.name}`}
                            </option>
                        ))}
                    </SelectControl>
                </label>
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
                        disabled={isSaving}
                        onClick={() =>
                            onSubmit(target === LIBRARY_ROOT ? null : Number(target))
                        }
                        type="button"
                    >
                        {isSaving ? 'Verschiebt…' : 'Verschieben'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
