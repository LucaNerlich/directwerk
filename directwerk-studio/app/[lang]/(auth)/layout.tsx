import BrandTheme from '@directwerk/ui/components/brand-theme'

import AuthChrome from '@/components/i18n/AuthChrome'
import {SiteConfigProvider} from '@/lib/site/SiteConfigProvider'
import {resolveStudioSiteContext} from '@/lib/site/requireSiteConfig'

export const dynamic = 'force-dynamic'

export default async function AuthLayout({children}: {children: React.ReactNode}) {
    const {config} = await resolveStudioSiteContext()

    return (
        <SiteConfigProvider config={config}>
            <BrandTheme className="min-h-svh bg-background" primaryHex={config.branding.primaryColor} secondaryHex={config.branding.secondaryColor}>
                <AuthChrome>{children}</AuthChrome>
            </BrandTheme>
        </SiteConfigProvider>
    )
}
