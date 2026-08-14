import {Button} from '@publish/ui/components/button'
import {Card, CardContent} from '@publish/ui/components/card'

export default function Home() {
    return (
        <div className="min-h-screen overflow-hidden bg-background">
            <header className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8">
                <a className="text-lg font-semibold tracking-tight" href="/">
                    Directwerk
                </a>
                <Button render={<a href="#platform" />} variant="outline">
                    Plattform ansehen
                </Button>
            </header>
            <main>
                <section className="relative mx-auto grid min-h-[calc(100vh-5rem)] max-w-7xl items-center gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[1.15fr_0.85fr] lg:py-24">
                    <div
                        aria-hidden="true"
                        className="absolute -right-48 top-0 -z-10 size-[38rem] rounded-full bg-accent/70 blur-3xl"
                    />
                    <div>
                        <p className="mb-6 text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                            Publizieren ohne Plattformzwang
                        </p>
                        <h1 className="max-w-4xl text-balance text-5xl font-semibold leading-[0.96] tracking-[-0.055em] sm:text-7xl lg:text-[5.5rem]">
                            Deine Inhalte.
                            <br />
                            Deine Marke.
                            <br />
                            Deine Regeln.
                        </h1>
                        <p className="mt-8 max-w-xl text-pretty text-lg leading-8 text-muted-foreground">
                            Directwerk verbindet Redaktion, Podcast, Abonnements und
                            Auslieferung in einer unabhängigen Publishing-Plattform.
                        </p>
                        <div className="mt-8 flex flex-wrap gap-3">
                            <Button render={<a href="#platform" />} size="lg">
                                Directwerk entdecken
                            </Button>
                            <Button
                                render={<a href="mailto:hello@directwerk.de" />}
                                size="lg"
                                variant="outline"
                            >
                                Kontakt
                            </Button>
                        </div>
                    </div>
                    <Card
                        className="relative overflow-hidden border-foreground/10 bg-card/85 shadow-2xl shadow-foreground/10 backdrop-blur"
                        id="platform"
                    >
                        <CardContent className="p-0">
                            <div className="border-b bg-primary p-7 text-primary-foreground">
                                <p className="text-xs font-semibold uppercase tracking-[0.2em] opacity-70">
                                    Ein Werkraum
                                </p>
                                <p className="mt-12 text-3xl font-semibold tracking-tight">
                                    Vom Entwurf bis zum Feed.
                                </p>
                            </div>
                            <div className="grid divide-y sm:grid-cols-2 sm:divide-x sm:divide-y-0">
                                {[
                                    ['Studio', 'Schreiben, aufnehmen und veröffentlichen.'],
                                    ['Web', 'Eine schnelle Website in deiner Marke.'],
                                    ['Feeds', 'Offene und private Podcast-Auslieferung.'],
                                    ['Zugang', 'Produkte, Stufen und Abonnements.'],
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
                </section>
            </main>
        </div>
    )
}
