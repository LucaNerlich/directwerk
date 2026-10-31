'use client'

import Link from 'next/link'
import {usePathname} from 'next/navigation'
import type {ReactNode} from 'react'

import {buttonVariants} from '@directwerk/ui/components/button'

import CatalogMediaThumb from '@/components/CatalogMediaThumb'
import ContentMetaLine from '@/components/ContentMetaLine'
import {loginHref} from '@/lib/auth/loginHref'
import {useDictionary, useLocale} from '@/lib/i18n/LocaleProvider'

/** Responsive catalog grid: 1 → 2 → 3 columns (matches downloads/pricing density). */
export const CATALOG_GRID_CLASSNAME = 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3'

/**
 * Locked-state CTA shared by episode and article cards: guests are sent to
 * login, subscribers toward the unlocking membership (`unlockHref` prefers a
 * concrete product, see `lib/catalog/unlock`).
 */
export function LockedCatalogAction({
    isAuthenticated,
    unlockHref,
}: {
    isAuthenticated: boolean
    unlockHref: string
}): React.JSX.Element {
    const lang = useLocale()
    const pathname = usePathname()
    const {common, nav} = useDictionary()
    if (!isAuthenticated) {
        return (
            <Link className={buttonVariants({size: 'sm'})} href={loginHref(lang, pathname)}>
                {nav.login}
            </Link>
        )
    }
    return (
        <Link className={buttonVariants({size: 'sm'})} href={unlockHref}>
            {common.unlock}
        </Link>
    )
}

/**
 * Dense catalog tile for episode/article grids: optional cover, title link with
 * badge, meta line, optional excerpt, and CTA. Place inside a `ul` with
 * {@link CATALOG_GRID_CLASSNAME}.
 */
export default function CatalogRow({
    href,
    title,
    badge,
    metaItems = [],
    excerpt,
    imageUrl,
    imageAlt,
    action,
}: {
    href: string
    title: ReactNode
    badge?: ReactNode
    metaItems?: Array<ReactNode | null | undefined | false>
    excerpt?: string | null
    imageUrl?: string | null
    imageAlt?: string
    action: ReactNode
}): React.JSX.Element {
    return (
        <li
            className="flex h-full flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm"
            data-dw-surface="panel"
        >
            <CatalogMediaThumb alt={imageAlt ?? ''} size="md" src={imageUrl} />
            <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                    <Link className="font-medium hover:underline" href={href}>
                        {title}
                    </Link>
                    {badge}
                </div>
                <ContentMetaLine items={metaItems} />
                {excerpt !== undefined && excerpt !== null && excerpt.length > 0 ? (
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {excerpt}
                    </p>
                ) : null}
            </div>
            <div className="mt-auto flex shrink-0 flex-wrap items-center gap-2">{action}</div>
        </li>
    )
}
