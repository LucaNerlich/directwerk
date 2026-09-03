'use client'

import {Progress} from '@directwerk/ui/components/progress'
import {useId} from 'react'

export default function UploadProgress({
    file,
    progress,
    className,
}: {
    file: File
    progress: number
    className?: string
}): React.JSX.Element {
    const nameId = useId()
    const percent = Math.min(100, Math.max(0, Math.round(progress)))
    return (
        <div
            aria-busy={percent < 100}
            className={className ?? 'rounded-xl border bg-card p-4'}
        >
            <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                <span id={nameId} className="truncate font-medium">{file.name}</span>
                <span aria-hidden="true" className="shrink-0 text-muted-foreground">{percent} %</span>
            </div>
            <Progress
                value={percent}
                aria-labelledby={nameId}
                aria-valuetext={`${percent} Prozent hochgeladen`}
            />
            <p className="mt-1 text-xs text-muted-foreground">
                {percent >= 100 ? 'Wird abgeschlossen…' : 'Hochladen… Bitte diese Seite nicht schließen.'}
            </p>
        </div>
    )
}
