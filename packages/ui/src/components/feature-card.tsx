import type {ReactNode} from 'react'

import {cn} from '#lib/utils'

export default function FeatureCard({
    eyebrow,
    title,
    description,
    children,
    media,
    className,
}: {
    eyebrow?: ReactNode
    title: ReactNode
    description?: ReactNode
    children?: ReactNode
    /** Optional side media (e.g. cover). Renders copy+actions left, media right from `sm` up. */
    media?: ReactNode
    className?: string
}): React.JSX.Element {
    const copy = (
        <div className="min-w-0">
            {eyebrow !== undefined ? (
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    {eyebrow}
                </p>
            ) : null}
            <h2
                className={cn(
                    'text-lg font-semibold tracking-tight',
                    eyebrow !== undefined ? 'mt-2' : undefined,
                )}
            >
                {title}
            </h2>
            {description !== undefined ? (
                <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            ) : null}
        </div>
    )

    if (media != null) {
        return (
            <div
                className={cn(
                    'grid gap-4 rounded-xl border bg-card p-5 shadow-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center',
                    className,
                )}
                data-dw-surface="panel"
            >
                <div className="flex min-w-0 flex-col gap-4">
                    {copy}
                    {children}
                </div>
                <div className="justify-self-start sm:justify-self-end">{media}</div>
            </div>
        )
    }

    return (
        <div
            className={cn(
                'flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-sm',
                className,
            )}
            data-dw-surface="panel"
        >
            {copy}
            {children}
        </div>
    )
}
