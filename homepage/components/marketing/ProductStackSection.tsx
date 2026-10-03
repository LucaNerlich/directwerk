import StatCard from '@directwerk/ui/components/stat-card'

import SectionLabel from '@/components/marketing/SectionLabel'

const PRODUCTS = [
    {
        name: 'Studio',
        role: 'Zum Veröffentlichen',
        copy: 'Folgen, Artikel, Dateien, Abos und Team — alles, was du für deine Show brauchst.',
    },
    {
        name: 'Website',
        role: 'Für deine Hörer',
        copy: 'Deine Show im Netz: Infos, Preise, Login und persönliche Feeds — unter deiner Domain.',
    },
    {
        name: 'Abos & Zugänge',
        role: 'Zum Verdienen',
        copy: 'Mitgliedschaften und bezahlte Inhalte steuern — wer zahlt, bekommt Zugang. Ohne Extra-Tool.',
    },
    {
        name: 'Für Agenturen',
        role: 'Optional erweiterbar',
        copy: 'Wer eigene Apps oder Websites bauen will, kann das — die meisten Creators starten einfach mit Studio und Website.',
    },
] as const

export default function ProductStackSection(): React.JSX.Element {
    return (
        <section className="marketing-section" id="products">
            <div className="marketing-container">
                <SectionLabel>Was du bekommst</SectionLabel>
                <h2 className="mt-4 max-w-2xl text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
                    Studio, Website, Abos — unter deiner Marke
                </h2>
                <p className="mt-4 max-w-2xl text-muted-foreground">
                    Du veröffentlichst im Studio, deine Hörer nutzen deine Website.
                    Alles läuft unter deinem Namen — gehostet in Europa.
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
