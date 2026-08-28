import type {Metadata} from 'next'

import ApiHighlightTable from '@/components/marketing/ApiHighlightTable'
import CodeBlock from '@/components/marketing/CodeBlock'
import DocsComingSoon from '@/components/marketing/DocsComingSoon'
import OptionalOAuthSnippet from '@/components/marketing/OptionalOAuthSnippet'
import SectionLabel from '@/components/marketing/SectionLabel'
import {
    API_HIGHLIGHTS,
    ERROR_EXAMPLE,
    INTEGRATOR_BULLETS,
    RESPONSE_ENVELOPE_EXAMPLE,
} from '@/lib/api-docs/highlights'
import {SITE_CONFIG_CURL} from '@/lib/api-docs/snippets'

export const metadata: Metadata = {
    title: 'API-Auszug für Entwickler',
    description:
        'Auszug der Directwerk REST-API: Host-Mandanten, öffentliche Endpoints, OAuth2 und Antwortformat.',
}

export default function DevelopersPage(): React.JSX.Element {
    return (
        <div className="pb-16">
            <section className="marketing-section">
                <div className="marketing-container max-w-4xl">
                    <SectionLabel>Entwickler</SectionLabel>
                    <h1 className="mt-4 text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
                        Die API ist das Produkt
                    </h1>
                    <p className="mt-6 text-lg leading-8 text-muted-foreground">
                        Directwerk ist API-first: Multi-Tenant-Whitelabel, Host-basierte
                        Mandantenauflösung, OAuth2 und modulare Feature-Gates mit
                        maschinenlesbaren Fehlercodes. Diese Seite ist ein{' '}
                        <strong className="font-medium text-foreground">Auszug</strong>{' '}
                        — die vollständige Dokumentation folgt als VitePress-Site.
                    </p>
                </div>
            </section>

            <section className="marketing-section border-t bg-muted/20">
                <div className="marketing-container max-w-4xl">
                    <h2 className="text-2xl font-semibold tracking-tight">
                        So verbinden Integratoren
                    </h2>
                    <ul className="mt-6 space-y-3 text-muted-foreground">
                        {INTEGRATOR_BULLETS.map((bullet) => (
                            <li className="flex gap-3 text-sm leading-6" key={bullet}>
                                <span aria-hidden="true" className="text-foreground">
                                    →
                                </span>
                                {bullet}
                            </li>
                        ))}
                    </ul>
                </div>
            </section>

            <section className="marketing-section">
                <div className="marketing-container max-w-4xl space-y-6">
                    <div>
                        <h2 className="text-2xl font-semibold tracking-tight">
                            Wichtigste Endpoints
                        </h2>
                        <p className="mt-2 text-sm text-muted-foreground">
                            Auswahl der relevantesten Pfade — nicht die vollständige Referenz.
                        </p>
                    </div>
                    <ApiHighlightTable highlights={API_HIGHLIGHTS} />
                </div>
            </section>

            <section className="marketing-section border-t bg-muted/20">
                <div className="marketing-container max-w-4xl space-y-8">
                    <div>
                        <h2 className="text-2xl font-semibold tracking-tight">
                            Beispiel: site-config
                        </h2>
                        <p className="mt-2 text-sm text-muted-foreground">
                            Jede öffentliche Frontend-Integration beginnt mit Branding und
                            aktiven Modulen.
                        </p>
                    </div>
                    <CodeBlock code={SITE_CONFIG_CURL} label="GET /api/v1/public/site-config" />
                    <OptionalOAuthSnippet />
                </div>
            </section>

            <section className="marketing-section">
                <div className="marketing-container max-w-4xl space-y-6">
                    <h2 className="text-2xl font-semibold tracking-tight">
                        Antwortformat
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        Einheitliches JSON-Envelope; Fehler enthalten strukturierte{' '}
                        <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">code</code>
                        -Felder für Integratoren.
                    </p>
                    <div className="grid gap-4 lg:grid-cols-2">
                        <div>
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Erfolg
                            </p>
                            <pre className="overflow-x-auto rounded-xl border bg-muted/40 p-4 font-mono text-xs leading-6">
                                {RESPONSE_ENVELOPE_EXAMPLE}
                            </pre>
                        </div>
                        <div>
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Modul deaktiviert
                            </p>
                            <pre className="overflow-x-auto rounded-xl border bg-muted/40 p-4 font-mono text-xs leading-6">
                                {ERROR_EXAMPLE}
                            </pre>
                        </div>
                    </div>
                </div>
            </section>

            <section className="marketing-section border-t bg-muted/20">
                <div className="marketing-container max-w-4xl">
                    <DocsComingSoon />
                </div>
            </section>
        </div>
    )
}
