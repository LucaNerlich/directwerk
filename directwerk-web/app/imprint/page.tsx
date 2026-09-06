import type {Metadata} from 'next'

import {IMPRINT} from '@directwerk/legal'
import LegalArticle from '@directwerk/ui/components/legal-article'
import PageStack from '@directwerk/ui/components/page-stack'

export const metadata: Metadata = {
    title: 'Impressum',
    description: 'Anbieterkennzeichnung gemäß § 5 DDG.',
}

export default function ImprintPage(): React.JSX.Element {
    return (
        <PageStack className="page-container">
            <LegalArticle page={IMPRINT} />
        </PageStack>
    )
}
