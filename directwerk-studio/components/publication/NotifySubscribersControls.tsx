'use client'

import {Button} from '@directwerk/ui/components/button'
import {Checkbox} from '@directwerk/ui/components/checkbox'
import type {ContentNotifyPreview} from '@directwerk/api/types'
import {useDictionary, useLocale} from '@/components/i18n/LocaleProvider'

interface NotifySubscribersControlsProps {
    mode: 'draft' | 'published'
    notifySubscribers: boolean
    onNotifyChange: (value: boolean) => void
    audienceHint: string | null
    preview: ContentNotifyPreview | null
    onRetry?: () => void
    isRetrying?: boolean
    disabled?: boolean
}

function formatWhen(iso: string | null, locale: string): string | null {
    if (iso === null || iso.length === 0) {
        return null
    }
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) {
        return iso
    }
    return new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(date)
}

function jobStatusLabel(
    status: string | null,
    dict: {
        notifyJobFailed: string
        notifyJobQueued: string
        notifyJobProcessing: string
        notifyJobCompleted: string
    },
): string | null {
    switch (status) {
        case 'FAILED':
            return dict.notifyJobFailed
        case 'QUEUED':
            return dict.notifyJobQueued
        case 'PROCESSING':
            return dict.notifyJobProcessing
        case 'COMPLETED':
            return dict.notifyJobCompleted
        default:
            return null
    }
}

export default function NotifySubscribersControls({
    mode,
    notifySubscribers,
    onNotifyChange,
    audienceHint,
    preview,
    onRetry,
    isRetrying = false,
    disabled = false,
}: NotifySubscribersControlsProps): React.JSX.Element {
    const dict = useDictionary()
    const pub = dict.publication
    const locale = useLocale()
    const recipients =
        preview !== null
            ? preview.estimatedRecipients === 0
                ? pub.notifyAudienceZero
                : pub.notifyAudienceCount.replace('${count}', String(preview.estimatedRecipients))
            : audienceHint
    const lastSent = formatWhen(preview?.emailNotifiedAt ?? null, locale)
    const statusLabel = jobStatusLabel(preview?.jobStatus ?? null, pub)
    const showRetry = mode === 'published' && preview?.canRetry === true && onRetry !== undefined

    return (
        <div className="space-y-2 text-sm">
            {mode === 'draft' ? (
                <label className="flex cursor-pointer items-start gap-2 font-normal">
                    <Checkbox
                        checked={notifySubscribers}
                        className="mt-0.5"
                        disabled={disabled}
                        onCheckedChange={(checked) => onNotifyChange(checked === true)}
                    />
                    <span>
                        {pub.abonnentenBenachrichtigenBeimVeroeffentlichen}
                        {recipients !== null && recipients.length > 0 ? (
                            <>
                                <br />
                                <span className="text-muted-foreground">{recipients}</span>
                            </>
                        ) : null}
                    </span>
                </label>
            ) : (
                <div className="space-y-1">
                    <p className="font-medium">{pub.abonnentenBenachrichtigen}</p>
                    {recipients !== null && recipients.length > 0 ? (
                        <p className="text-muted-foreground">{recipients}</p>
                    ) : null}
                    {lastSent !== null ? (
                        <p className="text-muted-foreground">
                            {pub.notifyLastSent.replace('${when}', lastSent)}
                        </p>
                    ) : null}
                    {statusLabel !== null ? (
                        <p
                            className={
                                preview?.jobStatus === 'FAILED'
                                    ? 'text-destructive'
                                    : 'text-muted-foreground'
                            }
                            role={preview?.jobStatus === 'FAILED' ? 'alert' : 'status'}
                        >
                            {statusLabel}
                            {preview?.jobStatus === 'FAILED' &&
                            preview.lastError !== null &&
                            preview.lastError.length > 0
                                ? `: ${preview.lastError}`
                                : null}
                        </p>
                    ) : null}
                    {preview?.notifyAvailable === false ? (
                        <p className="text-muted-foreground">{pub.notifyUnavailable}</p>
                    ) : null}
                    {showRetry ? (
                        <Button
                            disabled={disabled || isRetrying}
                            onClick={onRetry}
                            size="sm"
                            type="button"
                            variant="outline"
                        >
                            {isRetrying
                                ? pub.notifyRetrying
                                : preview?.emailNotifiedAt === null
                                  ? pub.notifySendNow
                                  : pub.notifyRetry}
                        </Button>
                    ) : null}
                </div>
            )}
        </div>
    )
}
