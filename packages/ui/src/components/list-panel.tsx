import type {ComponentProps} from 'react'

import {cn} from '#lib/utils'

export default function ListPanel({
    className,
    ...props
}: ComponentProps<'ul'>): React.JSX.Element {
    return (
        <ul
            className={cn(
                'divide-y overflow-hidden rounded-xl border bg-card shadow-sm',
                className,
            )}
            {...props}
        />
    )
}

export function ListPanelRow({
    className,
    ...props
}: ComponentProps<'li'>): React.JSX.Element {
    return (
        <li
            className={cn(
                'flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between',
                className,
            )}
            {...props}
        />
    )
}
