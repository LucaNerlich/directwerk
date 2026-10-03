import type {Metadata} from 'next'
import {notFound} from 'next/navigation'

import {getImprint} from '@directwerk/legal'
import LegalArticle from '@directwerk/ui/components/legal-article'

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
        title: dict.meta.imprintTitle,
        description: dict.meta.imprintDescription,
        alternates: {
            languages: {
                de: '/de/imprint',
                en: '/en/imprint',
            },
        },
    }
}

export default async function ImprintPage({
    params,
}: {
    params: Promise<{lang: string}>
}): Promise<React.JSX.Element> {
    const {lang: rawLang} = await params
    if (!isLocale(rawLang)) {
        notFound()
    }

    return (
        <div className="pb-16">
            <section className="marketing-section">
                <div className="marketing-container max-w-4xl">
                    <LegalArticle page={getImprint(rawLang)} />
                </div>
            </section>
        </div>
    )
}
