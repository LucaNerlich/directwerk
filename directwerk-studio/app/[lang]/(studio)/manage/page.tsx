import PaymentsDashboardClient from '@/components/manage/PaymentsDashboardClient'
import SubscriptionModuleGate from '@/components/studio/SubscriptionModuleGate'
import TenantAdminGuard from '@/components/studio/TenantAdminGuard'

export default function ManagePage(): React.JSX.Element {
    return (
        <SubscriptionModuleGate>
            <TenantAdminGuard>
                <PaymentsDashboardClient />
            </TenantAdminGuard>
        </SubscriptionModuleGate>
    )
}
