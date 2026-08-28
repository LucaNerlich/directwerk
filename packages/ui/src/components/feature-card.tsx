import type {ReactNode} from 'react'

import {cn} from '#lib/utils'

export default function FeatureCard({
    title,
    description,
    children,
    className,
}: {
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
                <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
                {description !== undefined ? (
                    <p className="mt-1 text-sm text-muted-foreground">{description}</p>
                ) : null}
            </div>
            {children}
        </div>
    )
}
