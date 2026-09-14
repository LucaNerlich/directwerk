import SectionLabel from '@/components/marketing/SectionLabel'

const PAIRS = [
    {
        problem: 'Patreon, Steady oder ein geschlossenes CMS bestimmen Domain, Daten und Auslieferung.',
        solution:
            'Directwerk läuft unter deiner Marke: Studio für Creators, Website für Hörer — und für Agenturen eine API zum Anbinden eigener Oberflächen.',
    },
    {
        problem: 'Podcast, Newsletter und Mitgliedschaften leben in getrennten Tools.',
        solution:
            'Alles an einem Ort: Podcast, RSS, Abos, Artikel und Feed-Builder. Wer zahlt, sieht was — für alle Formate gleich.',
    },
    {
        problem: 'Agenturen brauchen Whitelabel, nicht noch ein monolithisches CMS.',
        solution:
            'Jeder Kunde bekommt eigene Domain, eigenes Branding und getrennte Daten — auf einer Plattform, die mehrere Shows sicher nebeneinander betreibt.',
    },
] as const

export default function ProblemSolutionSection(): React.JSX.Element {
    return (
        <section className="marketing-section border-t border-foreground/10" id="features">
            <div className="marketing-container">
                <SectionLabel>Warum Directwerk</SectionLabel>
                <h2 className="mt-4 max-w-3xl text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
                    Eigene Plattform statt Miete bei anderen
                </h2>
                <div className="mt-10 grid gap-6 lg:grid-cols-3">
                    {PAIRS.map((item, index) => (
                        <article
                            className="glass-panel rounded-2xl p-6"
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
