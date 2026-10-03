import TenantAdminGuard from '@/components/studio/TenantAdminGuard'
import DomainsClient from '@/components/settings/DomainsClient'

export default function DomainsSettingsPage(): React.JSX.Element {
    return (
        <TenantAdminGuard>
            <DomainsClient />
        </TenantAdminGuard>
    )
}
