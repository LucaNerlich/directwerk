import Link from 'next/link'

import {Button} from '@directwerk/ui/components/button'
import EmptyState from '@directwerk/ui/components/empty-state'
import PageStack from '@directwerk/ui/components/page-stack'

/**
 * Tenant-branded 404. Renders inside the root layout, so visitors keep the
 * tenant header, navigation, and footer instead of Next's default English page.
 */
export default function NotFound(): React.JSX.Element {
    return (
        <PageStack className="page-container">
            <EmptyState
                action={
                    <Button nativeButton={false} render={<Link href="/" />}>
                        Zur Startseite
                    </Button>
                }
                description="Diese Seite existiert nicht oder wurde verschoben. Über die Navigation findest du alle veröffentlichten Inhalte."
                title="Seite nicht gefunden"
            />
        </PageStack>
    )
}
