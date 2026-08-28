import {Button} from '@directwerk/ui/components/button'
import {Card, CardContent} from '@directwerk/ui/components/card'

import {CONTACT_EMAIL} from '@/lib/marketing/constants'

export default function DocsComingSoon(): React.JSX.Element {
    const swaggerUrl = process.env.NEXT_PUBLIC_SWAGGER_URL

    return (
        <Card className="border-dashed">
            <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-lg font-semibold tracking-tight">
                        Vollständige API-Dokumentation folgt
                    </h2>
                    <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                        Eine dedizierte VitePress-Dokumentation mit Auth-Guides,
                        vollständiger Endpoint-Referenz und OpenAPI-Export ist in
                        Arbeit. Bis dahin: Auszug oben oder frühzeitiger Zugang
                        anfragen.
                    </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
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
                    <Button render={<a href={`mailto:${CONTACT_EMAIL}`} />}>
                        Integrator-Zugang
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}
