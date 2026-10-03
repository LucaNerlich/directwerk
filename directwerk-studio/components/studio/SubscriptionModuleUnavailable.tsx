'use client'

import EmptyState from '@directwerk/ui/components/empty-state'
import PageHeader from '@directwerk/ui/components/page-header'
import PageStack from '@directwerk/ui/components/page-stack'

import {useDictionary} from '@/components/i18n/LocaleProvider'

/** Localized empty state when the SUBSCRIPTION module is off. */
export default function SubscriptionModuleUnavailable(): React.JSX.Element {
    const dict = useDictionary()

    return (
        <PageStack>
            <PageHeader
                eyebrow={dict.nav.verwaltung.label}
                title={dict.nav.verwaltung.subscriptions}
                description={dict.gates.subscriptionDescription}
            />
            <div role="status">
                <EmptyState
                    title={dict.gates.subscriptionUnavailable}
                    description={dict.gates.subscriptionModuleInactive}
                />
            </div>
        </PageStack>
    )
}
