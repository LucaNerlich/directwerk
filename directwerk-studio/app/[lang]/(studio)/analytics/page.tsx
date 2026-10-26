'use client'

import PageHeader from '@directwerk/ui/components/page-header'
import PageStack from '@directwerk/ui/components/page-stack'

import AnalyticsDashboardClient from '@/components/analytics/AnalyticsDashboardClient'
import {hasModule} from '@/lib/api/client'
import {useSiteConfig} from '@/lib/site/SiteConfigProvider'

export default function AnalyticsPage(): React.JSX.Element {
    const config = useSiteConfig()

    return (
        <PageStack>
            <PageHeader
                eyebrow="Auswertung"
                title="Statistiken"
                description={`Kennzahlen für ${config.tenant.name} — Inhalte, Publikum und Reichweite im Überblick.`}
            />
            <AnalyticsDashboardClient
                analytics={config.analytics}
                analyticsModuleEnabled={hasModule(config, 'ANALYTICS')}
                desks={config.studioDesks}
                subscriptionEnabled={hasModule(config, 'SUBSCRIPTION')}
            />
        </PageStack>
    )
}
