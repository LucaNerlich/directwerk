import type {LegalPage} from '@directwerk/legal'

import {cn} from '#lib/utils'

/**
 * Renders one shared legal page (`@directwerk/legal`) with the app's own
 * typography. All five surfaces use this so Impressum/Datenschutz look
 * identical everywhere while the content lives in exactly one place.
 */
export default function LegalArticle({
    page,
    className,
}: {
    page: LegalPage
    className?: string
}): React.JSX.Element {
    return (
        <article className={cn('max-w-3xl space-y-8', className)}>
            <header className="space-y-2">
                <h1 className="text-pretty text-3xl font-semibold tracking-tight sm:text-4xl">
                    {page.title}
                </h1>
                <p className="text-pretty text-sm leading-6 text-muted-foreground sm:text-base">
                    {page.intro}
                </p>
            </header>
            {page.sections.map((section) => (
                <section className="space-y-2" key={section.heading}>
                    <h2 className="text-lg font-semibold">{section.heading}</h2>
                    {section.paragraphs.map((paragraph, index) => (
                        <p
                            className="text-sm leading-6 text-muted-foreground"
                            key={`${section.heading}-${index}`}
                        >
                            {paragraph}
                        </p>
                    ))}
                </section>
            ))}
            <footer className="border-t pt-4 text-xs text-muted-foreground">
                Stand: {page.updated}
            </footer>
        </article>
    )
}
