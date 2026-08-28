import SectionLabel from '@/components/marketing/SectionLabel'

const STEPS = [
    {
        step: '01',
        title: 'Einrichten',
        copy: 'Mandant anlegen, Domain verbinden, Branding und Module aktivieren.',
    },
    {
        step: '02',
        title: 'Veröffentlichen',
        copy: 'Audio und Medien hochladen, Episoden oder Artikel im Studio veröffentlichen.',
    },
    {
        step: '03',
        title: 'Monetarisieren',
        copy: 'LEVEL- und PACKAGE-Produkte definieren, Stripe verbinden, Abonnenten verwalten.',
    },
    {
        step: '04',
        title: 'Ausliefern',
        copy: 'Öffentliche Feeds, private Abonnenten-URLs und optional Feed-Builder für Formate.',
    },
] as const

export default function CreatorJourneySection(): React.JSX.Element {
    return (
        <section className="marketing-section">
            <div className="marketing-container">
                <SectionLabel>Creator-Journey</SectionLabel>
                <h2 className="mt-4 max-w-2xl text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
                    Vom Setup bis zum privaten Feed
                </h2>
                <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {STEPS.map((item) => (
                        <li
                            className="relative rounded-xl border bg-card p-6"
                            key={item.step}
                        >
                            <span className="font-mono text-xs font-semibold text-muted-foreground">
                                {item.step}
                            </span>
                            <h3 className="mt-3 font-semibold">{item.title}</h3>
                            <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                {item.copy}
                            </p>
                        </li>
                    ))}
                </ol>
            </div>
        </section>
    )
}
