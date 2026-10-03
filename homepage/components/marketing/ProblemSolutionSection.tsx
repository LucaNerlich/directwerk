import SectionLabel from '@/components/marketing/SectionLabel'

const PAIRS = [
    {
        problem: 'Podcast, Website und bezahlte Inhalte selbst aufzusetzen kostet Zeit und Nerven.',
        solution:
            'Studio zum Veröffentlichen, fertige Website für Hörer, Abos und Branding — schon da. Du startest mit deiner Show, nicht mit Setup.',
    },
    {
        problem: 'Podcast, Newsletter und Mitgliedschaften stecken oft in getrennten Tools.',
        solution:
            'Alles an einem Ort: Folgen hochladen, Abos verkaufen, Artikel teilen. Wer zahlt, sieht das Passende — ohne Tool-Hopping.',
    },
    {
        problem: 'Private Feeds und Zugänge für Abonnenten sind schwer zu erklären und zu pflegen.',
        solution:
            'Jeder Abonnent bekommt einen eigenen Feed-Link. Bezahlte Inhalte erscheinen automatisch nur mit gültigem Zugang — du steuerst das im Studio.',
    },
] as const

export default function ProblemSolutionSection(): React.JSX.Element {
    return (
        <section className="marketing-section border-t border-foreground/10" id="features">
            <div className="marketing-container">
                <SectionLabel>Warum Directwerk</SectionLabel>
                <h2 className="mt-4 max-w-3xl text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
                    Gebaut für Creators — ohne Technikstress
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
