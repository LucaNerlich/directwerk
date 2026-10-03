'use client'

import Link from 'next/link'

import {useSubscriberAuth} from '@/lib/auth/useSubscriberAuth'
import {useDictionary, useLocale} from '@/lib/i18n/LocaleProvider'
import {localizedPath} from '@/lib/i18n/paths'
import {useSiteConfig} from '@/lib/site/SiteConfigProvider'

export default function SiteFooter(): React.JSX.Element {
    const config = useSiteConfig()
    const {isAuthenticated} = useSubscriberAuth()
    const lang = useLocale()
    const dictionary = useDictionary()
    const href = (path: string) => localizedPath(lang, path)
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
                                ? dictionary.footer.authenticatedHint
                                : dictionary.footer.guestHint}
                        </p>
                    </div>
                    <nav
                        aria-label={dictionary.nav.footerNav}
                        className="flex flex-wrap gap-x-4 gap-y-2"
                    >
                        {showPodcast ? (
                            <Link className="inline-flex min-h-[44px] items-center" href={href('/episodes')}>
                                {dictionary.nav.podcast}
                            </Link>
                        ) : null}
                        {showArticles ? (
                            <Link className="inline-flex min-h-[44px] items-center" href={href('/articles')}>
                                {dictionary.nav.articles}
                            </Link>
                        ) : null}
                        {config.emailNotifyAvailable ? (
                            <Link className="inline-flex min-h-[44px] items-center" href={href('/newsletter')}>
                                {dictionary.nav.newsletter}
                            </Link>
                        ) : null}
                        {showPricing ? (
                            <Link className="inline-flex min-h-[44px] items-center" href={href('/pricing')}>
                                {dictionary.nav.pricing}
                            </Link>
                        ) : null}
                        {showFeeds ? (
                            <Link className="inline-flex min-h-[44px] items-center" href={href('/feeds')}>
                                {dictionary.nav.feeds}
                            </Link>
                        ) : null}
                        {showDownloads && isAuthenticated ? (
                            <Link className="inline-flex min-h-[44px] items-center" href={href('/downloads')}>
                                {dictionary.nav.downloads}
                            </Link>
                        ) : null}
                        <Link className="inline-flex min-h-[44px] items-center" href={href('/account')}>
                            {isAuthenticated ? dictionary.nav.myAccount : dictionary.nav.account}
                        </Link>
                        <Link className="inline-flex min-h-[44px] items-center" href={href('/imprint')}>
                            {dictionary.nav.imprint}
                        </Link>
                        <Link className="inline-flex min-h-[44px] items-center" href={href('/privacy')}>
                            {dictionary.nav.privacy}
                        </Link>
                        {!isAuthenticated ? (
                            <>
                                <Link className="inline-flex min-h-[44px] items-center" href={href('/login')}>
                                    {dictionary.nav.login}
                                </Link>
                                <Link className="inline-flex min-h-[44px] items-center" href={href('/register')}>
                                    {dictionary.nav.register}
                                </Link>
                            </>
                        ) : null}
                    </nav>
                </div>
            </div>
        </footer>
    )
}
