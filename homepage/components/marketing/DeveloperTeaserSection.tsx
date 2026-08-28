import Link from 'next/link'

import {Button} from '@directwerk/ui/components/button'
import {Card, CardContent} from '@directwerk/ui/components/card'

import SectionLabel from '@/components/marketing/SectionLabel'

export default function DeveloperTeaserSection(): React.JSX.Element {
    return (
        <section className="marketing-section border-t bg-muted/20">
            <div className="marketing-container">
                <Card className="overflow-hidden border-foreground/10">
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
                        <Button render={<Link href="/developers" />} size="lg">
                            API-Auszug ansehen
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </section>
    )
}
