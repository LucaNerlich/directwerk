import SectionLabel from '@/components/marketing/SectionLabel'
import FeedBuilderMock from '@/components/marketing/FeedBuilderMock'

const FEED_TYPES = [
    {
        title: 'Öffentlich — für alle',
        copy: 'Dein podcast.xml und Artikel-RSS für freie Inhalte. Einreichbar bei Apple Podcasts, Spotify, Fyyd — ohne an eine Plattform gebunden zu sein.',
    },
    {
        title: 'Privat — pro Abonnent',
        copy: 'Eigene Feed-URL pro Hörer: Jeder sieht nur, was sein Abo abdeckt. Du kannst Zugänge jederzeit sperren oder den Link erneuern.',
    },
] as const

export default function FeedsSection(): React.JSX.Element {
    return (
        <section className="marketing-section" id="feeds">
            <div className="marketing-container">
                <SectionLabel>Feeds für alle & für jeden</SectionLabel>
                <h2 className="mt-4 max-w-2xl text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
                    Jeder Hörer bekommt seinen eigenen Feed
                </h2>
                <p className="mt-4 max-w-2xl text-muted-foreground">
                    Öffentliche Feeds bringen neue Hörer, private Feeds halten
                    Abonnenten. Im Feed-Builder wählen Hörer ihre Lieblingsformate —
                    bezahlte Inhalte erscheinen nur, wenn das Abo passt.
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
