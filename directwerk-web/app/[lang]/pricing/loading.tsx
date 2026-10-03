'use client'

import PageStack from '@directwerk/ui/components/page-stack'

import {CardGridSkeleton} from '@/components/ContentLoadingSkeleton'

import {useDictionary} from '@/lib/i18n/LocaleProvider'

export default function PricingLoading(): React.JSX.Element {
    const {common} = useDictionary()
    return (
        <PageStack className="page-container">
            <div aria-busy="true" aria-label={common.loadingPricing} role="status">
                <CardGridSkeleton cards={3} columns={3} />
            </div>
        </PageStack>
    )
}
