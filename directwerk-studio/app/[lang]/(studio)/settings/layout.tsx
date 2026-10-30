import TenantAdminGuard from '@/components/studio/TenantAdminGuard'
import SettingsHubNav from '@/components/settings/SettingsHubNav'

export default function SettingsLayout({
    children,
}: {
    children: React.ReactNode
}): React.JSX.Element {
    return (
        <TenantAdminGuard>
            <SettingsHubNav>{children}</SettingsHubNav>
        </TenantAdminGuard>
    )
}
