import PageStack from '@directwerk/ui/components/page-stack'

import {CardGridSkeleton} from '@/components/ContentLoadingSkeleton'

export default function DownloadsLoading(): React.JSX.Element {
    return (
        <PageStack className="page-container">
            <div aria-busy="true" aria-label="Bonusdateien werden geladen" role="status">
                <CardGridSkeleton cards={4} columns={2} />
            </div>
        </PageStack>
    )
}
