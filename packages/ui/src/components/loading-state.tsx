import type {ReactNode} from 'react'

import {Skeleton} from '#components/skeleton'
import {cn} from '#lib/utils'

/**
 * Shared loading fallback for list, form, and panel clients.
 *
 * Replaces ad-hoc `<p>Wird geladen…</p>` placeholders with a consistent
 * `role="status"` live region plus skeleton bars. The message is announced
 * by screen readers; the skeleton artwork is hidden from assistive tech.
 */
export default function LoadingState({
    message,
    lines = 3,
    className,
}: {
    message: ReactNode
    lines?: number
    className?: string
}): React.JSX.Element {
    const count = Math.max(1, Math.floor(lines))

    return (
        <div
            className={cn(
                'flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-sm',
                className,
            )}
            role="status"
        >
            <p className="text-sm text-muted-foreground">{message}</p>
            <div aria-hidden="true" className="flex flex-col gap-2">
                {Array.from({length: count}).map((_, index) => (
                    <Skeleton
                        className={cn(
                            'h-4 w-full',
                            index === count - 1 && count > 1 && 'w-2/3',
                        )}
                        key={index}
                    />
                ))}
            </div>
        </div>
    )
}
