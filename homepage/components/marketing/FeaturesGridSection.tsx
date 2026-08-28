import SectionLabel from '@/components/marketing/SectionLabel'

const FEATURES = [
    {
        title: 'Multi-Tenant & Whitelabel',
        copy: 'Eigene Domain, Branding und isolierte Mandantendaten — eine Deployment-Instanz für viele Shows.',
    },
    {
        title: 'Podcast & Artikel',
        copy: 'Serien, Episoden, Formate, Kategorien plus Write-Desk für Artikel und Bonusdateien.',
    },
    {
        title: 'Öffentliche & private RSS',
        copy: 'podcast.xml für FREE-Inhalte; tokenisierte Abonnenten-Feeds mit Entitlement-Filter.',
    },
    {
        title: 'Feed-Builder',
        copy: 'Bis zu fünf private Feeds pro Abonnent — gefiltert nach Formaten (Formate).',
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
        title: 'EU-Speicher',
        copy: 'S3-kompatibles Object Storage (Hetzner/Bunny) mit tenant-scoped Keys.',
    },
    {
        title: 'Modul-System',
        copy: 'PODCAST, SUBSCRIPTION, PODCAST_RSS, FEED_BUILDER u. a. — pro Mandant aktivierbar.',
    },
] as const

export default function FeaturesGridSection(): React.JSX.Element {
    return (
        <section className="marketing-section border-t bg-muted/20">
            <div className="marketing-container">
                <SectionLabel>Funktionen</SectionLabel>
                <h2 className="mt-4 max-w-2xl text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
                    Was heute schon drin ist
                </h2>
                <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {FEATURES.map((feature) => (
                        <li
                            className="rounded-xl border bg-card p-5"
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
