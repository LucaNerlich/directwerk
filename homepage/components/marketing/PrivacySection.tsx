import SectionLabel from '@/components/marketing/SectionLabel'

const PRIVACY_FEATURES = [
    {
        title: 'Hosting in Europa',
        copy: 'API, Datenbanken und Audio-Storage laufen bei europäischen Anbietern (Hetzner, Bunny) — kein US-Cloud-Zwang für deine Inhalte.',
    },
    {
        title: 'DSGVO & AV-Vertrag',
        copy: 'Auftragsverarbeitung inklusive, Datenschutzerklärung-freundliche Architektur und ein DPA-Prozess für Agenturen.',
    },
    {
        title: 'Keine Werbe-Tracker',
        copy: 'Weder auf deiner Website noch in deinen Feeds: kein Fingerprinting, keine Ad-Pixel. Do-Not-Track wird respektiert.',
    },
    {
        title: 'Analytics in deiner Hand',
        copy: 'Optionales Umami — selbst gehostet oder Plattform-Standard. Download-Events ohne IP-Speicherung, jederzeit abschaltbar.',
    },
    {
        title: 'Strikte Mandantentrennung',
        copy: 'Jeder Mandant sieht nur eigene Daten: Host-basierte Auflösung, Tenant-Filter auf jeder Query, isolierte Storage-Keys.',
    },
    {
        title: 'Export & Löschung',
        copy: 'Deine Inhalte und Abonnenten gehören dir: RSS bleibt portabel, Accounts und Daten lassen sich vollständig löschen.',
    },
] as const

export default function PrivacySection(): React.JSX.Element {
    return (
        <section className="marketing-section" id="datenschutz">
            <div className="marketing-container">
                <SectionLabel>Datenschutz & Souveränität</SectionLabel>
                <h2 className="mt-4 max-w-2xl text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
                    Datenschutz ist das Feature — nicht das Kleingedruckte
                </h2>
                <p className="mt-4 max-w-2xl text-muted-foreground">
                    Während US-Plattformen deine Hörer vermessen, liefert Directwerk
                    Infrastruktur, die von Anfang an auf europäisches Datenschutzrecht
                    ausgelegt ist.
                </p>
                <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {PRIVACY_FEATURES.map((feature) => (
                        <li className="glass-panel rounded-2xl p-6" key={feature.title}>
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
