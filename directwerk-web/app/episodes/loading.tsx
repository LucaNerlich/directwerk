import PageStack from '@directwerk/ui/components/page-stack'

import {ListPanelSkeleton} from '@/components/ContentLoadingSkeleton'

export default function EpisodesLoading(): React.JSX.Element {
    return (
        <PageStack className="page-container">
            <div aria-busy="true" aria-label="Folgen werden geladen" role="status">
                <ListPanelSkeleton rows={5} />
            </div>
        </PageStack>
    )
}
