import Link from 'next/link'

import CopyUrlButton from '@/components/CopyUrlButton'

export type PublicFeedKind = 'podcast' | 'articles'

const SHARED_COPY = {
    publicTitle: 'Öffentlicher Feed',
    manageLabel: 'Alle Feeds',
}

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
    const label =
        kind === 'podcast' ? 'Öffentlicher Podcast-Feed' : 'Öffentlicher Beitrags-Feed'
    return (
        <section
            aria-label="Feed abonnieren"
            className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border bg-card px-4 py-3 text-sm shadow-sm"
        >
            <span className="font-medium">{SHARED_COPY.publicTitle}</span>
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
                href="/feeds"
            >
                {SHARED_COPY.manageLabel}
            </Link>
        </section>
    )
}
