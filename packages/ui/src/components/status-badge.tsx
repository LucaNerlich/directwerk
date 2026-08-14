import type {ReactNode} from 'react'

import {Badge} from '#components/badge'

type StatusTone = 'neutral' | 'success' | 'warning' | 'danger'

const TONES: Record<StatusTone, string> = {
    neutral: 'border-border bg-muted text-muted-foreground',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    warning: 'border-amber-200 bg-amber-50 text-amber-800',
    danger: 'border-red-200 bg-red-50 text-red-800',
}

export default function StatusBadge({
    children,
    tone = 'neutral',
}: {
    children: ReactNode
    tone?: StatusTone
}): React.JSX.Element {
    return (
        <Badge className={TONES[tone]} variant="outline">
            {children}
        </Badge>
    )
}
