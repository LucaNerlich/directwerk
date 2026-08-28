import {Button} from '@directwerk/ui/components/button'

import {CONTACT_EMAIL} from '@/lib/marketing/constants'

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
                        <Button
                            className="bg-primary-foreground text-primary hover:bg-primary-foreground/90"
                            render={<a href={`mailto:${CONTACT_EMAIL}`} />}
                            size="lg"
                        >
                            {CONTACT_EMAIL}
                        </Button>
                        <Button
                            className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10"
                            render={<a href="/developers" />}
                            size="lg"
                            variant="outline"
                        >
                            API-Auszug
                        </Button>
                    </div>
                </div>
            </div>
        </section>
    )
}
