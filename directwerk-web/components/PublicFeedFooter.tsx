'use client'

import Link from 'next/link'

import CopyUrlButton from '@/components/CopyUrlButton'
import {useDictionary, useLocale} from '@/lib/i18n/LocaleProvider'
import {localizedPath} from '@/lib/i18n/paths'

export type PublicFeedKind = 'podcast' | 'articles'

/**
 * Compact catalog subscribe bar: public feed URL, copy action, and link to /feeds.
 */
export function PublicFeedStrip({
    kind,
    publicFeedUrl,
}: {
    kind: PublicFeedKind
    publicFeedUrl: string
}): React.JSX.Element {
    const lang = useLocale()
    const {catalog, nav, common} = useDictionary()
    const label =
        kind === 'podcast'
            ? catalog.publicPodcastFeedLabel
            : catalog.publicArticleFeedLabel
    return (
        <section
            aria-label={common.subscribeFeedAria}
            className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border bg-card px-4 py-3 text-sm shadow-sm"
        >
            <span className="font-medium">{catalog.publicFeedTitle}</span>
            <span
                className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground"
                title={publicFeedUrl}
            >
                {publicFeedUrl}
            </span>
            <span className="sr-only">{label}</span>
            <CopyUrlButton context={label} url={publicFeedUrl} />
            <Link
                className="font-medium underline-offset-4 hover:underline"
                href={localizedPath(lang, '/feeds')}
            >
                {nav.manageFeeds}
            </Link>
        </section>
    )
}
