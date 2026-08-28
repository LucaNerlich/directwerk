import type {ReactNode} from 'react'

import {cn} from '#lib/utils'

export default function SectionHeader({
    title,
    description,
    action,
    as: Heading = 'h2',
    id,
    className,
}: {
    title: ReactNode
    description?: ReactNode
    action?: ReactNode
    as?: 'h2' | 'h3'
    id?: string
    className?: string
}): React.JSX.Element {
    return (
        <div
            className={cn(
                'flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between',
                className,
            )}
        >
            <div className="min-w-0">
                <Heading
                    className={cn(
                        'font-semibold tracking-tight',
                        Heading === 'h2' ? 'text-lg' : 'text-base',
                    )}
                    id={id}
                >
                    {title}
                </Heading>
                {description !== undefined ? (
                    <p className="mt-1 text-sm text-muted-foreground">{description}</p>
                ) : null}
            </div>
            {action !== undefined ? (
                <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>
            ) : null}
        </div>
    )
}
