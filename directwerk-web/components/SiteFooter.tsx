'use client'

import Link from 'next/link'

import {useSubscriberAuth} from '@/lib/auth/useSubscriberAuth'
import {useSiteConfig} from '@/lib/site/SiteConfigProvider'

export default function SiteFooter(): React.JSX.Element {
    const config = useSiteConfig()
    const {isAuthenticated} = useSubscriberAuth()
    const name = config.branding.siteTitle ?? config.tenant.name
    const showPodcast = config.enabledModules.includes('PODCAST')
    const showArticles =
        config.enabledModules.includes('DIGITAL_CONTENT') || showPodcast
    const showPricing = config.enabledModules.includes('SUBSCRIPTION')
    const showFeeds =
        config.enabledModules.includes('PODCAST_RSS') ||
        config.enabledModules.includes('ARTICLE_RSS')
    const showDownloads = config.enabledModules.includes('DIGITAL_CONTENT')

    return (
        <footer className="mt-16 border-t">
            <div className="page-container flex flex-col gap-6 py-8 text-sm text-muted-foreground">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                        <p className="font-medium text-foreground">{name}</p>
                        <p>
                            {isAuthenticated
                                ? 'Angemeldet — verwalte Zugang, Feeds und Benachrichtigungen im Konto.'
                                : 'Freie Inhalte ohne Anmeldung. Registriere dich für bezahlte Folgen und Bonusdateien.'}
                        </p>
                    </div>
                    <nav aria-label="Fußzeile" className="flex flex-wrap gap-x-4 gap-y-2">
                        {showPodcast ? <Link className="inline-flex min-h-[44px] items-center" href="/episodes">Podcast</Link> : null}
                        {showArticles ? <Link className="inline-flex min-h-[44px] items-center" href="/articles">Beiträge</Link> : null}
                        {showPricing ? <Link className="inline-flex min-h-[44px] items-center" href="/pricing">Preise</Link> : null}
                        {showFeeds ? <Link className="inline-flex min-h-[44px] items-center" href="/feeds">Feeds</Link> : null}
                        {showDownloads && isAuthenticated ? (
                            <Link className="inline-flex min-h-[44px] items-center" href="/downloads">Bonusdateien</Link>
                        ) : null}
                        <Link className="inline-flex min-h-[44px] items-center" href="/account">{isAuthenticated ? 'Mein Konto' : 'Konto'}</Link>
                        {!isAuthenticated ? (
                            <>
                                <Link className="inline-flex min-h-[44px] items-center" href="/login">Anmelden</Link>
                                <Link className="inline-flex min-h-[44px] items-center" href="/register">Registrieren</Link>
                            </>
                        ) : null}
                    </nav>
                </div>
            </div>
        </footer>
    )
}
