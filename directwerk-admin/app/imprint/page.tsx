import type {Metadata} from 'next'

import {IMPRINT} from '@directwerk/legal'
import LegalArticle from '@directwerk/ui/components/legal-article'

export const metadata: Metadata = {
    title: 'Imprint · Directwerk platform admin',
    description: 'Provider identification.',
}

export default function AdminImprintPage(): React.JSX.Element {
    return (
        <main className="mx-auto w-full max-w-3xl px-4 py-10">
            <LegalArticle page={IMPRINT} />
        </main>
    )
}
