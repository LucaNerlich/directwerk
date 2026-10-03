import type {Metadata} from 'next'

import {PRIVACY} from '@directwerk/legal'
import LegalArticle from '@directwerk/ui/components/legal-article'

import {getDictionary} from '@/lib/i18n'

export async function generateMetadata({
    params,
}: {
    params: Promise<{lang: string}>
}): Promise<Metadata> {
    const {lang} = await params
    const dict = await getDictionary(lang)
    return {
        title: dict.auth.privacyTitle,
        description: dict.auth.privacyDescription,
    }
}

export default function StudioPrivacyPage(): React.JSX.Element {
    return (
        <main className="mx-auto w-full max-w-3xl px-4 py-10">
            <LegalArticle page={PRIVACY} />
        </main>
    )
}
