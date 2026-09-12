import PageStack from '@directwerk/ui/components/page-stack'

import {ListPanelSkeleton} from '@/components/ContentLoadingSkeleton'

export default function FeedsLoading(): React.JSX.Element {
    return (
        <PageStack className="page-container">
            <div aria-busy="true" aria-label="Feeds werden geladen" role="status">
                <ListPanelSkeleton rows={3} />
            </div>
        </PageStack>
    )
}
