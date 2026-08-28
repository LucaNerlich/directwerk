import StatCard from '@directwerk/ui/components/stat-card'

import SectionLabel from '@/components/marketing/SectionLabel'

const PRODUCTS = [
    {
        name: 'directwerk-studio',
        role: 'Creator-Dashboard',
        copy: 'Episoden, Artikel, Medien, Produkte und Team — für Redakteure ohne API-Kenntnisse.',
    },
    {
        name: 'directwerk-web',
        role: 'Endkunden-Website',
        copy: 'Referenz-Frontend pro Mandant: Marketing, Pricing, Account, private Feeds.',
    },
    {
        name: 'directwerk-admin',
        role: 'Plattform-Betrieb',
        copy: 'Mandanten, Module, Jobs und Storage — nur für Platform-Admins.',
    },
    {
        name: 'REST API',
        role: 'Der Vertrag',
        copy: 'Jede Funktion ist über HTTP erreichbar. BYO-Frontend oder unsere Referenz-Apps.',
    },
] as const

export default function ProductStackSection(): React.JSX.Element {
    return (
        <section className="marketing-section" id="products">
            <div className="marketing-container">
                <SectionLabel>Produktstack</SectionLabel>
                <h2 className="mt-4 max-w-2xl text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
                    Backend als Produkt — Frontend optional pro Kunde
                </h2>
                <p className="mt-4 max-w-2xl text-muted-foreground">
                    Creators arbeiten in Studio. Zuhörer nutzen die tenant-spezifische Web-App
                    oder ein kundeneigenes UI gegen dieselbe API.
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
