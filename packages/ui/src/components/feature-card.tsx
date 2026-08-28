import type {ReactNode} from 'react'

import {cn} from '#lib/utils'

export default function FeatureCard({
    eyebrow,
    title,
    description,
    children,
    className,
}: {
    eyebrow?: ReactNode
    title: ReactNode
    description?: ReactNode
    children?: ReactNode
    className?: string
}): React.JSX.Element {
    return (
        <div
            className={cn(
                'flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-sm',
                className,
            )}
        >
            <div>
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
            {children}
        </div>
    )
}
