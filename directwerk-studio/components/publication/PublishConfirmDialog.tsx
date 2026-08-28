'use client'

import {Button} from '@directwerk/ui/components/button'
import {Input} from '@directwerk/ui/components/input'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@directwerk/ui/components/dialog'

interface PublishConfirmDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    title: string
    publicationLabel: string
    showNotify: boolean
    notifySubscribers: boolean
    onNotifyChange: (value: boolean) => void
    notifyAudienceHint?: string | null
    isSaving: boolean
    onConfirm: () => void
}

export default function PublishConfirmDialog({
    open,
    onOpenChange,
    title,
    publicationLabel,
    showNotify,
    notifySubscribers,
    onNotifyChange,
    notifyAudienceHint = null,
    isSaving,
    onConfirm,
}: PublishConfirmDialogProps): React.JSX.Element {
    return (
        <Dialog onOpenChange={onOpenChange} open={open}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{publicationLabel} veröffentlichen?</DialogTitle>
                    <DialogDescription>
                        „{title.trim().length > 0 ? title : 'Ohne Titel'}“ wird live geschaltet.
                    </DialogDescription>
                </DialogHeader>
                {showNotify ? (
                    <label className="flex items-start gap-2 text-sm">
                        <Input
                            checked={notifySubscribers}
                            className="mt-0.5 size-4 shrink-0"
                            onChange={(event) => onNotifyChange(event.target.checked)}
                            type="checkbox"
                        />
                        <span>
                            Abonnenten benachrichtigen
                            {notifyAudienceHint !== null && notifyAudienceHint.length > 0 ? (
                                <>
                                    <br />
                                    <span className="text-muted-foreground">{notifyAudienceHint}</span>
                                </>
                            ) : null}
                        </span>
                    </label>
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
                    <Button disabled={isSaving} onClick={onConfirm} type="button">
                        {isSaving ? 'Veröffentlicht…' : 'Veröffentlichen'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
