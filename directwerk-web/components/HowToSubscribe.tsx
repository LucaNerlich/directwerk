import Link from 'next/link'

import FeedUrlDisplay from '@/components/FeedUrlDisplay'

export interface SubscribeFeedPair {
    publicFeedUrl: string | null
    privateFeedUrl?: string | null
}

interface HowToSubscribeProps {
    /** Render the podcast block, the articles block, or both. */
    podcast?: SubscribeFeedPair | null
    articles?: SubscribeFeedPair | null
    isAuthenticated: boolean
}

function PodcastBlock({
    pair,
    isAuthenticated,
}: {
    pair: SubscribeFeedPair
    isAuthenticated: boolean
}): React.JSX.Element {
    return (
        <div className="space-y-4">
            <div className="space-y-1">
                <h2 className="text-lg font-semibold">So hörst du in der Podcast-App</h2>
                <p className="text-sm text-muted-foreground">
                    Kopiere die Feed-URL und füge sie in Apple Podcasts, Overcast, Pocket
                    Casts oder einer anderen App hinzu.
                </p>
            </div>
            <ol className="list-decimal space-y-2 pl-5 text-sm leading-6 text-muted-foreground">
                <li>Kopiere die Feed-URL (öffentlich oder privat).</li>
                <li>
                    Wähle in der Podcast-App „Feed per URL hinzufügen“ oder
                    „Abonnement per URL“.
                </li>
                <li>
                    Öffentliche Feeds enthalten nur <strong>freie</strong> Folgen.
                    Bezahlte Folgen erreichst du über deinen privaten Feed nach der
                    Anmeldung.
                </li>
            </ol>
            {pair.publicFeedUrl !== null ? (
                <FeedUrlDisplay
                    description="Enthält nur freie Folgen."
                    title="Öffentlicher Feed"
                    url={pair.publicFeedUrl}
                />
            ) : null}
            {isAuthenticated &&
            pair.privateFeedUrl != null &&
            pair.privateFeedUrl.length > 0 ? (
                <FeedUrlDisplay
                    description="Enthält Folgen, die deine Mitgliedschaft freischaltet."
                    title="Dein privater Feed"
                    url={pair.privateFeedUrl}
                />
            ) : null}
            {!isAuthenticated ? (
                <p className="text-sm text-muted-foreground">
                    <Link className="font-medium text-foreground underline-offset-4 hover:underline" href="/login">
                        Anmelden
                    </Link>
                    , um den privaten Feed für bezahlte Folgen zu sehen.{' '}
                    <Link className="font-medium text-foreground underline-offset-4 hover:underline" href="/feeds">
                        Alle Feeds verwalten
                    </Link>
                </p>
            ) : (
                <p className="text-sm text-muted-foreground">
                    <Link className="font-medium text-foreground underline-offset-4 hover:underline" href="/feeds">
                        Feeds verwalten
                    </Link>
                    {' · '}
                    <Link className="font-medium text-foreground underline-offset-4 hover:underline" href="/account">
                        Konto
                    </Link>
                </p>
            )}
        </div>
    )
}

function ArticlesBlock({
    pair,
    isAuthenticated,
}: {
    pair: SubscribeFeedPair
    isAuthenticated: boolean
}): React.JSX.Element {
    return (
        <div className="space-y-4">
            <div className="space-y-1">
                <h2 className="text-lg font-semibold">So liest du im Feed-Reader</h2>
                <p className="text-sm text-muted-foreground">
                    Kopiere die Feed-URL und füge sie in deinem bevorzugten
                    Feed-Reader hinzu.
                </p>
            </div>
            <ol className="list-decimal space-y-2 pl-5 text-sm leading-6 text-muted-foreground">
                <li>Kopiere die Feed-URL (öffentlich oder privat).</li>
                <li>Wähle im Feed-Reader „Feed per URL hinzufügen“.</li>
                <li>
                    Öffentliche Feeds enthalten nur <strong>freie</strong> Beiträge.
                    Bezahlte Beiträge erreichst du über deinen privaten Feed.
                </li>
            </ol>
            {pair.publicFeedUrl !== null ? (
                <FeedUrlDisplay
                    description="Enthält nur freie Beiträge."
                    title="Öffentlicher Beitrags-Feed"
                    url={pair.publicFeedUrl}
                />
            ) : null}
            {isAuthenticated &&
            pair.privateFeedUrl != null &&
            pair.privateFeedUrl.length > 0 ? (
                <FeedUrlDisplay
                    description="Enthält Beiträge, die deine Mitgliedschaft freischaltet."
                    title="Dein privater Beitrags-Feed"
                    url={pair.privateFeedUrl}
                />
            ) : null}
            <p className="text-sm text-muted-foreground">
                <Link
                    className="font-medium text-foreground underline-offset-4 hover:underline"
                    href="/feeds"
                >
                    Feeds verwalten
                </Link>
            </p>
        </div>
    )
}

/**
 * Unified subscribe instructions for podcast and article feeds. Renders the
 * podcast block, the articles block, or both in one card; when only one kind
 * is given the output matches the legacy `HowToListen` / `HowToRead` copy.
 */
export default function HowToSubscribe({
    podcast,
    articles,
    isAuthenticated,
}: HowToSubscribeProps): React.JSX.Element | null {
    const showPodcast = podcast !== undefined && podcast !== null
    const showArticles = articles !== undefined && articles !== null
    if (!showPodcast && !showArticles) {
        return null
    }
    return (
        <section className="space-y-6 rounded-xl border bg-card p-5 shadow-sm">
            {showPodcast ? (
                <PodcastBlock pair={podcast} isAuthenticated={isAuthenticated} />
            ) : null}
            {showPodcast && showArticles ? (
                <div aria-hidden="true" className="border-t" />
            ) : null}
            {showArticles ? (
                <ArticlesBlock pair={articles} isAuthenticated={isAuthenticated} />
            ) : null}
        </section>
    )
}
