'use client'

import Link from 'next/link'

import {useSiteConfig} from '@/lib/site/SiteConfigProvider'

export default function SiteFooter(): React.JSX.Element {
    const config = useSiteConfig()
    const name = config.branding.siteTitle ?? config.tenant.name
    const showPodcast = config.enabledModules.includes('PODCAST')
    const showArticles =
        config.enabledModules.includes('DIGITAL_CONTENT') || showPodcast
    const showPricing = config.enabledModules.includes('SUBSCRIPTION')
    const showDownloads = config.enabledModules.includes('DIGITAL_CONTENT')

    return (
        <footer className="mt-16 border-t">
            <div className="page-container flex flex-col gap-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                <p>{name}</p>
                <nav aria-label="Fußzeile" className="flex flex-wrap gap-4">
                    {showPodcast ? <Link href="/episodes">Podcast</Link> : null}
                    {showArticles ? <Link href="/articles">Beiträge</Link> : null}
                    {showPricing ? <Link href="/pricing">Preise</Link> : null}
                    {showDownloads ? <Link href="/downloads">Bonusdateien</Link> : null}
                    <Link href="/account">Konto</Link>
                </nav>
            </div>
        </footer>
    )
}
