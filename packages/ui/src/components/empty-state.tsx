import type {ReactNode} from 'react'

import {cn} from '#lib/utils'

export default function EmptyState({
    icon,
    title,
    description,
    action,
    className,
}: {
    icon?: ReactNode
    title: string
    description?: ReactNode
    action?: ReactNode
    className?: string
}): React.JSX.Element {
    return (
        <div
            className={cn(
                'flex min-h-52 flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 px-6 py-10 text-center',
                className,
            )}
        >
            {icon !== undefined ? (
                <div className="mb-4 rounded-full border bg-background p-3 text-muted-foreground">
                    {icon}
                </div>
            ) : null}
            <h2 className="text-lg font-semibold">{title}</h2>
            {description !== undefined ? (
                <div className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                    {description}
                </div>
            ) : null}
            {action !== undefined ? <div className="mt-5">{action}</div> : null}
        </div>
    )
}
