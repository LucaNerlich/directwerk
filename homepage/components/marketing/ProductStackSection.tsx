import StatCard from '@directwerk/ui/components/stat-card'

import SectionLabel from '@/components/marketing/SectionLabel'

const PRODUCTS = [
    {
        name: 'directwerk-studio',
        role: 'Creator-Dashboard',
        copy: 'Episoden, Artikel, Medien, Abos und Team — alles, was du zum Veröffentlichen brauchst.',
    },
    {
        name: 'directwerk-web',
        role: 'Website für Hörer',
        copy: 'Deine Show im Web: Infos, Preise, Account und private Feeds — unter deiner Domain.',
    },
    {
        name: 'directwerk-admin',
        role: 'Plattform-Betrieb',
        copy: 'Shows, Funktionen und Speicher verwalten — nur für Directwerk-Betreiber.',
    },
    {
        name: 'REST API',
        role: 'Für eigene Oberflächen',
        copy: 'Agenturen und Entwickler bauen eigene Apps gegen dieselben Endpunkte — oder nutzen Studio und Web.',
    },
] as const

export default function ProductStackSection(): React.JSX.Element {
    return (
        <section className="marketing-section" id="products">
            <div className="marketing-container">
                <SectionLabel>Was du bekommst</SectionLabel>
                <h2 className="mt-4 max-w-2xl text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
                    Alles aus einer Hand — oder nur das, was du brauchst
                </h2>
                <p className="mt-4 max-w-2xl text-muted-foreground">
                    Creators arbeiten im Studio. Hörer nutzen deine Website — oder eine
                    eigene Oberfläche, die an dieselbe Schnittstelle angebunden ist.
                </p>
                <div className="mt-10 grid gap-4 sm:grid-cols-2">
                    {PRODUCTS.map((product) => (
                        <StatCard
                            hint={product.copy}
                            key={product.name}
                            label={product.role}
                            value={product.name}
                        />
                    ))}
                </div>
            </div>
        </section>
    )
}
