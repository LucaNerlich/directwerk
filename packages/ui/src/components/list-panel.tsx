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

export function ListPanelLinkItem({
    children,
    className,
}: {
    children: ReactNode
    className?: string
}): React.JSX.Element {
    return <li className={className}>{children}</li>
}

export function ListPanelSlugContent({
    name,
    slug,
    trailing,
    trailingClassName,
}: {
    name: string
    slug: string
    trailing?: ReactNode
    trailingClassName?: string
}): React.JSX.Element {
    return (
        <>
            <span>
                <span className="font-medium">{name}</span>
                <br />
                <small className="text-muted-foreground">{slug}</small>
            </span>
            {trailing !== undefined ? (
                <span className={cn('shrink-0 text-muted-foreground', trailingClassName)}>
                    {trailing}
                </span>
            ) : null}
        </>
    )
}
