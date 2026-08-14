import BrandTheme from '@publish/ui/components/brand-theme'

import {fetchSiteConfigServer} from '@/lib/site/fetchSiteConfigServer'
import {getTenantHost} from '@/lib/site/getTenantHost'
import {SiteConfigProvider} from '@/lib/site/SiteConfigProvider'

export const dynamic = 'force-dynamic'

export default async function AuthLayout({children}: {children: React.ReactNode}) {
    const host = await getTenantHost()
    const config = await fetchSiteConfigServer(host)

    return (
        <SiteConfigProvider config={config}>
            <BrandTheme primaryHex={config.branding.primaryColor}>
                {children}
            </BrandTheme>
        </SiteConfigProvider>
    )
}
