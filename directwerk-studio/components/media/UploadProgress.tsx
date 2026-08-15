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
        <div className={className}>
            <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                <span id={nameId} className="truncate font-medium">{file.name}</span>
                <span className="shrink-0 text-muted-foreground">{percent} %</span>
            </div>
            <Progress value={percent} aria-labelledby={nameId} />
            <p className="mt-1 text-xs text-muted-foreground">Hochladen…</p>
        </div>
    )
}
