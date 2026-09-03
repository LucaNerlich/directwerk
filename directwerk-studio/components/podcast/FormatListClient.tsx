'use client'

import Link from 'next/link'
import {useId, useMemo, useState} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Badge} from '@directwerk/ui/components/badge'
import {Button} from '@directwerk/ui/components/button'
import EmptyState from '@directwerk/ui/components/empty-state'
import {EntityListSection} from '@directwerk/ui/components/entity-list-section'
import {Input} from '@directwerk/ui/components/input'
import PageHeader from '@directwerk/ui/components/page-header'
import PageStack from '@directwerk/ui/components/page-stack'
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
    const searchInputId = useId()
    const [query, setQuery] = useState('')
    const normalizedQuery = query.trim().toLowerCase()

    const filteredFormats = useMemo(() => {
        if (normalizedQuery.length === 0) {
            return formats ?? []
        }
        return (formats ?? []).filter((format) =>
            `${format.name} ${format.slug}`.toLowerCase().includes(normalizedQuery),
        )
    }, [formats, normalizedQuery])

    const listItems = filteredFormats.map((format) => ({
        id: format.id,
        title: format.name,
        description: <code>{format.slug}</code>,
        trailing: (
            <Badge variant={format.active ? 'secondary' : 'outline'}>
                {format.active ? 'Aktiv' : 'Inaktiv'}
            </Badge>
        ),
        href: `/podcast/formats/${format.id}`,
    }))

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
                <p className="text-sm text-muted-foreground" role="status">Formate werden geladen…</p>
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
                <div className="flex flex-col gap-4">
                    {formats.length > 1 ? (
                        <div className="grid gap-1.5">
                            <label className="text-sm font-medium" htmlFor={searchInputId}>
                                Formate durchsuchen
                            </label>
                            <Input
                                aria-label="Formate durchsuchen"
                                className="sm:max-w-xs"
                                id={searchInputId}
                                onChange={(event) => setQuery(event.target.value)}
                                placeholder="Name oder Slug suchen…"
                                type="search"
                                value={query}
                            />
                        </div>
                    ) : null}
                    {filteredFormats.length === 0 ? (
                        <EmptyState
                            action={
                                <Button onClick={() => setQuery('')} type="button" variant="outline">
                                    Suche zurücksetzen
                                </Button>
                            }
                            description="Passe den Suchbegriff an oder setze die Suche zurück."
                            title="Keine Treffer"
                        />
                    ) : (
                        <EntityListSection
                            ariaLabel="Formate"
                            items={listItems}
                            linkComponent={Link}
                            onViewModeChange={setViewMode}
                            viewMode={viewMode}
                        />
                    )}
                </div>
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
