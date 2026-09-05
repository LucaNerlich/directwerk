import Link from 'next/link'

import {buttonVariants} from '@directwerk/ui/components/button'
import {Card, CardContent} from '@directwerk/ui/components/card'

import SectionLabel from '@/components/marketing/SectionLabel'
import {DOCS_URL} from '@/lib/marketing/constants'

export default function DeveloperTeaserSection(): React.JSX.Element {
    return (
        <section className="marketing-section border-t border-foreground/10">
            <div className="marketing-container">
                <Card className="glass-panel overflow-hidden rounded-3xl">
                    <CardContent className="grid gap-8 p-8 lg:grid-cols-[1fr_auto] lg:items-center">
                        <div>
                            <SectionLabel>Für Entwickler</SectionLabel>
                            <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight">
                                Die API ist das Produkt
                            </h2>
                            <p className="mt-4 max-w-xl text-muted-foreground">
                                Agenturen und Integratoren bauen eigene Frontends gegen
                                /api/v1/ — mit vorhersagbaren Fehlercodes, Host-basierter
                                Mandantenauflösung und demselben Vertrag wie Studio und Web.
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2 lg:justify-end">
                            <Link
                                className={buttonVariants({size: 'lg'})}
                                href="/developers"
                            >
                                API-Auszug ansehen
                            </Link>
                            <a
                                className={buttonVariants({variant: 'outline', size: 'lg'})}
                                href={DOCS_URL}
                                rel="noopener noreferrer"
                                target="_blank"
                            >
                                Vollständige Docs
                            </a>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </section>
    )
}
