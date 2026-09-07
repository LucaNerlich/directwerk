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

export interface BulkDeletePublicationItem {
    id: number
    title: string
    status: PublicationStatus
}

const CONFIRM_TOKEN = 'LÖSCHEN'
const VISIBLE_STATUSES: PublicationStatus[] = ['PUBLISHED', 'SCHEDULED']
const SHOWN_TITLES = 5

/**
 * Bulk delete confirmation for episodes and articles.
 *
 * Draft-only selections use the shared simple {@link ConfirmDialog}; when a
 * publicly visible item is included, typing LÖSCHEN is required — the bulk
 * equivalent of the single-item slug confirmation.
 */
export default function BulkDeletePublicationDialog({
    open,
    onOpenChange,
    items,
    contentLabel,
    contentLabelPlural,
    pending,
    onConfirm,
    errorMessage,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    items: BulkDeletePublicationItem[]
    contentLabel: string
    contentLabelPlural: string
    pending: boolean
    onConfirm: () => void
    errorMessage?: string | null
}): React.JSX.Element | null {
    const [typedToken, setTypedToken] = useState('')

    useEffect(() => {
        if (open) {
            setTypedToken('')
        }
    }, [open])

    if (items.length === 0) {
        return null
    }

    const requiresTyping = items.some((item) => VISIBLE_STATUSES.includes(item.status))
    const shownTitles = items.slice(0, SHOWN_TITLES).map((item) => item.title)
    const remainingCount = items.length - shownTitles.length
    const titleList = remainingCount > 0
        ? `${shownTitles.map((title) => `„${title}“`).join(', ')} und ${remainingCount} weitere`
        : shownTitles.map((title) => `„${title}“`).join(', ')
    const description =
        items.length === 1
            ? `${titleList} wird endgültig gelöscht. Dieser Vorgang kann nicht rückgängig gemacht werden.`
            : `${items.length} ${contentLabelPlural} (${titleList}) werden endgültig gelöscht. Dieser Vorgang kann nicht rückgängig gemacht werden.`

    if (!requiresTyping) {
        return (
            <ConfirmDialog
                cancelLabel="Abbrechen"
                confirmLabel={items.length === 1 ? 'Löschen' : `Alle ${items.length} löschen`}
                description={
                    <>
                        <span>{description}</span>
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

    const tokenMatches = typedToken.trim() === CONFIRM_TOKEN
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
                        {`${description} Darunter sind öffentlich sichtbare Inhalte. Tippe zur Bestätigung „${CONFIRM_TOKEN}“ ein.`}
                    </DialogDescription>
                </DialogHeader>
                <label className="grid gap-1.5 text-sm font-medium" htmlFor="bulk-delete-confirm">
                    <span>Bestätigung</span>
                    <Input
                        autoComplete="off"
                        disabled={pending}
                        id="bulk-delete-confirm"
                        onChange={(event) => setTypedToken(event.target.value)}
                        placeholder={CONFIRM_TOKEN}
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
                        {pending
                            ? 'Wird gelöscht…'
                            : items.length === 1
                              ? 'Endgültig löschen'
                              : `Alle ${items.length} endgültig löschen`}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
