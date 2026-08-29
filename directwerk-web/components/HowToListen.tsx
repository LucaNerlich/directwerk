import Link from 'next/link'

import FeedUrlDisplay from '@/components/FeedUrlDisplay'

export default function HowToListen({
    publicFeedUrl,
    privateFeedUrl,
    isAuthenticated,
}: {
    publicFeedUrl: string | null
    privateFeedUrl?: string | null
    isAuthenticated: boolean
}): React.JSX.Element {
    return (
        <section className="space-y-4 rounded-xl border bg-card p-5 shadow-sm">
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
            {publicFeedUrl !== null ? (
                <FeedUrlDisplay
                    description="Enthält nur freie Folgen."
                    title="Öffentlicher Feed"
                    url={publicFeedUrl}
                />
            ) : null}
            {isAuthenticated && privateFeedUrl != null && privateFeedUrl.length > 0 ? (
                <FeedUrlDisplay
                    description="Enthält Folgen, die dein Abo freischaltet."
                    title="Dein privater Feed"
                    url={privateFeedUrl}
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
        </section>
    )
}
