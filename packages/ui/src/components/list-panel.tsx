import type {ReactNode} from 'react'

import {cn} from '#lib/utils'

export const listPanelLinkClassName =
    'flex items-center justify-between gap-4 p-4 text-sm no-underline transition-colors hover:bg-muted/40'

export default function ListPanel({
    children,
    className,
}: {
    children: ReactNode
    className?: string
}): React.JSX.Element {
    return (
        <ul
            className={cn(
                'divide-y overflow-hidden rounded-xl border bg-card shadow-sm',
                className,
            )}
        >
            {children}
        </ul>
    )
}

export function ListPanelRow({
    children,
    className,
}: {
    children: ReactNode
    className?: string
}): React.JSX.Element {
    return (
        <li
            className={cn(
                'flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between',
                className,
            )}
        >
            {children}
        </li>
    )
}
