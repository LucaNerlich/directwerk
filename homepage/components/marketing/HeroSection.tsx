import {Button} from '@directwerk/ui/components/button'
import {Card, CardContent} from '@directwerk/ui/components/card'

import SectionLabel from '@/components/marketing/SectionLabel'
import {CONTACT_EMAIL, DOCS_URL} from '@/lib/marketing/constants'

export default function HeroSection(): React.JSX.Element {
    return (
        <section className="marketing-section relative overflow-hidden">
            <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-48 top-0 -z-10 size-[38rem] rounded-full bg-accent/70 blur-3xl"
            />
            <div className="marketing-container grid items-center gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:py-8">
                <div>
                    <SectionLabel>Publizieren ohne Plattformzwang</SectionLabel>
                    <h1 className="mt-6 max-w-4xl text-balance text-5xl font-semibold leading-[0.96] tracking-[-0.055em] sm:text-6xl lg:text-7xl">
                        Deine Inhalte.
                        <br />
                        Deine Marke.
                        <br />
                        Deine Regeln.
                    </h1>
                    <p className="mt-8 max-w-xl text-pretty text-lg leading-8 text-muted-foreground">
                        Directwerk ist die API-first Whitelabel-Plattform für Podcast,
                        Abonnements und digitales Publishing — mit Creator-Studio,
                        Endkunden-Website und voller Kontrolle über Domain und Daten.
                    </p>
                    <div className="mt-8 flex flex-wrap gap-3">
                        <Button render={<a href="#products" />} size="lg">
                            Plattform entdecken
                        </Button>
                        <Button
                            render={
                                <a
                                    href={DOCS_URL}
                                    rel="noopener noreferrer"
                                    target="_blank"
                                />
                            }
                            size="lg"
                            variant="outline"
                        >
                            Dokumentation
                        </Button>
                        <Button
                            render={<a href={`mailto:${CONTACT_EMAIL}`} />}
                            size="lg"
                            variant="outline"
                        >
                            Kontakt
                        </Button>
                    </div>
                </div>
                <Card
                    className="relative overflow-hidden border-foreground/10 bg-card/85 shadow-2xl shadow-foreground/10 backdrop-blur"
                >
                    <CardContent className="p-0">
                        <div className="border-b bg-primary p-7 text-primary-foreground">
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] opacity-70">
                                Ein Werkraum
                            </p>
                            <p className="mt-10 text-3xl font-semibold tracking-tight">
                                Vom Entwurf bis zum Feed.
                            </p>
                        </div>
                        <div className="grid divide-y sm:grid-cols-2 sm:divide-x sm:divide-y-0">
                            {[
                                ['Studio', 'Schreiben, aufnehmen und veröffentlichen.'],
                                ['Web', 'Öffentliche Site und Abonnenten-Portal.'],
                                ['Feeds', 'Öffentliche und private Podcast-Auslieferung.'],
                                ['Zugang', 'Produkte, Stufen und Stripe-Checkout.'],
                            ].map(([title, copy]) => (
                                <article className="p-6" key={title}>
                                    <h2 className="font-semibold">{title}</h2>
                                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                                        {copy}
                                    </p>
                                </article>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </section>
    )
}
