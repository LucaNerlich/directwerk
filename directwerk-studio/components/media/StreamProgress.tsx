'use client'

import {Progress} from '@directwerk/ui/components/progress'
import {useId} from 'react'

export default function StreamProgress({
    label,
    progress,
    detail = 'Wird nach S3 gestreamt…',
    className,
}: {
    label: string
    progress: number | null
    detail?: string
    className?: string
}): React.JSX.Element {
    const nameId = useId()
    const percent =
        progress === null ? null : Math.min(100, Math.max(0, Math.round(progress)))
    return (
        <div
            aria-busy={percent === null || percent < 100}
            className={className ?? 'rounded-xl border bg-card p-4'}
        >
            <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                <span id={nameId} className="truncate font-medium">
                    {label}
                </span>
                <span aria-hidden="true" className="shrink-0 text-muted-foreground">
                    {percent === null ? '…' : `${percent} %`}
                </span>
            </div>
            <Progress
                value={percent ?? 0}
                aria-labelledby={nameId}
                aria-valuetext={percent === null ? 'Unbekannter Fortschritt' : `${percent} Prozent`}
            />
            <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
        </div>
    )
}
