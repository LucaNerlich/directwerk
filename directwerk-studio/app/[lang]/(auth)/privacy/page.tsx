import type {Metadata} from 'next'

import {PRIVACY} from '@directwerk/legal'
import LegalArticle from '@directwerk/ui/components/legal-article'

export const metadata: Metadata = {
    title: 'Datenschutzerklärung · Directwerk Studio',
    description: 'Wie wir deine Daten schützen und welche Rechte du hast.',
}

export default function StudioPrivacyPage(): React.JSX.Element {
    return (
        <main className="mx-auto w-full max-w-3xl px-4 py-10">
            <LegalArticle page={PRIVACY} />
        </main>
    )
}
