'use client'

import Link from 'next/link'

import {Button} from '@directwerk/ui/components/button'
import EmptyState from '@directwerk/ui/components/empty-state'
import ListPanel, {
    ListPanelLinkItem,
    listPanelLinkClassName,
} from '@directwerk/ui/components/list-panel'
import PageHeader from '@directwerk/ui/components/page-header'

import PublicationStatusBadge from '@/components/publication/PublicationStatusBadge'
import {listSeries} from '@/lib/api/tenantApi'
import type {SeriesSummary} from '@directwerk/api/types'
import {getClientTenantHost} from '@/lib/tenant/getClientTenantHost'
import {useAuthedQuery} from '@directwerk/api/client'

export default function SeriesPageClient(): React.JSX.Element {
    const {data: series, error: errorMessage, isLoading} = useAuthedQuery<SeriesSummary[]>(
        () => listSeries(getClientTenantHost()),
        {fallbackError: 'Sendungen konnten nicht geladen werden.'},
    )

    if (isLoading) {
        return <p>Sendungen werden geladen…</p>
    }

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                eyebrow="Podcast · Einrichtung"
                title="Sendungen"
                description="Die Sendung ist dein Podcast-Kanal (Cover, Beschreibung, RSS). Einmal einrichten — der wöchentliche Flow läuft über Folgen."
                actions={
                    <Button nativeButton={false} render={<Link href="/podcast/series/new" />} size="lg">
                        Neue Sendung
                    </Button>
                }
            />

            {errorMessage !== null && (
                <p className="text-sm text-destructive" role="alert">
                    {errorMessage}
                </p>
            )}

            {series && series.length === 0 ? (
                <EmptyState
                    title="Noch keine Sendung"
                    description="Lege deine erste Sendung an, danach Formate und die erste Folge."
                    action={
                        <Button nativeButton={false} render={<Link href="/podcast/series/new" />}>
                            Erste Sendung anlegen
                        </Button>
                    }
                />
            ) : null}
            {series && series.length > 0 ? (
                <ListPanel>
                    {series.map((item) => (
                        <ListPanelLinkItem key={item.id}>
                            <Link
                                className={listPanelLinkClassName}
                                href={`/podcast/series/${item.id}`}
                            >
                                <span>
                                    <span className="font-medium">{item.title}</span>{' '}
                                    <code className="text-muted-foreground">{item.slug}</code>
                                </span>
                                <span className="flex shrink-0 items-center gap-3 text-sm text-muted-foreground">
                                    <PublicationStatusBadge status={item.status} />
                                </span>
                            </Link>
                        </ListPanelLinkItem>
                    ))}
                </ListPanel>
            ) : null}

            {series && series.length > 0 ? (
                <p className="text-sm text-muted-foreground">
                    Nächster Schritt:{' '}
                    <Link href="/podcast/formats">Formate festlegen</Link>
                    {' '}
                    oder{' '}
                    <Link href="/podcast/episodes/new">Folge erstellen</Link>.
                </p>
            ) : null}
        </div>
    )
}
