'use client'

import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {useEffect, useState} from 'react'

import {Button} from '@publish/ui/components/button'
import EmptyState from '@publish/ui/components/empty-state'
import PageHeader from '@publish/ui/components/page-header'

import PublicationStatusBadge from '@/components/publication/PublicationStatusBadge'
import {AUTH_REQUIRED} from '@/lib/api/errors'
import {listEpisodes, listFormats, listSeries} from '@/lib/api/tenantApi'
import type {EpisodeDetail, FormatSummary, SeriesSummary} from '@/lib/api/types'
import {getClientTenantHost} from '@/lib/tenant/getClientTenantHost'

export default function EpisodeListClient() {
    const router = useRouter()
    const [episodes, setEpisodes] = useState<EpisodeDetail[]>([])
    const [series, setSeries] = useState<SeriesSummary[]>([])
    const [formats, setFormats] = useState<FormatSummary[]>([])
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        let active = true

        async function load(): Promise<void> {
            try {
                const host = getClientTenantHost()
                const [loadedEpisodes, loadedSeries, loadedFormats] = await Promise.all([
                    listEpisodes(host),
                    listSeries(host),
                    listFormats(host),
                ])
                if (active) {
                    setEpisodes(loadedEpisodes)
                    setSeries(loadedSeries)
                    setFormats(loadedFormats)
                }
            } catch (error) {
                if (!active) {
                    return
                }
                if (error instanceof Error && error.message === AUTH_REQUIRED) {
                    router.replace('/login')
                    return
                }
                setErrorMessage(
                    error instanceof Error
                        ? error.message
                        : 'Folgen konnten nicht geladen werden.',
                )
            } finally {
                if (active) {
                    setIsLoading(false)
                }
            }
        }

        load()

        return () => {
            active = false
        }
    }, [router])

    if (isLoading) {
        return <p>Folgen werden geladen…</p>
    }

    const hasSeries = series.length > 0
    const canCreate = hasSeries

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                eyebrow="Podcast · Erstellen"
                title="Folgen"
                description="Hier entsteht dein laufender Output: Audio, Shownotes, Format, Veröffentlichen."
                actions={
                    canCreate ? (
                        <Button nativeButton={false} render={<Link href="/podcast/episodes/new" />} size="lg">
                            Neue Folge
                        </Button>
                    ) : null
                }
            />

            {errorMessage !== null && (
                <p className="text-sm text-destructive" role="alert">
                    {errorMessage}
                </p>
            )}

            {!hasSeries ? (
                <EmptyState
                    title="Zuerst eine Sendung anlegen"
                    description="Eine Folge gehört zu einer Sendung. Richte die Sendung einmal ein — danach kannst du regelmäßig Folgen veröffentlichen."
                    action={
                        <Button nativeButton={false} render={<Link href="/podcast/series/new" />}>
                            Sendung anlegen
                        </Button>
                    }
                />
            ) : null}

            {hasSeries && formats.length === 0 ? (
                <div className="rounded-xl border border-dashed bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                    Noch keine Formate.{' '}
                    <Link href="/podcast/formats/new">Formate anlegen</Link>
                    {' '}
                    (empfohlen), damit du Folgen als Hauptfolge, Bonus usw. kennzeichnen kannst.
                </div>
            ) : null}

            {hasSeries && episodes.length === 0 ? (
                <EmptyState
                    title="Noch keine Folgen"
                    description="Lade Audio hoch, schreibe Shownotes und veröffentliche deine erste Folge."
                    action={
                        <Button nativeButton={false} render={<Link href="/podcast/episodes/new" />}>
                            Erste Folge anlegen
                        </Button>
                    }
                />
            ) : null}

            {episodes.length > 0 ? (
                <ul className="overflow-hidden rounded-xl border bg-card divide-y">
                    {episodes.map((episode) => (
                        <li key={episode.id}>
                            <Link
                                className="flex items-center justify-between gap-4 p-4 text-sm no-underline hover:bg-muted/40"
                                href={`/podcast/episodes/${episode.id}`}
                            >
                                <span className="font-medium">{episode.title}</span>
                                <PublicationStatusBadge status={episode.status} />
                            </Link>
                        </li>
                    ))}
                </ul>
            ) : null}
        </div>
    )
}
