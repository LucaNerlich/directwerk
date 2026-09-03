import type {ReactNode} from 'react'

import {cn} from '#lib/utils'

/**
 * Shared form helper/error text.
 *
 * `FieldError` always carries `role="alert"` so form errors are announced
 * consistently; `FieldHint` is the non-alert counterpart for help text.
 * Use these instead of hand-rolled `<p className="text-destructive">`
 * variants, which drift in size, role, and live-region behavior.
 */
export function FieldError({
    children,
    className,
}: {
    children: ReactNode
    className?: string
}): React.JSX.Element {
    return (
        <p className={cn('text-sm text-destructive', className)} role="alert">
            {children}
        </p>
    )
}

export function FieldHint({
    children,
    className,
}: {
    children: ReactNode
    className?: string
}): React.JSX.Element {
    return (
        <p className={cn('text-sm text-muted-foreground', className)}>
            {children}
        </p>
    )
}
