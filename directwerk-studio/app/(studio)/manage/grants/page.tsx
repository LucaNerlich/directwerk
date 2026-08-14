import GrantsClient from '@/components/manage/GrantsClient'
import SubscriptionModuleGate from '@/components/studio/SubscriptionModuleGate'
import TenantAdminGuard from '@/components/studio/TenantAdminGuard'

export default function GrantsPage(): React.JSX.Element {
    return (
        <SubscriptionModuleGate>
            <TenantAdminGuard>
                <GrantsClient />
            </TenantAdminGuard>
        </SubscriptionModuleGate>
    )
}
