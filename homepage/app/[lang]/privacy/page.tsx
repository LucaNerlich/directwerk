import type {Metadata} from 'next'
import {notFound} from 'next/navigation'

import {getPrivacy} from '@directwerk/legal'
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
        title: dict.meta.privacyTitle,
        description: dict.meta.privacyDescription,
        alternates: {
            languages: {
                de: '/de/privacy',
                en: '/en/privacy',
            },
        },
    }
}

export default async function PrivacyPage({
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
                    <LegalArticle page={getPrivacy(rawLang)} />
                </div>
            </section>
        </div>
    )
}
