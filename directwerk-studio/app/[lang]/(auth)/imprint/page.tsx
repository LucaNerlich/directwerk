import type {Metadata} from 'next'

import {getImprint} from '@directwerk/legal'
import LegalArticle from '@directwerk/ui/components/legal-article'

import {getDictionary} from '@/lib/i18n'
import {isLocale} from '@/lib/i18n/config'

export async function generateMetadata({
    params,
}: {
    params: Promise<{lang: string}>
}): Promise<Metadata> {
    const {lang} = await params
    const dict = await getDictionary(lang)
    return {
        title: dict.auth.imprintTitle,
        description: dict.auth.imprintDescription,
    }
}

export default async function StudioImprintPage({
    params,
}: {
    params: Promise<{lang: string}>
}): Promise<React.JSX.Element> {
    // Review finding on #559: the route this PR made reachable rendered the German Impressum
    // under an English title — the same defect the web app fixed in #330.
    const {lang} = await params
    const locale = isLocale(lang) ? lang : 'de'
    return (
        <main className="mx-auto w-full max-w-3xl px-4 py-10">
            <LegalArticle
                page={getImprint(locale)}
                updatedLabel={locale === 'en' ? 'Last updated:' : 'Stand:'}
            />
        </main>
    )
}
