import type {Metadata} from 'next'

import {PRIVACY} from '@directwerk/legal'
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
        title: legal.privacyTitle,
        description: legal.privacyDescription,
    }
}

export default function PrivacyPage(): React.JSX.Element {
    return (
        <PageStack className="page-container">
            <LegalArticle page={PRIVACY} />
        </PageStack>
    )
}
