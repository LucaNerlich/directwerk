import type {Metadata} from 'next'
import {notFound} from 'next/navigation'

import ApiHighlightTable from '@/components/marketing/ApiHighlightTable'
import CodeBlock from '@/components/marketing/CodeBlock'
import DocsCta from '@/components/marketing/DocsCta'
import OptionalOAuthSnippet from '@/components/marketing/OptionalOAuthSnippet'
import SectionLabel from '@/components/marketing/SectionLabel'
import {
    ERROR_EXAMPLE,
    RESPONSE_ENVELOPE_EXAMPLE,
    type ApiHighlight,
} from '@/lib/api-docs/highlights'
import {SITE_CONFIG_CURL} from '@/lib/api-docs/snippets'
import {isLocale} from '@/lib/i18n/config'
import {getDictionary} from '@/lib/i18n/get-dictionary'

export async function generateMetadata({
    params,
}: {
    params: Promise<{lang: string}>
}): Promise<Metadata> {
    const {lang: rawLang} = await params
    if (!isLocale(rawLang)) {
        return {}
    }
    const dict = await getDictionary(rawLang)
    return {
        title: dict.meta.developersTitle,
        description: dict.meta.developersDescription,
        alternates: {
            languages: {
                de: '/de/developers',
                en: '/en/developers',
            },
        },
    }
}

export default async function DevelopersPage({
    params,
}: {
    params: Promise<{lang: string}>
}): Promise<React.JSX.Element> {
    const {lang: rawLang} = await params
    if (!isLocale(rawLang)) {
        notFound()
    }
    const dict = await getDictionary(rawLang)
    const copy = dict.developers
    const highlights = copy.highlights as ApiHighlight[]

    return (
        <div className="pb-16">
            <section className="marketing-section">
                <div className="marketing-container max-w-4xl">
                    <SectionLabel>{copy.sectionLabel}</SectionLabel>
                    <h1 className="mt-4 text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
                        {copy.title}
                    </h1>
                    <p className="mt-6 text-lg leading-8 text-muted-foreground">
                        {copy.introBefore}{' '}
                        <strong className="font-medium text-foreground">{copy.introStrong}</strong>{' '}
                        {copy.introAfter}
                    </p>
                </div>
            </section>

            <section className="marketing-section border-t bg-muted/20">
                <div className="marketing-container max-w-4xl">
                    <h2 className="text-2xl font-semibold tracking-tight">
                        {copy.integratorTitle}
                    </h2>
                    <ul className="mt-6 space-y-3 text-muted-foreground">
                        {copy.integratorBullets.map((bullet) => (
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
                            {copy.endpointsTitle}
                        </h2>
                        <p className="mt-2 text-sm text-muted-foreground">{copy.endpointsBody}</p>
                    </div>
                    <ApiHighlightTable
                        highlights={highlights}
                        labels={{
                            method: copy.tableMethod,
                            path: copy.tablePath,
                            description: copy.tableDescription,
                        }}
                    />
                </div>
            </section>

            <section className="marketing-section border-t bg-muted/20">
                <div className="marketing-container max-w-4xl space-y-8">
                    <div>
                        <h2 className="text-2xl font-semibold tracking-tight">
                            {copy.siteConfigTitle}
                        </h2>
                        <p className="mt-2 text-sm text-muted-foreground">{copy.siteConfigBody}</p>
                    </div>
                    <CodeBlock code={SITE_CONFIG_CURL} label="GET /api/v1/public/site-config" />
                    <OptionalOAuthSnippet hideLabel={copy.oauthHide} showLabel={copy.oauthShow} />
                </div>
            </section>

            <section className="marketing-section">
                <div className="marketing-container max-w-4xl space-y-6">
                    <h2 className="text-2xl font-semibold tracking-tight">{copy.responseTitle}</h2>
                    <p className="text-sm text-muted-foreground">
                        {copy.responseBodyBefore}{' '}
                        <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">code</code>
                        {copy.responseBodyAfter}
                    </p>
                    <div className="grid gap-4 lg:grid-cols-2">
                        <div>
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                {copy.successLabel}
                            </p>
                            <pre className="overflow-x-auto rounded-xl border bg-muted/40 p-4 font-mono text-xs leading-6">
                                {RESPONSE_ENVELOPE_EXAMPLE}
                            </pre>
                        </div>
                        <div>
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                {copy.moduleDisabledLabel}
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
                    <DocsCta copy={copy} />
                </div>
            </section>
        </div>
    )
}
