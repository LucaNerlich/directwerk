'use client'

import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {useEffect, useState} from 'react'

import {Button} from '@directwerk/ui/components/button'
import EmptyState from '@directwerk/ui/components/empty-state'
import PageHeader from '@directwerk/ui/components/page-header'

import PublicationStatusBadge from '@/components/publication/PublicationStatusBadge'
import {listSeries} from '@/lib/api/tenantApi'
import type {SeriesSummary} from '@directwerk/api/types'
import {getClientTenantHost} from '@/lib/tenant/getClientTenantHost'
import {useAuthRequired} from '@directwerk/api/auth/useAuthRequired'

export default function SeriesPageClient(): React.JSX.Element {
    const router = useRouter()
    const authRedirect = useAuthRequired()
    const [series, setSeries] = useState<SeriesSummary[]>([])
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        let active = true

        async function load(): Promise<void> {
            try {
                const loaded = await listSeries(getClientTenantHost())
                if (active) {
                    setSeries(loaded)
                }
            } catch (error) {
                if (!active) {
                    return
                }
                if (authRedirect(error)) return
                setErrorMessage(
                    error instanceof Error
                        ? error.message
                        : 'Sendungen konnten nicht geladen werden.',
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

            {series.length === 0 ? (
                <EmptyState
                    title="Noch keine Sendung"
                    description="Lege deine erste Sendung an, danach Formate und die erste Folge."
                    action={
                        <Button nativeButton={false} render={<Link href="/podcast/series/new" />}>
                            Erste Sendung anlegen
                        </Button>
                    }
                />
            ) : (
                <ul className="overflow-hidden rounded-xl border bg-card divide-y">
                    {series.map((item) => (
                        <li key={item.id}>
                            <Link
                                className="flex w-full items-center justify-between gap-4 p-4 text-sm no-underline hover:bg-muted/40"
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
                        </li>
                    ))}
                </ul>
            )}

            {series.length > 0 ? (
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
