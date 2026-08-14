import type {ReactNode} from 'react'

import {cn} from '#lib/utils'

export default function ResponsiveTable({
    children,
    className,
    label,
}: {
    children: ReactNode
    className?: string
    label?: string
}): React.JSX.Element {
    return (
        <div
            aria-label={label}
            className={cn(
                'w-full overflow-x-auto rounded-xl border bg-card shadow-sm',
                className,
            )}
            role={label === undefined ? undefined : 'region'}
            tabIndex={0}
        >
            {children}
        </div>
    )
}
