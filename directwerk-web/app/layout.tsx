import type {Metadata} from 'next'

import BrandTheme from '@directwerk/ui/components/brand-theme'

import AuthBootstrap from '@/components/AuthBootstrap'
import SiteHeader from '@/components/SiteHeader'
import UmamiAnalytics from '@/components/UmamiAnalytics'
import {fetchSiteConfigServer} from '@/lib/site/fetchSiteConfigServer'
import {getTenantHost} from '@/lib/site/getTenantHost'
import {SiteConfigProvider} from '@/lib/site/SiteConfigProvider'
import type {PublicSiteConfig} from '@directwerk/api/types'

import './globals.css'

export async function generateMetadata(): Promise<Metadata> {
    try {
        const host = await getTenantHost()
        if (host === null) {
            throw new Error('Tenant host unresolved')
        }
        const config = await fetchSiteConfigServer(host)
        const title = config.branding.siteTitle ?? config.tenant.name
        return {
            title,
            description: `${config.tenant.name} — Inhalte und Abonnements`,
        }
    } catch {
        return {
            title: 'Publish',
            description: 'Tenant public site',
        }
    }
}

export default async function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode
}>): Promise<React.JSX.Element> {
    // The layout renders on every route — an upstream outage or unmapped host
    // must degrade to a neutral default instead of hard-failing every page.
    let config: PublicSiteConfig
    try {
        const host = await getTenantHost()
        if (host === null) {
            throw new Error('Tenant host unresolved')
        }
        config = await fetchSiteConfigServer(host)
    } catch {
        config = {
            tenant: {slug: 'unknown', name: 'Publish'},
            enabledModules: [],
            branding: {
                siteTitle: null,
                primaryColor: null,
                secondaryColor: null,
                logoUrl: null,
            },
            publicSiteUrl: null,
            publicRssUrl: null,
            publicArticleRssUrl: null,
            analytics: null,
            emailNotifyAvailable: false,
        }
    }
    const primary = config.branding.primaryColor

    return (
        <html lang="de">
            <body>
                <UmamiAnalytics analytics={config.analytics} />
                <SiteConfigProvider config={config}>
                    <BrandTheme primaryHex={primary}>
                        <AuthBootstrap>
                            <SiteHeader>{children}</SiteHeader>
                        </AuthBootstrap>
                    </BrandTheme>
                </SiteConfigProvider>
            </body>
        </html>
    )
}
