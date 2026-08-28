import type {ReactNode} from 'react'

import {cn} from '#lib/utils'

export default function StatCard({
    label,
    value,
    hint,
    footer,
    className,
}: {
    label: string
    value: ReactNode
    hint?: ReactNode
    footer?: ReactNode
    className?: string
}): React.JSX.Element {
    return (
        <div
            className={cn(
                'rounded-xl border bg-card p-5 shadow-sm',
                className,
            )}
        >
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                {label}
            </p>
            <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
            {hint !== undefined ? (
                <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
            ) : null}
            {footer !== undefined ? <div className="mt-3 text-sm">{footer}</div> : null}
        </div>
    )
}
