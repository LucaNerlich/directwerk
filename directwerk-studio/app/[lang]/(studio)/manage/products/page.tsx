import ProductListClient from '@/components/manage/ProductListClient'
import SubscriptionModuleGate from '@/components/studio/SubscriptionModuleGate'
import TenantAdminGuard from '@/components/studio/TenantAdminGuard'

export default function ProductsPage(): React.JSX.Element {
    return (
        <SubscriptionModuleGate>
            <TenantAdminGuard>
                <ProductListClient />
            </TenantAdminGuard>
        </SubscriptionModuleGate>
    )
}
