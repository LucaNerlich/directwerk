'use client'

import {Skeleton} from '@directwerk/ui/components/skeleton'

/**
 * Shared loading placeholders for admin pages. Each block is aria-hidden;
 * callers keep a separate polite live-region sentence (e.g. "Loading
 * tenants…") so assistive technology announces progress exactly once.
 */
export function AdminLoadingText({text}: {text: string}): React.JSX.Element {
    return (
        <p aria-live="polite" className="text-sm text-muted-foreground">
            {text}
        </p>
    )
}

export function StatCardsSkeleton(): React.JSX.Element {
    return (
        <div aria-hidden="true" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((index) => (
                <div
                    className="rounded-xl border bg-card p-5 shadow-sm"
                    key={index}
                >
                    <Skeleton className="h-3 w-24" />
                    <Skeleton className="mt-3 h-8 w-16" />
                    <Skeleton className="mt-3 h-4 w-28" />
                </div>
            ))}
        </div>
    )
}

export function TableSkeleton({rows = 5}: {rows?: number}): React.JSX.Element {
    return (
        <div
            aria-hidden="true"
            className="overflow-hidden rounded-xl border bg-card shadow-sm"
        >
            <div className="space-y-0 divide-y">
                {Array.from({length: rows}, (_, index) => (
                    <div className="flex items-center gap-4 p-4" key={index}>
                        <Skeleton className="h-4 w-1/4" />
                        <Skeleton className="h-4 w-1/3" />
                        <Skeleton className="hidden h-4 w-1/5 sm:block" />
                        <Skeleton className="ml-auto h-6 w-16 shrink-0" />
                    </div>
                ))}
            </div>
        </div>
    )
}

export function FormSkeleton(): React.JSX.Element {
    return (
        <div
            aria-hidden="true"
            className="grid gap-4 rounded-xl border bg-card p-5 shadow-sm sm:grid-cols-2"
        >
            {[0, 1, 2, 3].map((index) => (
                <div className="space-y-2" key={index}>
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-9 w-full" />
                </div>
            ))}
        </div>
    )
}
