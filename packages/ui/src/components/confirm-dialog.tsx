'use client'

import type {ReactNode} from 'react'

import {Button} from '#components/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '#components/dialog'

/**
 * Shared confirm dialog for destructive and consequential actions
 * (delete, revoke, publish). Keeps footer button order, pending states,
 * and the destructive confirm pattern consistent across apps.
 */
export default function ConfirmDialog({
    open,
    onOpenChange,
    title,
    description,
    confirmLabel,
    cancelLabel,
    pendingLabel,
    onConfirm,
    destructive = false,
    pending = false,
    closeLabel = 'Close',
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    title: ReactNode
    description?: ReactNode
    confirmLabel: string
    cancelLabel: string
    pendingLabel?: string
    onConfirm: () => void
    destructive?: boolean
    pending?: boolean
    closeLabel?: string
}): React.JSX.Element {
    return (
        <Dialog onOpenChange={onOpenChange} open={open}>
            <DialogContent closeLabel={closeLabel} className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    {description !== undefined ? (
                        <DialogDescription>{description}</DialogDescription>
                    ) : null}
                </DialogHeader>
                <DialogFooter>
                    <Button
                        disabled={pending}
                        onClick={() => onOpenChange(false)}
                        type="button"
                        variant="outline"
                    >
                        {cancelLabel}
                    </Button>
                    <Button
                        disabled={pending}
                        onClick={onConfirm}
                        type="button"
                        variant={destructive ? 'destructive' : 'default'}
                    >
                        {pending && pendingLabel !== undefined
                            ? pendingLabel
                            : confirmLabel}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
