'use client'

import {Button} from '@directwerk/ui/components/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@directwerk/ui/components/dialog'
import type {ContentNotifyPreview} from '@directwerk/api/types'
import {useDictionary} from '@/components/i18n/LocaleProvider'
import NotifySubscribersControls from '@/components/publication/NotifySubscribersControls'

interface PublishConfirmDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    title: string
    publicationLabel: string
    showNotify: boolean
    notifySubscribers: boolean
    onNotifyChange: (value: boolean) => void
    notifyAudienceHint?: string | null
    notifyPreview?: ContentNotifyPreview | null
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
    notifyPreview = null,
    isSaving,
    onConfirm,
}: PublishConfirmDialogProps): React.JSX.Element {
    const dict = useDictionary()

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
                    <NotifySubscribersControls
                        audienceHint={notifyAudienceHint}
                        disabled={isSaving}
                        mode="draft"
                        notifySubscribers={notifySubscribers}
                        onNotifyChange={onNotifyChange}
                        preview={notifyPreview}
                    />
                ) : null}
                <DialogFooter>
                    <Button
                        disabled={isSaving}
                        onClick={() => onOpenChange(false)}
                        type="button"
                        variant="outline"
                    >
                        {dict.common.cancel}
                    </Button>
                    <Button disabled={isSaving} onClick={onConfirm} type="button">
                        {isSaving ? dict.common.publishing : dict.common.publish}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
