import {buttonVariants} from '@directwerk/ui/components/button'

import SectionLabel from '@/components/marketing/SectionLabel'

const WAVEFORM = [38, 62, 45, 78, 55, 90, 64, 42, 70, 52, 84, 60, 74, 48, 66, 80, 58, 72, 44, 68, 56, 76, 50, 62]

function PlayerMock(): React.JSX.Element {
    return (
        <div className="glass-panel relative overflow-hidden rounded-3xl">
            <div className="border-b border-foreground/10 bg-primary p-7 text-primary-foreground">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] opacity-70">
                    Deine Show · Morgenlicht FM
                </p>
                <p className="mt-8 text-3xl font-semibold tracking-tight">
                    #128 — Guten Morgen, Berlin
                </p>
                <p className="mt-2 text-sm text-primary-foreground/75">
                    6 Min · Frei für alle
                </p>
            </div>
            <div className="space-y-5 p-6 sm:p-7">
                <div className="flex items-center gap-4">
                    <span
                        aria-hidden="true"
                        className="grid size-12 shrink-0 place-items-center rounded-full bg-primary text-lg text-primary-foreground"
                    >
                        ▶
                    </span>
                    <div
                        aria-hidden="true"
                        className="flex h-12 flex-1 items-center gap-[3px]"
                    >
                        {WAVEFORM.map((height, index) => (
                            <span
                                className="w-full rounded-full bg-primary/70"
                                key={index}
                                style={{height: `${height}%`, opacity: index < 9 ? 1 : 0.35}}
                            />
                        ))}
                    </div>
                    <span className="shrink-0 font-mono text-xs text-muted-foreground">
                        04:12
                    </span>
                </div>
            </div>
        </div>
    )
}

export default function HeroSection(): React.JSX.Element {
    return (
        <section className="marketing-section relative overflow-hidden">
            <div className="marketing-container grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:py-8">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Gehostet in Europa · DSGVO-konform
                    </p>
                    <h1 className="mt-6 max-w-4xl text-balance text-5xl font-semibold leading-[0.96] tracking-[-0.055em] sm:text-6xl lg:text-7xl">
                        Deine Inhalte.
                        <br />
                        Deine Hörer.
                        <br />
                        Deine Daten.
                    </h1>
                    <p className="mt-8 max-w-xl text-pretty text-lg leading-8 text-muted-foreground">
                        Podcast, Artikel und Newsletter unter deiner Marke — mit Studio,
                        Website für Abonnenten und privaten Feeds pro Hörer.
                    </p>
                    <div className="mt-8 flex flex-wrap gap-3">
                        <a
                            className={buttonVariants({size: 'lg'})}
                            href="#features"
                        >
                            Plattform entdecken
                        </a>
                        <a
                            className={buttonVariants({variant: 'outline', size: 'lg'})}
                            href="#feeds"
                        >
                            Private Feeds
                        </a>
                    </div>
                </div>
                <PlayerMock />
            </div>
            <div className="marketing-container mt-4">
                <SectionLabel>Dein Kanal, deine Regeln</SectionLabel>
            </div>
        </section>
    )
}
