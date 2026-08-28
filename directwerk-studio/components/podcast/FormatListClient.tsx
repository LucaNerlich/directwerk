'use client'

import Link from 'next/link'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Button} from '@directwerk/ui/components/button'
import EmptyState from '@directwerk/ui/components/empty-state'
import ListPanel, {
    ListPanelLinkItem,
    ListPanelSlugContent,
    listPanelLinkClassName,
} from '@directwerk/ui/components/list-panel'
import PageHeader from '@directwerk/ui/components/page-header'
import PageStack from '@directwerk/ui/components/page-stack'

import {listFormats} from '@/lib/api/catalogApi'
import type {FormatSummary} from '@directwerk/api/types'
import {getClientTenantHost} from '@/lib/tenant/getClientTenantHost'
import {useAuthedQuery} from '@directwerk/api/client'

export default function FormatListClient(): React.JSX.Element {
    const {data: formats, error: errorMessage, isLoading} = useAuthedQuery<FormatSummary[]>(
        () => listFormats(getClientTenantHost()),
        {fallbackError: 'Formate konnten nicht geladen werden.'},
    )

    return (
        <PageStack>
            <PageHeader
                actions={
                    <Button nativeButton={false} render={<Link href="/podcast/formats/new" />} size="lg">
                        Neues Format
                    </Button>
                }
                description="Formate sortieren deine Folgen — z. B. Hauptfolge, Bonus oder Interview. Du wählst sie beim Erstellen einer Folge."
                eyebrow="Podcast · Einrichtung"
                title="Formate"
            />

            {errorMessage ? (
                <Alert variant="destructive">
                    <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
            ) : null}
            {isLoading && !errorMessage ? (
                <p className="text-sm text-muted-foreground">Laden…</p>
            ) : null}
            {formats && formats.length === 0 ? (
                <EmptyState
                    action={
                        <Button nativeButton={false} render={<Link href="/podcast/formats/new" />}>
                            Erstes Format anlegen
                        </Button>
                    }
                    description="Empfohlen, aber optional: Mit Formaten können Hörer später gezielt Folgen finden und eigene Feeds bauen."
                    title="Noch keine Formate"
                />
            ) : null}
            {formats && formats.length > 0 ? (
                <ListPanel>
                    {formats.map((format) => (
                        <ListPanelLinkItem key={format.id}>
                            <Link
                                className={listPanelLinkClassName}
                                href={`/podcast/formats/${format.id}`}
                            >
                                <ListPanelSlugContent
                                    name={format.name}
                                    slug={format.slug}
                                    trailing={format.active ? 'Aktiv' : 'Inaktiv'}
                                />
                            </Link>
                        </ListPanelLinkItem>
                    ))}
                </ListPanel>
            ) : null}

            <p className="text-sm text-muted-foreground">
                Fertig mit der Einrichtung?{' '}
                <Link href="/podcast/episodes/new">Neue Folge erstellen</Link>
                {' · '}
                <Link href="/podcast">Zur Podcast-Übersicht</Link>
            </p>
        </PageStack>
    )
}
