import SectionLabel from '@/components/marketing/SectionLabel'
import FeedBuilderMock from '@/components/marketing/FeedBuilderMock'

const FEED_TYPES = [
    {
        title: 'Öffentlich — für alle',
        copy: 'podcast.xml und Artikel-RSS für freie Inhalte. Überall einreichbar: Apple Podcasts, Spotify, Fyyd — ganz ohne Plattformbindung.',
    },
    {
        title: 'Privat — pro Abonnent',
        copy: 'Tokenisierte URLs mit Entitlement-Filter: Jeder Hörer sieht nur, was sein Abo freischaltet. Deaktivieren und Token rotieren inklusive.',
    },
] as const

export default function FeedsSection(): React.JSX.Element {
    return (
        <section className="marketing-section" id="feeds">
            <div className="marketing-container">
                <SectionLabel>Feeds für alle & für jeden</SectionLabel>
                <h2 className="mt-4 max-w-2xl text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
                    Ein RSS-Feed pro Hörer — automatisch persönlich
                </h2>
                <p className="mt-4 max-w-2xl text-muted-foreground">
                    Öffentliche Feeds gewinnen Reichweite, private Feeds binden
                    Abonnenten. Der Feed-Builder lässt Hörer ihre Lieblingsformate
                    selbst zusammenstellen — der Entitlement-Filter erledigt den Rest.
                </p>
                <div className="mt-10 grid items-start gap-4 lg:grid-cols-2">
                    <div className="grid gap-4">
                        {FEED_TYPES.map((feed) => (
                            <article className="glass-panel rounded-2xl p-6" key={feed.title}>
                                <h3 className="font-semibold">{feed.title}</h3>
                                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                    {feed.copy}
                                </p>
                            </article>
                        ))}
                        <article className="glass-panel rounded-2xl p-6">
                            <h3 className="font-semibold">Artikel & Newsletter inklusive</h3>
                            <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                Dieselbe Feed-Logik fürs Lesen: öffentliche und private
                                Artikel-Feeds, Kategorien statt Formate — ein Abo für Hören und Lesen.
                            </p>
                        </article>
                    </div>
                    <FeedBuilderMock />
                </div>
            </div>
        </section>
    )
}
