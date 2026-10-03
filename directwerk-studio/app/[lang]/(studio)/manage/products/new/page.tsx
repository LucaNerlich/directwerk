import ProductEditor from '@/components/manage/ProductEditor'
import SubscriptionModuleGate from '@/components/studio/SubscriptionModuleGate'
import TenantAdminGuard from '@/components/studio/TenantAdminGuard'

export default function NewProductPage(): React.JSX.Element {
    return (
        <SubscriptionModuleGate>
            <TenantAdminGuard>
                <ProductEditor />
            </TenantAdminGuard>
        </SubscriptionModuleGate>
    )
}
