'use client'

import Link from 'next/link'
import {useParams} from 'next/navigation'
import {useState} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Button} from '@directwerk/ui/components/button'
import {Input} from '@directwerk/ui/components/input'
import PageHeader from '@directwerk/ui/components/page-header'
import PageStack from '@directwerk/ui/components/page-stack'
import {Skeleton} from '@directwerk/ui/components/skeleton'

import {
    archiveNewsletterList,
    listNewsletterLists,
    listNewsletterSubscriptions,
    removeNewsletterSubscription,
    updateNewsletterList,
} from '@/lib/api/newsletterListsApi'
import {getClientTenantHost} from '@directwerk/api/tenant'
import {useAuthedQuery} from '@directwerk/api/client/useAuthedQuery'

export default function NewsletterListDetailClient(): React.JSX.Element {
    const params = useParams<{listId: string}>()
    const listId = Number(params.listId)
    const listsQuery = useAuthedQuery(
        () => listNewsletterLists(getClientTenantHost()),
        {fallbackError: 'Liste konnte nicht geladen werden.'},
    )
    const subsQuery = useAuthedQuery(
        () => listNewsletterSubscriptions(getClientTenantHost(), listId),
        {fallbackError: 'Abonnenten konnten nicht geladen werden.'},
    )
    const list = listsQuery.data?.find((item) => item.id === listId) ?? null
    const [name, setName] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const displayName = name ?? list?.name ?? ''

    async function save(): Promise<void> {
        if (list === null) return
        setBusy(true)
        setError(null)
        try {
            await updateNewsletterList(getClientTenantHost(), list.id, {name: displayName.trim()})
            listsQuery.reload()
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Speichern fehlgeschlagen.')
        } finally {
            setBusy(false)
        }
    }

    return (
        <PageStack>
            <PageHeader
                eyebrow="Write Desk"
                title={list?.name ?? 'Newsletter-Liste'}
                description={list ? `Slug: ${list.slug}` : undefined}
                actions={
                    <Button nativeButton={false} render={<Link href="/write/lists" />} variant="outline">
                        Zurück
                    </Button>
                }
            />
            {(listsQuery.isLoading || subsQuery.isLoading) && !list ? <Skeleton className="h-24 w-full" /> : null}
            {list ? (
                <div className="grid max-w-xl gap-3">
                    <label className="grid gap-1 text-sm font-medium">
                        Name
                        <Input
                            disabled={busy}
                            onChange={(event) => setName(event.target.value)}
                            value={displayName}
                        />
                    </label>
                    <div className="flex flex-wrap gap-2">
                        <Button disabled={busy} onClick={() => void save()} type="button">
                            Speichern
                        </Button>
                        {list.status === 'ACTIVE' ? (
                            <Button
                                disabled={busy}
                                onClick={() => {
                                    void (async () => {
                                        setBusy(true)
                                        try {
                                            await archiveNewsletterList(getClientTenantHost(), list.id)
                                            listsQuery.reload()
                                        } catch (err: unknown) {
                                            setError(err instanceof Error ? err.message : 'Archivieren fehlgeschlagen.')
                                        } finally {
                                            setBusy(false)
                                        }
                                    })()
                                }}
                                type="button"
                                variant="outline"
                            >
                                Archivieren
                            </Button>
                        ) : null}
                    </div>
                </div>
            ) : null}
            {error ? (
                <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            ) : null}
            <section className="grid gap-2">
                <h2 className="text-lg font-semibold">Abonnenten</h2>
                {subsQuery.data?.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Noch keine Anmeldungen.</p>
                ) : null}
                <ul className="grid gap-2">
                    {subsQuery.data?.map((row) => (
                        <li
                            className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
                            key={row.id}
                        >
                            <span>
                                {row.email}{' '}
                                <span className="text-muted-foreground">({row.status})</span>
                            </span>
                            {row.status !== 'UNSUBSCRIBED' ? (
                                <Button
                                    disabled={busy}
                                    onClick={() => {
                                        void (async () => {
                                            setBusy(true)
                                            try {
                                                await removeNewsletterSubscription(
                                                    getClientTenantHost(),
                                                    listId,
                                                    row.id,
                                                )
                                                subsQuery.reload()
                                            } catch (err: unknown) {
                                                setError(
                                                    err instanceof Error
                                                        ? err.message
                                                        : 'Entfernen fehlgeschlagen.',
                                                )
                                            } finally {
                                                setBusy(false)
                                            }
                                        })()
                                    }}
                                    size="sm"
                                    type="button"
                                    variant="outline"
                                >
                                    Entfernen
                                </Button>
                            ) : null}
                        </li>
                    ))}
                </ul>
            </section>
        </PageStack>
    )
}
