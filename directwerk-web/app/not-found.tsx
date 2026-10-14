import Link from 'next/link'

import {Button} from '@directwerk/ui/components/button'
import EmptyState from '@directwerk/ui/components/empty-state'
import PageStack from '@directwerk/ui/components/page-stack'

import {defaultLocale} from '@/lib/i18n/config'
import {getDictionary} from '@/lib/i18n/getDictionary'
import {localizedPath} from '@/lib/i18n/paths'

/**
 * Fallback 404 for paths outside the `[lang]` segment. The tenant-branded 404 lives at
 * `app/[lang]/not-found.tsx` (issue #432) — this one renders inside the bare root layout, so it
 * has no tenant header/footer.
 */
export default async function NotFound(): Promise<React.JSX.Element> {
    const {nav, notFound} = await getDictionary(defaultLocale)
    return (
        <PageStack className="page-container">
            <EmptyState
                action={
                    <Button nativeButton={false} render={<Link href={localizedPath(defaultLocale, '/')} />}>
                        {nav.toHome}
                    </Button>
                }
                description={notFound.description}
                title={notFound.title}
            />
        </PageStack>
    )
}
