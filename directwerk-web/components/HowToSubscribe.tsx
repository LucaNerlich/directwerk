/**
 * Steps-only subscribe instructions for podcast and/or article feeds.
 * Feed URLs live in the management sections on `/feeds` — this card does not
 * re-embed them.
 */
interface HowToSubscribeProps {
    /** Show podcast-app setup steps. */
    podcast?: boolean
    /** Show feed-reader setup steps. */
    articles?: boolean
}

function PodcastBlock(): React.JSX.Element {
    return (
        <div className="space-y-4">
            <div className="space-y-1">
                <h2 className="text-lg font-semibold">So hörst du in der Podcast-App</h2>
                <p className="text-sm text-muted-foreground">
                    Kopiere die Feed-URL unten und füge sie in Apple Podcasts, Overcast,
                    Pocket Casts oder einer anderen App hinzu.
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
        </div>
    )
}

function ArticlesBlock(): React.JSX.Element {
    return (
        <div className="space-y-4">
            <div className="space-y-1">
                <h2 className="text-lg font-semibold">So liest du im Feed-Reader</h2>
                <p className="text-sm text-muted-foreground">
                    Kopiere die Feed-URL unten und füge sie in deinem bevorzugten
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
        </div>
    )
}

/**
 * Unified subscribe instructions for podcast and article feeds. Renders the
 * podcast block, the articles block, or both in one card — without URLs.
 */
export default function HowToSubscribe({
    podcast = false,
    articles = false,
}: HowToSubscribeProps): React.JSX.Element | null {
    if (!podcast && !articles) {
        return null
    }
    return (
        <section className="space-y-6 rounded-xl border bg-card p-5 shadow-sm">
            {podcast ? <PodcastBlock /> : null}
            {podcast && articles ? <div aria-hidden="true" className="border-t" /> : null}
            {articles ? <ArticlesBlock /> : null}
        </section>
    )
}
