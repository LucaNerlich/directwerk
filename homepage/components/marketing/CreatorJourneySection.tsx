import StatCard from '@directwerk/ui/components/stat-card'

import SectionLabel from '@/components/marketing/SectionLabel'

const STEPS = [
    {
        step: '01',
        title: 'Einrichten',
        copy: 'Show anlegen, Domain verbinden, Branding festlegen und Funktionen aktivieren.',
    },
    {
        step: '02',
        title: 'Veröffentlichen',
        copy: 'Audio und Medien hochladen, Episoden oder Artikel im Studio veröffentlichen.',
    },
    {
        step: '03',
        title: 'Verdienen',
        copy: 'Abostufen und Pakete anlegen, Stripe verbinden, Abonnenten verwalten.',
    },
    {
        step: '04',
        title: 'Ausliefern',
        copy: 'Öffentliche Feeds, private Abonnenten-URLs und optional Feed-Builder für Formate.',
    },
] as const

export default function CreatorJourneySection(): React.JSX.Element {
    return (
        <section className="marketing-section">
            <div className="marketing-container">
                <SectionLabel>So startest du</SectionLabel>
                <h2 className="mt-4 max-w-2xl text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
                    Vom ersten Setup bis zum privaten Feed
                </h2>
                <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {STEPS.map((item) => (
                        <li key={item.step}>
                            <StatCard
                                hint={item.copy}
                                label={item.step}
                                value={item.title}
                            />
                        </li>
                    ))}
                </ol>
            </div>
        </section>
    )
}
