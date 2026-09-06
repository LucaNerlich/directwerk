import type {Metadata} from 'next'

import {PRIVACY} from '@directwerk/legal'
import LegalArticle from '@directwerk/ui/components/legal-article'

export const metadata: Metadata = {
    title: 'Privacy · Directwerk platform admin',
    description: 'How we protect your data and which rights you have.',
}

export default function AdminPrivacyPage(): React.JSX.Element {
    return (
        <main className="mx-auto w-full max-w-3xl px-4 py-10">
            <LegalArticle page={PRIVACY} />
        </main>
    )
}
