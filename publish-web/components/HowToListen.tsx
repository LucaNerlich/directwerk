import Link from 'next/link'

/**
 * Explains how to subscribe to public vs private RSS in podcast apps.
 */
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
        <section className="space-y-3 rounded-xl border bg-card p-5">
            <h2 className="text-lg font-semibold">So hörst du in der Podcast-App</h2>
            <ol className="list-decimal space-y-2 pl-5 text-sm leading-6 text-muted-foreground">
                <li>Kopiere die Feed-URL (öffentlich oder privat).</li>
                <li>
                    Öffne Apple Podcasts, Overcast, Pocket Casts oder eine andere App
                    und wähle „Feed per URL hinzufügen“.
                </li>
                <li>
                    Öffentliche Feeds enthalten nur <strong>freie</strong> Folgen.
                    Bezahlte Folgen erreichst du über deinen privaten Feed nach der
                    Anmeldung.
                </li>
            </ol>
            {publicFeedUrl !== null ? (
                <p className="break-all text-sm">
                    Öffentlicher Feed:{' '}
                    <a href={publicFeedUrl} rel="noreferrer">
                        {publicFeedUrl}
                    </a>
                </p>
            ) : null}
            {isAuthenticated && privateFeedUrl != null && privateFeedUrl.length > 0 ? (
                <p className="break-all text-sm">
                    Dein privater Feed:{' '}
                    <a href={privateFeedUrl} rel="noreferrer">
                        {privateFeedUrl}
                    </a>
                </p>
            ) : null}
            {!isAuthenticated ? (
                <p className="text-sm">
                    <Link href="/login">Anmelden</Link>, um den privaten Feed für
                    bezahlte Folgen zu sehen.
                </p>
            ) : null}
        </section>
    )
}
