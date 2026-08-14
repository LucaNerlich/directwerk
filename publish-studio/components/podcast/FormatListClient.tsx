'use client'

import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {useEffect, useState} from 'react'

import {Button} from '@publish/ui/components/button'
import EmptyState from '@publish/ui/components/empty-state'
import PageHeader from '@publish/ui/components/page-header'

import {AUTH_REQUIRED} from '@/lib/api/errors'
import {listFormats} from '@/lib/api/tenantApi'
import type {FormatSummary} from '@/lib/api/types'
import {getClientTenantHost} from '@/lib/tenant/getClientTenantHost'

/**
 * Lists podcast formats (Formate) as a setup surface for the content-creation flow.
 */
export default function FormatListClient(): React.JSX.Element {
    const router = useRouter()
    const [formats, setFormats] = useState<FormatSummary[] | null>(null)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)

    useEffect(() => {
        let active = true

        listFormats(getClientTenantHost())
            .then((result) => {
                if (active) {
                    setFormats(result)
                }
            })
            .catch((error: unknown) => {
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
                        : 'Formate konnten nicht geladen werden.',
                )
            })

        return () => {
            active = false
        }
    }, [router])

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                eyebrow="Podcast · Einrichtung"
                title="Formate"
                description="Formate sortieren deine Folgen — z. B. Hauptfolge, Bonus oder Interview. Du wählst sie beim Erstellen einer Folge."
                actions={
                    <Button nativeButton={false} render={<Link href="/podcast/formats/new" />} size="lg">
                        Neues Format
                    </Button>
                }
            />

            {errorMessage ? (
                <p className="text-sm text-destructive" role="alert">
                    {errorMessage}
                </p>
            ) : null}
            {formats === null && !errorMessage ? <p>Laden…</p> : null}
            {formats && formats.length === 0 ? (
                <EmptyState
                    title="Noch keine Formate"
                    description="Empfohlen, aber optional: Mit Formaten können Hörer später gezielt Folgen finden und eigene Feeds bauen."
                    action={
                        <Button nativeButton={false} render={<Link href="/podcast/formats/new" />}>
                            Erstes Format anlegen
                        </Button>
                    }
                />
            ) : null}
            {formats && formats.length > 0 ? (
                <ul className="overflow-hidden rounded-xl border bg-card divide-y">
                    {formats.map((format) => (
                        <li key={format.id}>
                            <Link
                                className="flex w-full items-center justify-between gap-4 p-4 text-sm no-underline hover:bg-muted/40"
                                href={`/podcast/formats/${format.id}`}
                            >
                                <span>
                                    <span className="font-medium">{format.name}</span>
                                    <br />
                                    <small className="text-muted-foreground">{format.slug}</small>
                                </span>
                                <span className="flex shrink-0 items-center gap-3 text-sm text-muted-foreground">
                                    {format.active ? 'Aktiv' : 'Inaktiv'}
                                </span>
                            </Link>
                        </li>
                    ))}
                </ul>
            ) : null}

            <p className="text-sm text-muted-foreground">
                Fertig mit der Einrichtung?{' '}
                <Link href="/podcast/episodes/new">Neue Folge erstellen</Link>
                {' · '}
                <Link href="/podcast">Zur Podcast-Übersicht</Link>
            </p>
        </div>
    )
}
