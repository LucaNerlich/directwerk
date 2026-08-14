import AuthGuard from '@/components/studio/AuthGuard'
import StudioShell from '@/components/studio/StudioShell'
import {fetchSiteConfigServer} from '@/lib/site/fetchSiteConfigServer'
import {getTenantHost} from '@/lib/site/getTenantHost'

export const dynamic = 'force-dynamic'

export default async function StudioLayout({children}: {children: React.ReactNode}): Promise<React.JSX.Element> {
    const host = await getTenantHost()
    const config = await fetchSiteConfigServer(host)

    return (
        <AuthGuard>
            <StudioShell config={config}>{children}</StudioShell>
        </AuthGuard>
    )
}
