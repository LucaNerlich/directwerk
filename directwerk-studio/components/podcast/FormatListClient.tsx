'use client'

import LocaleLink from '@/components/i18n/LocaleLink'
import {useDictionary} from '@/components/i18n/LocaleProvider'
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
    const dict = useDictionary()
    const p = dict.podcast
    const {viewMode, setViewMode} = useListViewMode()
    const {data: formats, error: errorMessage, isLoading} = useAuthedQuery<FormatSummary[]>(
        () => listFormats(getClientTenantHost()),
        {fallbackError: p.formatsLoadFailed},
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
                {format.active ? dict.common.active : dict.common.inactive}
            </Badge>
        ),
        href: `/podcast/formats/${format.id}`,
    }))

    return (
        <PageStack>
            <PageHeader
                actions={
                    <Button nativeButton={false} render={<LocaleLink href="/podcast/formats/new" />} size="lg">
                        {p.neuesFormat}
                    </Button>
                }
                description={p.formateSortierenFolgenHauptfolge}
                eyebrow={p.setupTitle}
                title={p.formatsTitle}
            />

            {errorMessage ? (
                <Alert variant="destructive">
                    <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
            ) : null}
            {isLoading && !errorMessage ? (
                <p className="text-sm text-muted-foreground" role="status">{p.formatsLoading}</p>
            ) : null}
            {formats && formats.length === 0 ? (
                <EmptyState
                    action={
                        <Button nativeButton={false} render={<LocaleLink href="/podcast/formats/new" />}>
                            {p.createFirstFormat}
                        </Button>
                    }
                    description={p.empfohlenAberOptionalFormatenHoererSpaeter}
                    title={p.emptyFormatsTitle}
                />
            ) : null}
            {formats && formats.length > 0 ? (
                <div className="flex flex-col gap-4">
                    {formats.length > 1 ? (
                        <div className="grid gap-1.5">
                            <label className="text-sm font-medium" htmlFor={searchInputId}>
                                {p.formateDurchsuchen}
                            </label>
                            <Input
                                aria-label={p.formateDurchsuchen}
                                className="sm:max-w-xs"
                                id={searchInputId}
                                onChange={(event) => setQuery(event.target.value)}
                                placeholder={p.nameSlugSuchen}
                                type="search"
                                value={query}
                            />
                        </div>
                    ) : null}
                    {filteredFormats.length === 0 ? (
                        <EmptyState
                            action={
                                <Button onClick={() => setQuery('')} type="button" variant="outline">
                                    {p.resetSearch}
                                </Button>
                            }
                            description={p.searchNoResultsDescription}
                            title={p.keineTreffer}
                        />
                    ) : (
                        <EntityListSection
                            ariaLabel={p.formatsTitle}
                            items={listItems}
                            linkComponent={LocaleLink}
                            onViewModeChange={setViewMode}
                            viewMode={viewMode}
                        />
                    )}
                </div>
            ) : null}

            <p className="text-sm text-muted-foreground">
                {p.setupDonePrompt}{' '}
                <LocaleLink href="/podcast/episodes/new">{p.createNewEpisode}</LocaleLink>
                {' · '}
                <LocaleLink href="/podcast">{p.podcastUebersicht}</LocaleLink>
            </p>
        </PageStack>
    )
}
