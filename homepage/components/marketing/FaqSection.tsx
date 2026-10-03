import SectionLabel from '@/components/marketing/SectionLabel'
import type {Dictionary} from '@/lib/i18n/get-dictionary'

export default function FaqSection({
    copy,
}: {
    copy: Dictionary['faq']
}): React.JSX.Element {
    return (
        <section className="marketing-section" id="faq">
            <div className="marketing-container max-w-3xl">
                <SectionLabel>{copy.sectionLabel}</SectionLabel>
                <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
                    {copy.title}
                </h2>
                <div className="mt-8 grid gap-3">
                    {copy.items.map((faq) => (
                        <details className="glass-panel group rounded-2xl px-6 py-4" key={faq.question}>
                            <summary className="cursor-pointer list-none font-medium [&::-webkit-details-marker]:hidden">
                                <span className="flex items-center justify-between gap-4">
                                    {faq.question}
                                    <span aria-hidden="true" className="text-muted-foreground transition-transform group-open:rotate-45">+</span>
                                </span>
                            </summary>
                            <p className="mt-3 text-sm leading-6 text-muted-foreground">
                                {faq.answer}
                            </p>
                        </details>
                    ))}
                </div>
            </div>
        </section>
    )
}
