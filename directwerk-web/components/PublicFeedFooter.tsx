import Link from 'next/link'

import SectionHeader from '@directwerk/ui/components/section-header'

import CopyUrlButton from '@/components/CopyUrlButton'
import FeedUrlDisplay from '@/components/FeedUrlDisplay'

export type PublicFeedKind = 'podcast' | 'articles'

const KIND_COPY: Record<
    PublicFeedKind,
    {
        publicTitle: string
        privateTitle: string
        feedNoun: string
        manageLabel: string
    }
> = {
    podcast: {
        publicTitle: 'Öffentlicher Feed',
        privateTitle: 'Dein privater Feed',
        feedNoun: 'Folgen',
        manageLabel: 'Alle Feeds verwalten',
    },
    articles: {
        publicTitle: 'Öffentlicher Feed',
        privateTitle: 'Dein privater Feed',
        feedNoun: 'Beiträgen',
        manageLabel: 'Alle Feeds verwalten',
    },
}

/**
 * Compact above-the-fold feed strip: public feed URL with copy action plus a
 * link to the full feed management. Rendered near the top of the episode and
 * article catalog pages so the public URL is visible without scrolling.
 */
export function PublicFeedStrip({
    kind,
    publicFeedUrl,
}: {
    kind: PublicFeedKind
    publicFeedUrl: string
}): React.JSX.Element {
    const copy = KIND_COPY[kind]
    const label =
        kind === 'podcast' ? 'Öffentlicher Podcast-Feed' : 'Öffentlicher Beitrags-Feed'
    return (
        <section
            aria-label="Feed abonnieren"
            className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border bg-card px-4 py-3 text-sm shadow-sm"
        >
            <span className="font-medium">{copy.publicTitle}</span>
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
                Alle Feeds
            </Link>
        </section>
    )
}

/**
 * Shared bottom "Feeds" section for the episode and article catalog pages:
 * public feed URL, private feed URL (or login hint) and management link.
 */
export default function PublicFeedFooter({
    kind,
    publicFeedUrl,
    privateFeedUrl,
    isAuthenticated,
}: {
    kind: PublicFeedKind
    publicFeedUrl: string | null
    privateFeedUrl?: string | null
    isAuthenticated: boolean
}): React.JSX.Element | null {
    if (publicFeedUrl === null) {
        return null
    }
    const copy = KIND_COPY[kind]
    const description =
        kind === 'podcast'
            ? 'Alle freien Folgen in einer Podcast-App abonnieren.'
            : 'Alle freien Beiträge in einem Feed-Reader abonnieren.'
    const privateDescription =
        kind === 'podcast'
            ? 'Enthält Folgen, die deine Mitgliedschaft freischaltet.'
            : 'Enthält Beiträge, die deine Mitgliedschaft freischaltet.'
    return (
        <section className="flex flex-col gap-4">
            <SectionHeader description={description} title="Feeds" />
            <FeedUrlDisplay title={copy.publicTitle} url={publicFeedUrl} />
            {isAuthenticated ? (
                privateFeedUrl != null && privateFeedUrl.length > 0 ? (
                    <FeedUrlDisplay
                        description={privateDescription}
                        title={copy.privateTitle}
                        url={privateFeedUrl}
                    />
                ) : null
            ) : (
                <p className="text-sm text-muted-foreground">
                    <Link className="underline" href="/login">
                        Anmelden
                    </Link>
                    , um deinen privaten Feed mit freigeschalteten {copy.feedNoun}{' '}
                    zu sehen.
                </p>
            )}
            <Link
                className="text-sm font-medium underline-offset-4 hover:underline"
                href="/feeds"
            >
                {copy.manageLabel}
            </Link>
        </section>
    )
}
