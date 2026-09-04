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

import {buildFolderTree, flattenFolderTree} from '@/lib/media/folders'
import type {MediaFolder} from '@directwerk/api/types'

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
    const [target, setTarget] = useState('')
    const targetId = useId()

    useEffect(() => {
        if (open) {
            setTarget(initialParentId !== null ? String(initialParentId) : '')
        }
    }, [open, initialParentId])

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
                    <select
                        className="native-select"
                        disabled={isSaving}
                        id={targetId}
                        onChange={(event) => setTarget(event.target.value)}
                        value={target}
                    >
                        <option value="">Bibliothek (oberste Ebene)</option>
                        {options.map((node) => (
                            <option key={node.folder.id} value={node.folder.id}>
                                {`${'— '.repeat(node.depth)}${node.folder.name}`}
                            </option>
                        ))}
                    </select>
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
                        onClick={() => onSubmit(target === '' ? null : Number(target))}
                        type="button"
                    >
                        {isSaving ? 'Verschiebt…' : 'Verschieben'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
