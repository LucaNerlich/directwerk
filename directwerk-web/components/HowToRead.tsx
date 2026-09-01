import Link from 'next/link'

import FeedUrlDisplay from '@/components/FeedUrlDisplay'

export default function HowToRead({
    publicFeedUrl,
    privateFeedUrl,
}: {
    publicFeedUrl: string | null
    privateFeedUrl?: string | null
}): React.JSX.Element {
    return (
        <section className="space-y-4 rounded-xl border bg-card p-5 shadow-sm">
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
            {publicFeedUrl !== null ? (
                <FeedUrlDisplay
                    description="Enthält nur freie Beiträge."
                    title="Öffentlicher Beitrags-Feed"
                    url={publicFeedUrl}
                />
            ) : null}
            {privateFeedUrl != null && privateFeedUrl.length > 0 ? (
                <FeedUrlDisplay
                    description="Enthält Beiträge, die dein Abo freischaltet."
                    title="Dein privater Beitrags-Feed"
                    url={privateFeedUrl}
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
        </section>
    )
}
