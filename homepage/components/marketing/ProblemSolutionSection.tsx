import SectionLabel from '@/components/marketing/SectionLabel'
import type {Dictionary} from '@/lib/i18n/get-dictionary'

export default function ProblemSolutionSection({
    copy,
}: {
    copy: Dictionary['problemSolution']
}): React.JSX.Element {
    return (
        <section className="marketing-section border-t border-foreground/10" id="features">
            <div className="marketing-container">
                <SectionLabel>{copy.sectionLabel}</SectionLabel>
                <h2 className="mt-4 max-w-3xl text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
                    {copy.title}
                </h2>
                <div className="mt-10 grid gap-6 lg:grid-cols-3">
                    {copy.pairs.map((item, index) => (
                        <article
                            className="glass-panel rounded-2xl p-6"
                            key={item.problem.slice(0, 24)}
                        >
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                {copy.challengeLabel.replace('{n}', String(index + 1))}
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
