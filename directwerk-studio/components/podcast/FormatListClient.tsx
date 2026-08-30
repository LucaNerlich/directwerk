'use client'

import Link from 'next/link'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Button} from '@directwerk/ui/components/button'
import EmptyState from '@directwerk/ui/components/empty-state'
import PageHeader from '@directwerk/ui/components/page-header'
import PageStack from '@directwerk/ui/components/page-stack'
import {SlugEntityListSection} from '@directwerk/ui/components/slug-entity-list-section'
import {useListViewMode} from '@directwerk/ui/hooks/use-list-view-mode'

import {listFormats} from '@/lib/api/catalogApi'
import type {FormatSummary} from '@directwerk/api/types'
import {getClientTenantHost} from '@directwerk/api/tenant'
import {useAuthedQuery} from '@directwerk/api/client/useAuthedQuery'

export default function FormatListClient(): React.JSX.Element {
    const {viewMode, setViewMode} = useListViewMode()
    const {data: formats, error: errorMessage, isLoading} = useAuthedQuery<FormatSummary[]>(
        () => listFormats(getClientTenantHost()),
        {fallbackError: 'Formate konnten nicht geladen werden.'},
    )

    const listItems =
        formats?.map((format) => ({
            id: format.id,
            name: format.name,
            slug: format.slug,
            trailing: format.active ? 'Aktiv' : 'Inaktiv',
            href: `/podcast/formats/${format.id}`,
        })) ?? []

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
                <SlugEntityListSection
                    items={listItems}
                    onViewModeChange={setViewMode}
                    viewMode={viewMode}
                />
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
