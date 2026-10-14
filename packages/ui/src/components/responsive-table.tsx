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
            // Issue #402 (a11y half): tabIndex was applied unconditionally, so a caller that
            // passed no label got a focusable scroll region with no accessible name. Only make it
            // focusable when it is an announced region. The remaining redundancy — Table already
            // renders its own overflow-x-auto container — needs all call sites updated together
            // and is tracked separately.
            tabIndex={label === undefined ? undefined : 0}
        >
            {children}
        </div>
    )
}
