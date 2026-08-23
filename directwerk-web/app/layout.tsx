import type {Metadata} from 'next'

import BrandTheme from '@directwerk/ui/components/brand-theme'

import AuthBootstrap from '@/components/AuthBootstrap'
import SiteHeader from '@/components/SiteHeader'
import {fetchSiteConfigServer} from '@/lib/site/fetchSiteConfigServer'
import {getTenantHost} from '@/lib/site/getTenantHost'
import {SiteConfigProvider} from '@/lib/site/SiteConfigProvider'
import type {SiteConfig} from '@/lib/api/types'

import './globals.css'

export const dynamic = 'force-dynamic'

export async function generateMetadata(): Promise<Metadata> {
    try {
        const host = await getTenantHost()
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
    let config: SiteConfig
    try {
        const host = await getTenantHost()
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
            publicRssUrl: null,
        }
    }
    const primary = config.branding.primaryColor

    return (
        <html lang="de">
            <body>
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
