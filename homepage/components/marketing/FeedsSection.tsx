import SectionLabel from '@/components/marketing/SectionLabel'
import FeedBuilderMock from '@/components/marketing/FeedBuilderMock'

const FEED_TYPES = [
    {
        title: 'Öffentlich — für alle',
        copy: 'Dein öffentlicher Podcast-Feed für freie Folgen. Läuft bei Apple Podcasts, Spotify und Co. — ohne dich an eine einzige Plattform zu binden.',
    },
    {
        title: 'Privat — pro Abonnent',
        copy: 'Jeder zahlende Hörer bekommt einen eigenen Link: Nur Inhalte, die zum Abo passen. Du kannst Zugänge jederzeit sperren oder den Link erneuern.',
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
                    Öffentliche Feeds bringen neue Hörer. Private Feeds halten
                    Abonnenten — mit genau den Folgen und Artikeln, die zum Abo
                    gehören. Hörer können Formate wählen; bezahlte Inhalte
                    erscheinen nur mit gültigem Zugang.
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
                    </div>
                    <FeedBuilderMock />
                </div>
            </div>
        </section>
    )
}
