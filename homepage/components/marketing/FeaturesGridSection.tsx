import SectionLabel from '@/components/marketing/SectionLabel'

const FEATURES = [
    {
        title: 'Eigene Marke & Domain',
        copy: 'Dein Logo, deine Farben, deine Domain — auch wenn mehrere Shows auf derselben Plattform laufen.',
    },
    {
        title: 'Podcast, Artikel & Newsletter',
        copy: 'Serien, Episoden, Formate und Kategorien — plus Editor für Artikel, Newsletter und Bonusdateien.',
    },
    {
        title: 'Öffentliche & private RSS',
        copy: 'podcast.xml für freie Inhalte; persönliche Abonnenten-Feeds, die nur bezahlte Episoden enthalten.',
    },
    {
        title: 'Feed-Builder pro Hörer',
        copy: 'Bis zu fünf private Feeds pro Abonnent — nach Formaten oder Kategorien gefiltert, jederzeit widerrufbar.',
    },
    {
        title: 'Abostufen & Pakete',
        copy: 'Stufen und Pakete für Formate, Serien, Kategorien und Downloads — flexibel kombinierbar.',
    },
    {
        title: 'Stripe Connect',
        copy: 'Checkout, Kundenportal und Zahlungsabwicklung — direkt in der Plattform integriert.',
    },
    {
        title: 'EU-Speicher & DSGVO',
        copy: 'Audio und Medien in europäischem Speicher (Hetzner/Bunny), AV-Vertrag inklusive.',
    },
    {
        title: 'Funktionen nach Bedarf',
        copy: 'Podcast, Abos, RSS, Feed-Builder und mehr — pro Show einzeln aktivierbar.',
    },
] as const

export default function FeaturesGridSection(): React.JSX.Element {
    return (
        <section className="marketing-section border-t border-foreground/10" id="funktionen">
            <div className="marketing-container">
                <SectionLabel>Funktionen</SectionLabel>
                <h2 className="mt-4 max-w-2xl text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
                    Was heute schon drin ist
                </h2>
                <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {FEATURES.map((feature) => (
                        <li
                            className="glass-panel rounded-2xl p-5"
                            key={feature.title}
                        >
                            <h3 className="font-semibold">{feature.title}</h3>
                            <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                {feature.copy}
                            </p>
                        </li>
                    ))}
                </ul>
            </div>
        </section>
    )
}
