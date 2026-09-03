'use client'

import {Button} from '@directwerk/ui/components/button'
import {Checkbox} from '@directwerk/ui/components/checkbox'
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
    notifyAudienceHint?: string | null
    scheduledAt: string
    onScheduledAtChange: (value: string) => void
    publishedAt: string
    onPublishedAtChange: (value: string) => void
    publishValidationError?: string | null
    scheduleValidationError?: string | null
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
    publishedAt,
    onPublishedAtChange,
    publishValidationError = null,
    scheduleValidationError = null,
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
                    <Button type="button" variant="outline" onClick={onSave}>
                        {isSaving ? 'Speichert…' : 'Speichern'}
                    </Button>
                )}
                {(isDraft || isScheduled) && (
                    <Button
                        type="button"
                        onClick={onPublish}
                        disabled={!canPublish}
                    >
                        Veröffentlichen
                    </Button>
                )}
                {isPublished && (
                    <Button type="button" variant="outline" onClick={onUnpublish}>
                        Zurückziehen
                    </Button>
                )}
                {isPublished && (
                    <Button type="button" variant="outline" onClick={onArchive}>
                        Archivieren
                    </Button>
                )}
                {isArchived && (
                    <Button type="button" onClick={onUnarchive}>
                        Wiederherstellen
                    </Button>
                )}
            </div>

            {(isDraft || isScheduled) && (
                <div className="flex flex-wrap items-end gap-2">
                    <label className="grid gap-2 text-sm font-medium">
                        <span>Veröffentlicht am</span>
                        <Input
                            type="datetime-local"
                            value={publishedAt}
                            onChange={(event) => onPublishedAtChange(event.target.value)}
                        />
                        <span className="text-xs font-normal text-muted-foreground">
                            Optional. Leer lassen für „jetzt“. Vergangenes Datum zum Backdaten.
                        </span>
                    </label>
                </div>
            )}

            {(isDraft || isScheduled) && (
                <div className="flex flex-wrap items-end gap-2">
                    <label className="grid gap-2 text-sm font-medium">
                        <span>Geplant für</span>
                        <Input
                            aria-describedby="publication-scheduled-hint"
                            aria-invalid={scheduleValidationError !== null}
                            type="datetime-local"
                            value={scheduledAt}
                            onChange={(event) => onScheduledAtChange(event.target.value)}
                        />
                        <span className="text-xs font-normal text-muted-foreground" id="publication-scheduled-hint">
                            Zeitpunkt in deiner lokalen Zeitzone. Erst mit „Planen“ wirksam.
                        </span>
                    </label>
                    {isDraft && (
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onSchedule}
                            disabled={!canPublish || scheduledAt.trim().length === 0}
                        >
                            Planen
                        </Button>
                    )}
                    {isScheduled && (
                        <Button type="button" variant="outline" onClick={onCancelSchedule}>
                            Planung aufheben
                        </Button>
                    )}
                </div>
            )}

            {showNotify && (isDraft || isScheduled) && (
                <label className="flex cursor-pointer items-center gap-2 text-sm font-normal">
                    <Checkbox
                        checked={notifySubscribers}
                        onCheckedChange={(checked) => onNotifyChange(checked === true)}
                    />
                    <span>Abonnenten benachrichtigen (beim Veröffentlichen)</span>
                </label>
            )}
            {publishValidationError !== null && (isDraft || isScheduled) ? (
                <p className="text-xs text-destructive" role="alert">
                    {publishValidationError}
                </p>
            ) : null}
            {scheduleValidationError !== null && (isDraft || isScheduled) ? (
                <p className="text-xs text-destructive" role="alert">
                    {scheduleValidationError}
                </p>
            ) : null}
            {publishBlockedReason !== null && (isDraft || isScheduled) ? (
                <p className="text-xs text-muted-foreground" role="status">
                    Vor dem Veröffentlichen: {publishBlockedReason}
                </p>
            ) : null}
        </fieldset>
    )
}
