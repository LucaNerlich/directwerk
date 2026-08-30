import type {ReactNode} from 'react'

import {cn} from '#lib/utils'

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
