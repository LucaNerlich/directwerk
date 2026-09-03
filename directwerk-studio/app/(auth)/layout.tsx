import BrandTheme from '@directwerk/ui/components/brand-theme'

import {SiteConfigProvider} from '@/lib/site/SiteConfigProvider'
import {resolveStudioSiteContext} from '@/lib/site/requireSiteConfig'

export const dynamic = 'force-dynamic'

export default async function AuthLayout({children}: {children: React.ReactNode}) {
    const {config} = await resolveStudioSiteContext()

    return (
        <SiteConfigProvider config={config}>
            <BrandTheme className="min-h-svh bg-background" primaryHex={config.branding.primaryColor}>
                {children}
            </BrandTheme>
        </SiteConfigProvider>
    )
}
