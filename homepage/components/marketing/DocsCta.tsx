import {buttonVariants} from '@directwerk/ui/components/button'
import {Card, CardContent} from '@directwerk/ui/components/card'

import type {Dictionary} from '@/lib/i18n/get-dictionary'
import {CONTACT_EMAIL, DOCS_URL} from '@/lib/marketing/constants'

/**
 * Renders a call-to-action card linking to the complete documentation.
 */
export default function DocsCta({
    copy,
}: {
    copy: Dictionary['developers']
}): React.JSX.Element {
    const swaggerUrl = process.env.NEXT_PUBLIC_SWAGGER_URL

    return (
        <Card className="overflow-hidden border-foreground/10">
            <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-lg font-semibold tracking-tight">{copy.docsTitle}</h2>
                    <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                        {copy.docsBody}
                    </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                    <a
                        className={buttonVariants()}
                        href={DOCS_URL}
                        rel="noopener noreferrer"
                        target="_blank"
                    >
                        {copy.docsOpen}
                    </a>
                    {swaggerUrl ? (
                        <a
                            className={buttonVariants({variant: 'outline'})}
                            href={swaggerUrl}
                            rel="noopener noreferrer"
                            target="_blank"
                        >
                            {copy.docsSwagger}
                        </a>
                    ) : null}
                    <a
                        className={buttonVariants({variant: 'outline'})}
                        href={`mailto:${CONTACT_EMAIL}`}
                    >
                        {copy.docsIntegrator}
                    </a>
                </div>
            </CardContent>
        </Card>
    )
}
