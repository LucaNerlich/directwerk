import TenantAdminGuard from '@/components/studio/TenantAdminGuard'
import IntegrationsClient from '@/components/settings/IntegrationsClient'

export default function IntegrationsSettingsPage(): React.JSX.Element {
    return (
        <TenantAdminGuard>
            <IntegrationsClient />
        </TenantAdminGuard>
    )
}
