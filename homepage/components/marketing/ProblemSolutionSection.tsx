import SectionLabel from '@/components/marketing/SectionLabel'

const PAIRS = [
    {
        problem: 'Patreon, Steady oder ein geschlossenes CMS bestimmen Domain, Daten und Auslieferung.',
        solution:
            'Directwerk liefert Infrastruktur auf deiner Marke: Studio für Creators, API für Integratoren, Web optional pro Mandant.',
    },
    {
        problem: 'Podcast, Newsletter und Mitgliedschaften leben in getrennten Tools.',
        solution:
            'Ein Backend mit Modulen für Podcast, RSS, Abonnements, Artikel und Feed-Builder — eine Entitlement-Schicht für alles.',
    },
    {
        problem: 'Agenturen brauchen Whitelabel, nicht noch ein monolithisches CMS.',
        solution:
            'Multi-Tenant-Isolation, Host-basierte Mandantenauflösung und ein stabiler REST-Vertrag unter /api/v1/.',
    },
] as const

export default function ProblemSolutionSection(): React.JSX.Element {
    return (
        <section className="marketing-section border-t bg-muted/20" id="features">
            <div className="marketing-container">
                <SectionLabel>Warum Directwerk</SectionLabel>
                <h2 className="mt-4 max-w-3xl text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
                    Infrastruktur statt Plattformmiete
                </h2>
                <div className="mt-10 grid gap-6 lg:grid-cols-3">
                    {PAIRS.map((item, index) => (
                        <article
                            className="rounded-xl border bg-card p-6"
                            key={item.problem.slice(0, 24)}
                        >
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Herausforderung {index + 1}
                            </p>
                            <p className="mt-3 text-sm leading-6">{item.problem}</p>
                            <p className="mt-4 text-sm font-medium leading-6">
                                {item.solution}
                            </p>
                        </article>
                    ))}
                </div>
            </div>
        </section>
    )
}
