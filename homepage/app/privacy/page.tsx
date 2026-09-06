import type {Metadata} from 'next'

import {PRIVACY} from '@directwerk/legal'
import LegalArticle from '@directwerk/ui/components/legal-article'

export const metadata: Metadata = {
    title: 'Datenschutzerklärung',
    description: 'Wie wir deine Daten schützen und welche Rechte du hast.',
}

export default function PrivacyPage(): React.JSX.Element {
    return (
        <div className="pb-16">
            <section className="marketing-section">
                <div className="marketing-container max-w-4xl">
                    <LegalArticle page={PRIVACY} />
                </div>
            </section>
        </div>
    )
}
