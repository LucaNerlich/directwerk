import type {Metadata} from 'next'

import {PRIVACY} from '@directwerk/legal'
import LegalArticle from '@directwerk/ui/components/legal-article'
import PageStack from '@directwerk/ui/components/page-stack'

export const metadata: Metadata = {
    title: 'Datenschutzerklärung',
    description: 'Wie wir deine Daten schützen und welche Rechte du hast.',
}

export default function PrivacyPage(): React.JSX.Element {
    return (
        <PageStack className="page-container">
            <LegalArticle page={PRIVACY} />
        </PageStack>
    )
}
