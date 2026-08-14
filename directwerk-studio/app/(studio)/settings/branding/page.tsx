import TenantAdminGuard from '@/components/studio/TenantAdminGuard'
import BrandingEditor from '@/components/settings/BrandingEditor'

export default function BrandingSettingsPage(): React.JSX.Element {
    return (
        <TenantAdminGuard>
            <BrandingEditor />
        </TenantAdminGuard>
    )
}
