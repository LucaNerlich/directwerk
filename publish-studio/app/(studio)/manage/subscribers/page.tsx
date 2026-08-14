import SubscribersClient from '@/components/manage/SubscribersClient'
import SubscriptionModuleGate from '@/components/studio/SubscriptionModuleGate'
import TenantAdminGuard from '@/components/studio/TenantAdminGuard'

export default function SubscribersPage(): React.JSX.Element {
    return (
        <SubscriptionModuleGate>
            <TenantAdminGuard>
                <SubscribersClient />
            </TenantAdminGuard>
        </SubscriptionModuleGate>
    )
}
