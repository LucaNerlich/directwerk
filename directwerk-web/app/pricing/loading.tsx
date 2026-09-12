import PageStack from '@directwerk/ui/components/page-stack'

import {CardGridSkeleton} from '@/components/ContentLoadingSkeleton'

export default function PricingLoading(): React.JSX.Element {
    return (
        <PageStack className="page-container">
            <div aria-busy="true" aria-label="Preise werden geladen" role="status">
                <CardGridSkeleton cards={3} columns={3} />
            </div>
        </PageStack>
    )
}
