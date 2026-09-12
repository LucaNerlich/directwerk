import PageStack from '@directwerk/ui/components/page-stack'
import {Skeleton} from '@directwerk/ui/components/skeleton'

export default function AccountLoading(): React.JSX.Element {
    return (
        <PageStack className="page-container">
            <div aria-busy="true" aria-label="Konto wird geladen" role="status" className="space-y-6">
                <div className="grid gap-3 sm:grid-cols-3">
                    {Array.from({length: 3}, (_, index) => (
                        <div className="space-y-3 rounded-xl border p-5" key={index}>
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-7 w-16" />
                            <Skeleton className="h-3 w-full" />
                        </div>
                    ))}
                </div>
                <Skeleton className="h-40 w-full rounded-xl" />
            </div>
        </PageStack>
    )
}
