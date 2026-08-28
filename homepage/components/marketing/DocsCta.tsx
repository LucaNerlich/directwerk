import {Button} from '@directwerk/ui/components/button'
import {Card, CardContent} from '@directwerk/ui/components/card'

import {CONTACT_EMAIL, DOCS_URL} from '@/lib/marketing/constants'

export default function DocsCta(): React.JSX.Element {
    const swaggerUrl = process.env.NEXT_PUBLIC_SWAGGER_URL

    return (
        <Card className="overflow-hidden border-foreground/10">
            <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-lg font-semibold tracking-tight">
                        Vollständige Dokumentation
                    </h2>
                    <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                        Installationsanleitung, Betrieb, Architektur und OpenAPI-Referenz
                        in der öffentlichen VitePress-Site. Diese Seite bleibt ein kompakter
                        API-Auszug für den schnellen Einstieg.
                    </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                    <Button
                        render={
                            <a
                                href={DOCS_URL}
                                rel="noopener noreferrer"
                                target="_blank"
                            />
                        }
                    >
                        Dokumentation öffnen
                    </Button>
                    {swaggerUrl ? (
                        <Button
                            render={
                                <a
                                    href={swaggerUrl}
                                    rel="noopener noreferrer"
                                    target="_blank"
                                />
                            }
                            variant="outline"
                        >
                            Swagger (Staging)
                        </Button>
                    ) : null}
                    <Button
                        render={<a href={`mailto:${CONTACT_EMAIL}`} />}
                        variant="outline"
                    >
                        Integrator-Zugang
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}
