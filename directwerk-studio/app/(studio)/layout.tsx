import AuthGuard from '@/components/studio/AuthGuard'
import StudioShell from '@/components/studio/StudioShell'
import {requireStudioSiteConfig} from '@/lib/site/requireSiteConfig'

export const dynamic = 'force-dynamic'

export default async function StudioLayout({children}: {children: React.ReactNode}): Promise<React.JSX.Element> {
    const {config} = await requireStudioSiteConfig()

    return (
        <AuthGuard>
            <StudioShell config={config}>{children}</StudioShell>
        </AuthGuard>
    )
}
