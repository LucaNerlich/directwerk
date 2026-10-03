import {buttonVariants} from '@directwerk/ui/components/button'
import {Card, CardContent} from '@directwerk/ui/components/card'

import SectionLabel from '@/components/marketing/SectionLabel'
import {LIVE_EXAMPLE_NAME, LIVE_EXAMPLE_URL} from '@/lib/marketing/constants'

export default function LiveExampleSection(): React.JSX.Element {
    return (
        <section className="marketing-section border-t border-foreground/10" id="beispiel">
            <div className="marketing-container">
                <Card className="glass-panel overflow-hidden rounded-3xl">
                    <CardContent className="grid gap-8 p-8 lg:grid-cols-[1fr_auto] lg:items-center">
                        <div>
                            <SectionLabel>Live-Beispiel</SectionLabel>
                            <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight">
                                {LIVE_EXAMPLE_NAME} — eine echte Show auf Directwerk
                            </h2>
                            <p className="mt-4 max-w-xl text-muted-foreground">
                                Simons Podcast läuft schon auf Directwerk — unter eigener
                                Subdomain, mit Folgen zum Anhören. Öffne die Website und
                                sieh, wie sich die Show für Hörer anfühlt.
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2 lg:justify-end">
                            <a
                                className={buttonVariants({size: 'lg'})}
                                href={LIVE_EXAMPLE_URL}
                                rel="noopener noreferrer"
                                target="_blank"
                            >
                                {LIVE_EXAMPLE_NAME} öffnen
                            </a>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </section>
    )
}
