'use client'

import {useEffect, useState} from 'react'

import {Button} from '@directwerk/ui/components/button'
import ConfirmDialog from '@directwerk/ui/components/confirm-dialog'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@directwerk/ui/components/dialog'
import {Input} from '@directwerk/ui/components/input'
import type {PublicationStatus} from '@directwerk/api/types'

export interface DeletePublicationItem {
    id: number
    slug?: string
    title: string
    status: PublicationStatus
}

/**
 * Shared delete confirmation for episodes and articles.
 *
 * DRAFT (and ARCHIVED) items use the shared simple {@link ConfirmDialog};
 * PUBLISHED/SCHEDULED items are publicly visible, so they require typing the
 * slug to confirm. The slug falls back to the title when empty.
 */
export default function DeletePublicationDialog({
    open,
    onOpenChange,
    item,
    contentLabel,
    pending,
    onConfirm,
    errorMessage,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    item: DeletePublicationItem | null
    contentLabel: string
    pending: boolean
    onConfirm: () => void
    /**
     * Delete failure to surface inside the dialog. The dialog stays open on
     * failure so a typed slug confirmation survives — without this the error
     * would only exist behind the modal and be invisible to the user.
     */
    errorMessage?: string | null
}): React.JSX.Element | null {
    const [typedToken, setTypedToken] = useState('')

    useEffect(() => {
        if (open) {
            setTypedToken('')
        }
    }, [open, item?.id])

    if (item === null) {
        return null
    }

    const requiresTyping = item.status === 'PUBLISHED' || item.status === 'SCHEDULED'
    const confirmToken = item.slug !== undefined && item.slug.trim().length > 0
        ? item.slug
        : item.title
    const tokenMatches = typedToken.trim() === confirmToken

    if (!requiresTyping) {
        return (
            <ConfirmDialog
                cancelLabel="Abbrechen"
                confirmLabel="Löschen"
                description={
                    <>
                        <span>
                            {`„${item.title}“ wird endgültig gelöscht. Dieser Vorgang kann nicht rückgängig gemacht werden.`}
                        </span>
                        {errorMessage != null && errorMessage.length > 0 ? (
                            <span className="mt-2 block text-destructive" role="alert">
                                {errorMessage}
                            </span>
                        ) : null}
                    </>
                }
                destructive
                onConfirm={onConfirm}
                onOpenChange={onOpenChange}
                open={open}
                pending={pending}
                pendingLabel="Wird gelöscht…"
                title={`${contentLabel} löschen?`}
            />
        )
    }

    return (
        <Dialog
            onOpenChange={(nextOpen, eventDetails) => {
                if (pending && !nextOpen) {
                    eventDetails.cancel()
                    return
                }
                onOpenChange(nextOpen)
            }}
            open={open}
        >
            <DialogContent className="sm:max-w-md" closeLabel="Schließen">
                <DialogHeader>
                    <DialogTitle>{`${contentLabel} löschen?`}</DialogTitle>
                    <DialogDescription>
                        {`„${item.title}“ ist ${item.status === 'PUBLISHED' ? 'veröffentlicht' : 'zur Veröffentlichung geplant'} und damit öffentlich sichtbar. Das Löschen kann nicht rückgängig gemacht werden. Tippe zur Bestätigung den Slug „${confirmToken}“ ein.`}
                    </DialogDescription>
                </DialogHeader>
                <label className="grid gap-1.5 text-sm font-medium" htmlFor="delete-publication-slug">
                    <span>Slug zur Bestätigung</span>
                    <Input
                        autoComplete="off"
                        disabled={pending}
                        id="delete-publication-slug"
                        onChange={(event) => setTypedToken(event.target.value)}
                        placeholder={confirmToken}
                        value={typedToken}
                    />
                </label>
                {errorMessage != null && errorMessage.length > 0 ? (
                    <p className="text-sm text-destructive" role="alert">
                        {errorMessage}
                    </p>
                ) : null}
                <DialogFooter>
                    <Button
                        disabled={pending}
                        onClick={() => onOpenChange(false)}
                        type="button"
                        variant="outline"
                    >
                        Abbrechen
                    </Button>
                    <Button
                        disabled={pending || !tokenMatches}
                        onClick={onConfirm}
                        type="button"
                        variant="destructive"
                    >
                        {pending ? 'Wird gelöscht…' : 'Endgültig löschen'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
