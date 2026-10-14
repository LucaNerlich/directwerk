import type {Metadata} from 'next'

import {getImprint} from '@directwerk/legal'
import LegalArticle from '@directwerk/ui/components/legal-article'
import PageStack from '@directwerk/ui/components/page-stack'

import {isLocale} from '@/lib/i18n/config'
import {getDictionary} from '@/lib/i18n/getDictionary'

interface LegalPageProps {
    params: Promise<{lang: string}>
}

export async function generateMetadata({
    params,
}: LegalPageProps): Promise<Metadata> {
    const {lang} = await params
    if (!isLocale(lang)) {
        return {}
    }
    const {legal} = await getDictionary(lang)
    return {
        title: legal.imprintTitle,
        description: legal.imprintDescription,
    }
}

export default async function ImprintPage({
    params,
}: LegalPageProps): Promise<React.JSX.Element> {
    // #330: this page always rendered the German Impressum, even under /en.
    const {lang} = await params
    const locale = isLocale(lang) ? lang : 'de'
    return (
        <PageStack className="page-container">
            <LegalArticle
                page={getImprint(locale)}
                updatedLabel={locale === 'en' ? 'Last updated:' : 'Stand:'}
            />
        </PageStack>
    )
}
