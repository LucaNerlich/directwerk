import type {Metadata} from 'next'

import {IMPRINT} from '@directwerk/legal'
import LegalArticle from '@directwerk/ui/components/legal-article'

export const metadata: Metadata = {
    title: 'Impressum',
    description: 'Anbieterkennzeichnung gemäß § 5 DDG.',
}

export default function ImprintPage(): React.JSX.Element {
    return (
        <div className="pb-16">
            <section className="marketing-section">
                <div className="marketing-container max-w-4xl">
                    <LegalArticle page={IMPRINT} />
                </div>
            </section>
        </div>
    )
}
