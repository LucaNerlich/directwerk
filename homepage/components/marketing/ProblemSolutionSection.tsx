import SectionLabel from '@/components/marketing/SectionLabel'

const PAIRS = [
    {
        problem: 'Bei Patreon, Steady & Co. gehören Domain, Marke und Hörerdaten oft der Plattform — nicht dir.',
        solution:
            'Directwerk läuft unter deinem Namen: Studio zum Arbeiten, Website für Hörer, eigene Domain. Deine Show, deine Regeln.',
    },
    {
        problem: 'Podcast, Newsletter und Mitgliedschaften stecken in getrennten Tools.',
        solution:
            'Alles an einem Ort: Folgen veröffentlichen, Abos verkaufen, Artikel teilen. Wer zahlt, hört und liest das Passende — ohne Tool-Chaos.',
    },
    {
        problem: 'Mehrere Shows oder Kunden brauchen jeweils eigene Marke und getrennte Daten.',
        solution:
            'Jede Show bekommt eigene Domain, eigenes Branding und eigene Hörer — sauber getrennt, auf einer gemeinsamen Plattform.',
    },
] as const

export default function ProblemSolutionSection(): React.JSX.Element {
    return (
        <section className="marketing-section border-t border-foreground/10" id="features">
            <div className="marketing-container">
                <SectionLabel>Warum Directwerk</SectionLabel>
                <h2 className="mt-4 max-w-3xl text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
                    Für Creators, die unabhängig bleiben wollen
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
