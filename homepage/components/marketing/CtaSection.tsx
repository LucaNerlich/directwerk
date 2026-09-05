import {buttonVariants} from '@directwerk/ui/components/button'

import {CONTACT_EMAIL, DOCS_URL} from '@/lib/marketing/constants'

export default function CtaSection(): React.JSX.Element {
    return (
        <section className="marketing-section">
            <div className="marketing-container">
                <div className="rounded-2xl border bg-primary px-8 py-12 text-primary-foreground sm:px-12">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary-foreground/70">
                        Bereit für den nächsten Schritt?
                    </p>
                    <h2 className="mt-4 max-w-xl text-balance text-3xl font-semibold tracking-tight">
                        Eigene Publishing-Infrastruktur — nicht nur ein weiteres CMS
                    </h2>
                    <p className="mt-4 max-w-lg text-primary-foreground/80">
                        Wir sprechen mit Creators, Agenturen und Integratoren über Early
                        Access, Migration von Patreon/Steady und Custom-Frontends.
                    </p>
                    <div className="mt-8 flex flex-wrap gap-3">
                        <a
                            className={buttonVariants({
                                size: 'lg',
                                className:
                                    'bg-primary-foreground text-primary hover:bg-primary-foreground/90',
                            })}
                            href={`mailto:${CONTACT_EMAIL}`}
                        >
                            {CONTACT_EMAIL}
                        </a>
                        <a
                            className={buttonVariants({
                                variant: 'outline',
                                size: 'lg',
                                className:
                                    'border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10',
                            })}
                            href="/developers"
                        >
                            API-Auszug
                        </a>
                        <a
                            className={buttonVariants({
                                variant: 'outline',
                                size: 'lg',
                                className:
                                    'border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10',
                            })}
                            href={DOCS_URL}
                            rel="noopener noreferrer"
                            target="_blank"
                        >
                            Dokumentation
                        </a>
                    </div>
                </div>
            </div>
        </section>
    )
}
