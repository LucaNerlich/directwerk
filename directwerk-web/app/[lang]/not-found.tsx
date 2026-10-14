'use client'

import Link from 'next/link'

import {Button} from '@directwerk/ui/components/button'
import EmptyState from '@directwerk/ui/components/empty-state'
import PageStack from '@directwerk/ui/components/page-stack'

import {useDictionary, useLocale} from '@/lib/i18n/LocaleProvider'
import {localizedPath} from '@/lib/i18n/paths'

/**
 * Issue #432: a root-level `app/not-found.tsx` renders inside the root layout only, which is just
 * `<html><body>` here — the tenant header/footer live in `app/[lang]/layout.tsx`. A 404 reached
 * from a localized route therefore lost the tenant branding and navigation the comment below
 * promised. This segment-level not-found renders inside the localized tenant layout.
 */
export default function LocalizedNotFound(): React.JSX.Element {
    const lang = useLocale()
    const {nav, notFound} = useDictionary()
    return (
        <PageStack className="page-container">
            <EmptyState
                action={
                    <Button nativeButton={false} render={<Link href={localizedPath(lang, '/')} />}>
                        {nav.toHome}
                    </Button>
                }
                description={notFound.description}
                title={notFound.title}
            />
        </PageStack>
    )
}
