import ProductEditor from '@/components/manage/ProductEditor'
import SubscriptionModuleGate from '@/components/studio/SubscriptionModuleGate'
import TenantAdminGuard from '@/components/studio/TenantAdminGuard'

interface ProductPageProps {
    params: Promise<{productId: string}>
}

export default async function ProductPage({
    params,
}: ProductPageProps): Promise<React.JSX.Element> {
    const {productId} = await params
    const parsed = Number.parseInt(productId, 10)

    if (!Number.isSafeInteger(parsed) || parsed < 1) {
        return <p>Ungültige Produkt-ID.</p>
    }

    return (
        <SubscriptionModuleGate>
            <TenantAdminGuard>
                <ProductEditor productId={parsed} />
            </TenantAdminGuard>
        </SubscriptionModuleGate>
    )
}
