import {Skeleton} from '@directwerk/ui/components/skeleton'

export function PageLoadingMessage({
    message = 'Wird geladen…',
}: {
    message?: string
}): React.JSX.Element {
    return <p className="text-sm text-muted-foreground">{message}</p>
}

export function ListPanelSkeleton({
    rows = 4,
}: {
    rows?: number
}): React.JSX.Element {
    return (
        <div className="overflow-hidden rounded-xl border">
            {Array.from({length: rows}, (_, index) => (
                <div
                    className="flex items-center gap-4 border-b px-4 py-4 last:border-b-0"
                    key={index}
                >
                    <div className="min-w-0 flex-1 space-y-2">
                        <Skeleton className="h-4 w-2/3" />
                        <Skeleton className="h-3 w-1/2" />
                    </div>
                    <Skeleton className="h-8 w-20" />
                </div>
            ))}
        </div>
    )
}

export function CardGridSkeleton({
    cards = 4,
    columns = 2,
}: {
    cards?: number
    columns?: 1 | 2 | 3
}): React.JSX.Element {
    const gridClass =
        columns === 3
            ? 'sm:grid-cols-2 lg:grid-cols-3'
            : columns === 1
              ? 'grid-cols-1'
              : 'sm:grid-cols-2'

    return (
        <div className={`grid gap-5 ${gridClass}`}>
            {Array.from({length: cards}, (_, index) => (
                <div className="space-y-3 rounded-xl border p-5" key={index}>
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="h-6 w-4/5" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                </div>
            ))}
        </div>
    )
}

export function HeroSkeleton(): React.JSX.Element {
    return (
        <div className="mx-auto flex max-w-3xl flex-col gap-4 py-8 sm:py-14">
            <Skeleton className="h-14 w-40" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-3/4" />
            <Skeleton className="h-20 w-full" />
            <div className="flex gap-3">
                <Skeleton className="h-11 w-40" />
                <Skeleton className="h-11 w-36" />
            </div>
        </div>
    )
}

export function DetailSkeleton(): React.JSX.Element {
    return (
        <div className="max-w-3xl space-y-6" aria-label="Inhalt wird geladen">
            <div className="space-y-3">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-9 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
            </div>
            <div className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
            </div>
            <div className="rounded-xl border p-5">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="mt-3 h-12 w-full" />
            </div>
        </div>
    )
}
