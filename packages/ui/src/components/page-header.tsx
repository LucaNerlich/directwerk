import type {ReactNode} from 'react'

import {cn} from '#lib/utils'

export default function PageHeader({
    eyebrow,
    title,
    description,
    actions,
    className,
}: {
    eyebrow?: string
    title: ReactNode
    description?: ReactNode
    actions?: ReactNode
    className?: string
}): React.JSX.Element {
    return (
        <header
            className={cn(
                'flex flex-col gap-4 border-b border-border/70 pb-6 sm:flex-row sm:items-end sm:justify-between',
                className,
            )}
        >
            <div className="min-w-0">
                {eyebrow !== undefined ? (
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        {eyebrow}
                    </p>
                ) : null}
                <h1 className="text-pretty text-3xl font-semibold tracking-tight sm:text-4xl">
                    {title}
                </h1>
                {description !== undefined ? (
                    <p className="mt-2 max-w-2xl text-pretty text-sm leading-6 text-muted-foreground sm:text-base">
                        {description}
                    </p>
                ) : null}
            </div>
            {actions !== undefined ? (
                <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
            ) : null}
        </header>
    )
}
