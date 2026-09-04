import SectionLabel from '@/components/marketing/SectionLabel'

const FEATURES = [
    {
        title: 'Multi-Tenant & Whitelabel',
        copy: 'Eigene Domain, Branding und isolierte Mandantendaten — eine Deployment-Instanz für viele Shows.',
    },
    {
        title: 'Podcast, Artikel & Newsletter',
        copy: 'Serien, Episoden, Formate, Kategorien plus Write-Desk für Artikel, Newsletter und Bonusdateien.',
    },
    {
        title: 'Öffentliche & private RSS',
        copy: 'podcast.xml für freie Inhalte; tokenisierte Abonnenten-Feeds mit Entitlement-Filter.',
    },
    {
        title: 'Feed-Builder pro Hörer',
        copy: 'Bis zu fünf private Feeds pro Abonnent — nach Formaten oder Kategorien gefiltert, jederzeit widerrufbar.',
    },
    {
        title: 'LEVEL & PACKAGE',
        copy: 'Stufen-Produkte und Paket-Regeln für Formate, Serien, Kategorien und Downloads.',
    },
    {
        title: 'Stripe Connect',
        copy: 'Checkout, Customer Portal und Webhooks — Billing vollständig über die API.',
    },
    {
        title: 'EU-Speicher & DSGVO',
        copy: 'Europäisches Object Storage (Hetzner/Bunny), tenant-scoped Keys, AV-Vertrag inklusive.',
    },
    {
        title: 'Modul-System',
        copy: 'PODCAST, SUBSCRIPTION, PODCAST_RSS, FEED_BUILDER u. a. — pro Mandant aktivierbar.',
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
