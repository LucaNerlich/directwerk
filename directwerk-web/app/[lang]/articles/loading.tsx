'use client'

import PageStack from '@directwerk/ui/components/page-stack'

import {ListPanelSkeleton} from '@/components/ContentLoadingSkeleton'

import {useDictionary} from '@/lib/i18n/LocaleProvider'

export default function ArticlesLoading(): React.JSX.Element {
    const {common} = useDictionary()
    return (
        <PageStack className="page-container">
            <div aria-busy="true" aria-label={common.loading} role="status">
                <ListPanelSkeleton rows={5} />
            </div>
        </PageStack>
    )
}
