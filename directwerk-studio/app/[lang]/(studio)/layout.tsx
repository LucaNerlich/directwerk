import AuthGuard from '@/components/studio/AuthGuard'
import StudioShell from '@/components/studio/StudioShell'
import {assertLocale} from '@/lib/i18n'
import {requireStudioSiteConfig} from '@/lib/site/requireSiteConfig'

export const dynamic = 'force-dynamic'

export default async function StudioLayout({
    children,
    params,
}: {
    children: React.ReactNode
    params: Promise<{lang: string}>
}): Promise<React.JSX.Element> {
    const {lang: langParam} = await params
    const lang = assertLocale(langParam)
    const {config} = await requireStudioSiteConfig(lang)

    return (
        <AuthGuard>
            <StudioShell config={config}>{children}</StudioShell>
        </AuthGuard>
    )
}
