import TenantAdminGuard from '@/components/studio/TenantAdminGuard'
import StripeSettingsClient from '@/components/settings/StripeSettingsClient'

export default function StripeSettingsPage(): React.JSX.Element {
    return (
        <TenantAdminGuard>
            <StripeSettingsClient />
        </TenantAdminGuard>
    )
}
