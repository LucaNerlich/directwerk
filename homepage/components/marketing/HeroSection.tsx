import {buttonVariants} from '@directwerk/ui/components/button'

import SectionLabel from '@/components/marketing/SectionLabel'
import {DOCS_URL} from '@/lib/marketing/constants'

const WAVEFORM = [38, 62, 45, 78, 55, 90, 64, 42, 70, 52, 84, 60, 74, 48, 66, 80, 58, 72, 44, 68, 56, 76, 50, 62]

const TRUST_ITEMS = [
    ['EU-Hosting', 'Server und Storage in Europa'],
    ['DSGVO-konform', 'AV-Vertrag inklusive'],
    ['0 Werbe-Tracker', 'Do-Not-Track wird respektiert'],
    ['RSS-first', 'Überall abspielbar'],
] as const

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
                <div className="flex flex-wrap gap-2">
                    {['Privater Feed', 'Feed-Builder', 'Kapitelmarken'].map((chip) => (
                        <span
                            className="glass-chip rounded-full px-3 py-1 text-xs font-medium"
                            key={chip}
                        >
                            {chip}
                        </span>
                    ))}
                </div>
                <div className="rounded-xl border border-foreground/10 bg-background/60 p-4 font-mono text-xs leading-5 text-muted-foreground">
                    <p className="font-semibold text-foreground">Für Abonnenten — automatisch persönlich</p>
                    <p className="mt-1 break-all">/feeds/morgenlicht/u/persönlicher-token.xml</p>
                    <p className="mt-1">Nur freigeschaltete Formate · jederzeit widerrufbar</p>
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
                    <p className="glass-chip inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold">
                        <span aria-hidden="true">🇪🇺</span> Gehostet in Europa · DSGVO-konform
                    </p>
                    <h1 className="mt-6 max-w-4xl text-balance text-5xl font-semibold leading-[0.96] tracking-[-0.055em] sm:text-6xl lg:text-7xl">
                        Deine Inhalte.
                        <br />
                        Deine Hörer.
                        <br />
                        Deine Daten.
                    </h1>
                    <p className="mt-8 max-w-xl text-pretty text-lg leading-8 text-muted-foreground">
                        Directwerk ist die europäische Whitelabel-Plattform für Podcast,
                        Artikel und Newsletter — mit Creator-Studio, Abonnenten-Portal,
                        privaten Feeds pro Hörer und vollem Datenschutz statt
                        US-Cloud-Zwang.
                    </p>
                    <div className="mt-8 flex flex-wrap gap-3">
                        <a
                            className={buttonVariants({size: 'lg'})}
                            href="#products"
                        >
                            Plattform entdecken
                        </a>
                        <a
                            className={buttonVariants({variant: 'outline', size: 'lg'})}
                            href="#feeds"
                        >
                            Private Feeds ansehen
                        </a>
                        <a
                            className={buttonVariants({variant: 'outline', size: 'lg'})}
                            href={DOCS_URL}
                            rel="noopener noreferrer"
                            target="_blank"
                        >
                            Dokumentation
                        </a>
                        <a
                            className={buttonVariants({variant: 'outline', size: 'lg'})}
                            href="#contact"
                        >
                            Kontakt
                        </a>
                    </div>
                    <dl className="mt-10 grid max-w-xl grid-cols-2 gap-3 sm:grid-cols-4">
                        {TRUST_ITEMS.map(([title, copy]) => (
                            <div className="glass-chip rounded-2xl p-3" key={title}>
                                <dt className="text-sm font-semibold">{title}</dt>
                                <dd className="mt-1 text-xs leading-5 text-muted-foreground">
                                    {copy}
                                </dd>
                            </div>
                        ))}
                    </dl>
                </div>
                <PlayerMock />
            </div>
            <div className="marketing-container mt-4">
                <SectionLabel>Publizieren ohne Plattformzwang</SectionLabel>
            </div>
        </section>
    )
}
