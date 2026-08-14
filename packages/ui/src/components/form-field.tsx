import type {ReactNode} from 'react'

import {Label} from '#components/label'
import {cn} from '#lib/utils'

export default function FormField({
    htmlFor,
    label,
    hint,
    error,
    children,
    className,
}: {
    htmlFor: string
    label: string
    hint?: ReactNode
    error?: ReactNode
    children: ReactNode
    className?: string
}): React.JSX.Element {
    const messageId = `${htmlFor}-message`

    return (
        <div className={cn('grid gap-2', className)}>
            <Label htmlFor={htmlFor}>{label}</Label>
            {children}
            {error !== undefined ? (
                <p className="text-sm text-destructive" id={messageId} role="alert">
                    {error}
                </p>
            ) : hint !== undefined ? (
                <p className="text-sm text-muted-foreground" id={messageId}>
                    {hint}
                </p>
            ) : null}
        </div>
    )
}
