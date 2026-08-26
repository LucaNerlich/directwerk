'use client'

import {Button} from '@directwerk/ui/components/button'
import {Input} from '@directwerk/ui/components/input'

import type {PublicationStatus} from '@directwerk/api/types'

interface PublicationWorkflowActionsProps {
    status: PublicationStatus
    isSaving: boolean
    canPublish?: boolean
    publishBlockedReason?: string | null
    showNotify: boolean
    notifySubscribers: boolean
    onNotifyChange: (value: boolean) => void
    scheduledAt: string
    onScheduledAtChange: (value: string) => void
    onSave: () => void
    onPublish: () => void
    onSchedule: () => void
    onCancelSchedule: () => void
    onUnpublish: () => void
    onArchive: () => void
    onUnarchive: () => void
}

export default function PublicationWorkflowActions({
    status,
    isSaving,
    canPublish = true,
    publishBlockedReason = null,
    showNotify,
    notifySubscribers,
    onNotifyChange,
    scheduledAt,
    onScheduledAtChange,
    onSave,
    onPublish,
    onSchedule,
    onCancelSchedule,
    onUnpublish,
    onArchive,
    onUnarchive,
}: PublicationWorkflowActionsProps): React.JSX.Element {
    const isDraft = status === 'DRAFT'
    const isScheduled = status === 'SCHEDULED'
    const isPublished = status === 'PUBLISHED'
    const isArchived = status === 'ARCHIVED'

    return (
        <fieldset className="m-0 flex min-w-0 flex-col gap-3 border-0 p-0" disabled={isSaving}>
            <legend className="sr-only">Veröffentlichung</legend>
            <div className="flex flex-wrap items-end gap-2">
                {isDraft && (
                    <Button type="button" className="inline-flex h-9 items-center justify-center rounded-md border bg-background px-4 text-sm font-medium hover:bg-accent disabled:opacity-50" onClick={onSave}>
                        {isSaving ? 'Speichert…' : 'Speichern'}
                    </Button>
                )}
                {(isDraft || isScheduled) && (
                    <Button
                        type="button"
                        className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                        onClick={onPublish}
                        disabled={!canPublish}
                    >
                        Veröffentlichen
                    </Button>
                )}
                {isPublished && (
                    <Button type="button" className="inline-flex h-9 items-center justify-center rounded-md border bg-background px-4 text-sm font-medium hover:bg-accent disabled:opacity-50" onClick={onUnpublish}>
                        Zurückziehen
                    </Button>
                )}
                {isPublished && (
                    <Button type="button" className="inline-flex h-9 items-center justify-center rounded-md border bg-background px-4 text-sm font-medium hover:bg-accent disabled:opacity-50" onClick={onArchive}>
                        Archivieren
                    </Button>
                )}
                {isArchived && (
                    <Button type="button" className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50" onClick={onUnarchive}>
                        Wiederherstellen
                    </Button>
                )}
            </div>

            {(isDraft || isScheduled) && (
                <div className="flex flex-wrap items-end gap-2">
                    <label className="grid gap-2 text-sm font-medium">
                        <span>Geplant für</span>
                        <Input
                            type="datetime-local"
                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                            value={scheduledAt}
                            onChange={(event) => onScheduledAtChange(event.target.value)}
                        />
                    </label>
                    {isDraft && (
                        <Button
                            type="button"
                            className="inline-flex h-9 items-center justify-center rounded-md border bg-background px-4 text-sm font-medium hover:bg-accent disabled:opacity-50"
                            onClick={onSchedule}
                            disabled={!canPublish || scheduledAt.trim().length === 0}
                        >
                            Planen
                        </Button>
                    )}
                    {isScheduled && (
                        <Button
                            type="button"
                            className="inline-flex h-9 items-center justify-center rounded-md border bg-background px-4 text-sm font-medium hover:bg-accent disabled:opacity-50"
                            onClick={onCancelSchedule}
                        >
                            Planung aufheben
                        </Button>
                    )}
                </div>
            )}

            {showNotify && (isDraft || isScheduled) && (
                <label className="flex items-center gap-2 text-sm font-normal">
                    <Input
                        className="size-4 shrink-0" type="checkbox"
                        checked={notifySubscribers}
                        onChange={(event) => onNotifyChange(event.target.checked)}
                    />
                    <span>Abonnenten benachrichtigen</span>
                </label>
            )}
            {publishBlockedReason !== null && (isDraft || isScheduled) ? (
                <p className="text-xs text-muted-foreground" role="status">
                    {publishBlockedReason}
                </p>
            ) : null}
        </fieldset>
    )
}
