import SectionLabel from '@/components/marketing/SectionLabel'

const FAQS = [
    {
        question: 'Wo liegen meine Daten?',
        answer: 'In Europa: Server und Datenbanken bei Hetzner in Deutschland, Audio- und Mediendateien bei europäischen Anbietern. Kein Zwang zur US-Cloud — und ein Auftragsverarbeitungsvertrag dazu.',
    },
    {
        question: 'Kann ich von Patreon, Steady oder Spotify weg migrieren?',
        answer: 'Ja. Abonnenten und Angebote lassen sich übernehmen, öffentliche Podcast-Feeds bleiben kompatibel — deine Hörer in Apple Podcasts & Co. merken vom Umzug oft nichts. Sprich uns für Early Access und Hilfe beim Umzug an.',
    },
    {
        question: 'Brauche ich eine eigene Domain?',
        answer: 'Empfohlen, aber nicht Pflicht zum Start. Deine Marke steht vorne: Domain, Logo, Farben. Directwerk läuft im Hintergrund — Studio, Website und Feeds tragen deinen Namen.',
    },
    {
        question: 'Was kostet das?',
        answer: 'Wir sind im Early Access und sprechen mit Creators und Agenturen individuell über Modelle. Schreib uns einfach — du bekommst schnell eine ehrliche Antwort.',
    },
    {
        question: 'Ich bin Entwicklerin — kann ich ein eigenes Frontend bauen?',
        answer: 'Ja. Die REST-API unter /api/v1/ ist der offizielle Weg — Studio und Web sind Beispiel-Oberflächen. Als Agentur baust du eigene Apps gegen dieselben Endpunkte, dokumentiert in OpenAPI.',
    },
] as const

export default function FaqSection(): React.JSX.Element {
    return (
        <section className="marketing-section" id="faq">
            <div className="marketing-container max-w-3xl">
                <SectionLabel>Häufige Fragen</SectionLabel>
                <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
                    Kurz beantwortet
                </h2>
                <div className="mt-8 grid gap-3">
                    {FAQS.map((faq) => (
                        <details className="glass-panel group rounded-2xl px-6 py-4" key={faq.question}>
                            <summary className="cursor-pointer list-none font-medium [&::-webkit-details-marker]:hidden">
                                <span className="flex items-center justify-between gap-4">
                                    {faq.question}
                                    <span aria-hidden="true" className="text-muted-foreground transition-transform group-open:rotate-45">+</span>
                                </span>
                            </summary>
                            <p className="mt-3 text-sm leading-6 text-muted-foreground">
                                {faq.answer}
                            </p>
                        </details>
                    ))}
                </div>
            </div>
        </section>
    )
}
