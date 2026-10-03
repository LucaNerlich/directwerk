import Link from 'next/link'

import {Button} from '@directwerk/ui/components/button'
import EmptyState from '@directwerk/ui/components/empty-state'
import PageStack from '@directwerk/ui/components/page-stack'

import {defaultLocale} from '@/lib/i18n/config'
import {getDictionary} from '@/lib/i18n/getDictionary'
import {localizedPath} from '@/lib/i18n/paths'

/**
 * Tenant-branded 404. Renders inside the root layout, so visitors keep the
 * tenant header, navigation, and footer instead of Next's default English page.
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
