'use client'

import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {useEffect, useState} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Button} from '@directwerk/ui/components/button'
import EmptyState from '@directwerk/ui/components/empty-state'
import ListPanel, {listPanelLinkClassName} from '@directwerk/ui/components/list-panel'
import PageHeader from '@directwerk/ui/components/page-header'
import PageStack from '@directwerk/ui/components/page-stack'

import {listFormats} from '@/lib/api/tenantApi'
import type {FormatSummary} from '@directwerk/api/types'
import {getClientTenantHost} from '@/lib/tenant/getClientTenantHost'
import {useAuthRequired} from '@directwerk/api/auth/useAuthRequired'

/**
 * Lists podcast formats (Formate) as a setup surface for the content-creation flow.
 */
export default function FormatListClient(): React.JSX.Element {
    const router = useRouter()
    const authRedirect = useAuthRequired()
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
                if (authRedirect(error)) return
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
            {formats === null && !errorMessage ? (
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
                        <li key={format.id}>
                            <Link
                                className={listPanelLinkClassName}
                                href={`/podcast/formats/${format.id}`}
                            >
                                <span>
                                    <span className="font-medium">{format.name}</span>
                                    <br />
                                    <small className="text-muted-foreground">{format.slug}</small>
                                </span>
                                <span className="shrink-0 text-muted-foreground">
                                    {format.active ? 'Aktiv' : 'Inaktiv'}
                                </span>
                            </Link>
                        </li>
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
