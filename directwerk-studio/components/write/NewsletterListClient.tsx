'use client'

import Link from 'next/link'
import {useState} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Button} from '@directwerk/ui/components/button'
import EmptyState from '@directwerk/ui/components/empty-state'
import {EntityListSection} from '@directwerk/ui/components/entity-list-section'
import {Input} from '@directwerk/ui/components/input'
import PageHeader from '@directwerk/ui/components/page-header'
import PageStack from '@directwerk/ui/components/page-stack'
import {Skeleton} from '@directwerk/ui/components/skeleton'
import {useListViewMode} from '@directwerk/ui/hooks/use-list-view-mode'

import {
    createNewsletterList,
    listNewsletterLists,
} from '@/lib/api/newsletterListsApi'
import {suggestSlug} from '@/lib/api/studioHelpers'
import {getClientTenantHost} from '@directwerk/api/tenant'
import {useAuthedQuery} from '@directwerk/api/client/useAuthedQuery'

export default function NewsletterListClient(): React.JSX.Element {
    const {viewMode, setViewMode} = useListViewMode()
    const {data: lists, error: errorMessage, isLoading, reload} = useAuthedQuery(
        () => listNewsletterLists(getClientTenantHost()),
        {fallbackError: 'Listen konnten nicht geladen werden.'},
    )
    const [name, setName] = useState('')
    const [slug, setSlug] = useState('')
    const [busy, setBusy] = useState(false)
    const [createError, setCreateError] = useState<string | null>(null)

    const listItems =
        lists?.map((list) => ({
            id: list.id,
            title: list.name,
            href: `/write/lists/${list.id}`,
            description: (
                <span className="text-sm text-muted-foreground">
                    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{list.slug}</code>
                    {' · '}
                    {list.activeCount} aktiv · {list.pendingCount} ausstehend
                    {list.status === 'ARCHIVED' ? ' · archiviert' : ''}
                </span>
            ),
        })) ?? []

    async function handleCreate(): Promise<void> {
        setBusy(true)
        setCreateError(null)
        try {
            await createNewsletterList(getClientTenantHost(), {
                name: name.trim(),
                slug: slug.trim() || suggestSlug(name),
            })
            setName('')
            setSlug('')
            reload()
        } catch (error: unknown) {
            setCreateError(error instanceof Error ? error.message : 'Anlegen fehlgeschlagen.')
        } finally {
            setBusy(false)
        }
    }

    return (
        <PageStack>
            <PageHeader
                eyebrow="Write Desk"
                title="Newsletter-Listen"
                description="Empfängerlisten für Beiträge. Beim Veröffentlichen werden aktive Abonnenten der angehängten Listen per E-Mail benachrichtigt."
            />

            <form
                className="grid max-w-xl gap-3 rounded-lg border p-4"
                onSubmit={(event) => {
                    event.preventDefault()
                    void handleCreate()
                }}
            >
                <label className="grid gap-1 text-sm font-medium">
                    Name
                    <Input
                        disabled={busy}
                        onChange={(event) => {
                            setName(event.target.value)
                            if (slug.trim().length === 0) {
                                setSlug(suggestSlug(event.target.value))
                            }
                        }}
                        required
                        value={name}
                    />
                </label>
                <label className="grid gap-1 text-sm font-medium">
                    Slug
                    <Input
                        disabled={busy}
                        onChange={(event) => setSlug(event.target.value)}
                        pattern="[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,62}[a-zA-Z0-9])?"
                        required
                        value={slug}
                    />
                </label>
                {createError ? (
                    <Alert variant="destructive">
                        <AlertDescription>{createError}</AlertDescription>
                    </Alert>
                ) : null}
                <Button disabled={busy || name.trim().length === 0} type="submit">
                    Liste anlegen
                </Button>
            </form>

            {errorMessage ? (
                <Alert variant="destructive">
                    <AlertDescription>
                        {errorMessage}{' '}
                        <Button onClick={reload} size="sm" type="button" variant="outline">
                            Wiederholen
                        </Button>
                    </AlertDescription>
                </Alert>
            ) : null}
            {isLoading && !errorMessage ? (
                <div className="grid gap-3" aria-busy="true">
                    <Skeleton className="h-16 w-full" />
                </div>
            ) : null}
            {lists && lists.length === 0 ? (
                <EmptyState
                    title="Noch keine Listen"
                    description="Lege eine Liste an und hänge sie an Beiträge an."
                />
            ) : null}
            {lists && lists.length > 0 ? (
                <EntityListSection
                    items={listItems}
                    linkComponent={Link}
                    onViewModeChange={setViewMode}
                    viewMode={viewMode}
                />
            ) : null}
        </PageStack>
    )
}
