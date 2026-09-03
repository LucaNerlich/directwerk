import EmptyState from '@directwerk/ui/components/empty-state'
import PageHeader from '@directwerk/ui/components/page-header'
import PageStack from '@directwerk/ui/components/page-stack'

import {hasModule} from '@/lib/api/client'
import {requireStudioSiteConfig} from '@/lib/site/requireSiteConfig'

export default async function SubscriptionModuleGate({
    children,
}: {
    children: React.ReactNode
}): Promise<React.JSX.Element> {
    const {config} = await requireStudioSiteConfig()

    if (!hasModule(config, 'SUBSCRIPTION')) {
        return (
            <PageStack>
                <PageHeader
                    eyebrow="Verwaltung"
                    title="Abos"
                    description="Produkte und Freischaltungen für diesen Mandanten."
                />
                <div role="status">
                    <EmptyState
                        title="Abos nicht verfügbar"
                        description={
                            <>
                                Das Modul <code>SUBSCRIPTION</code> ist für diesen
                                Tenant nicht aktiv. Produkte und Freischaltungen
                                sind daher nicht verfügbar.
                            </>
                        }
                    />
                </div>
            </PageStack>
        )
    }

    return <>{children}</>
}
