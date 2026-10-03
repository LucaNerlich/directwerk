import TenantAdminGuard from '@/components/studio/TenantAdminGuard'
import TeamClient from '@/components/team/TeamClient'

export default function TeamPage(): React.JSX.Element {
    return (
        <TenantAdminGuard>
            <TeamClient />
        </TenantAdminGuard>
    )
}
