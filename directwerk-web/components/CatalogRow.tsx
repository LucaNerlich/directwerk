import Link from 'next/link'
import type {ReactNode} from 'react'

import {Button} from '@directwerk/ui/components/button'
import {ListPanelRow} from '@directwerk/ui/components/list-panel'

import ContentMetaLine from '@/components/ContentMetaLine'

/**
 * Locked-state CTA shared by episode and article rows: guests are sent to
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
    if (!isAuthenticated) {
        return (
            <Button nativeButton={false} render={<Link href="/login" />} size="sm">
                Anmelden
            </Button>
        )
    }
    return (
        <Button nativeButton={false} render={<Link href={unlockHref} />} size="sm">
            Freischalten
        </Button>
    )
}

/**
 * One row pattern for episodes and articles: title link with badge, meta line
 * (`Gruppe · Datum · Dauer`), optional excerpt, right-side CTA. Used inside a
 * `ListPanel` on both catalog list pages.
 */
export default function CatalogRow({
    href,
    title,
    badge,
    metaItems = [],
    excerpt,
    action,
}: {
    href: string
    title: ReactNode
    badge?: ReactNode
    metaItems?: Array<ReactNode | null | undefined | false>
    excerpt?: string | null
    action: ReactNode
}): React.JSX.Element {
    return (
        <ListPanelRow>
            <div className="min-w-0 flex-1">
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
            <div className="flex shrink-0 items-center gap-2">{action}</div>
        </ListPanelRow>
    )
}
