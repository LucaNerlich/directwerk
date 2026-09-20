'use client'

import Link from 'next/link'
import {useEffect, useState} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Badge} from '@directwerk/ui/components/badge'
import {Button} from '@directwerk/ui/components/button'
import EmptyState from '@directwerk/ui/components/empty-state'
import {EntityListSection} from '@directwerk/ui/components/entity-list-section'
import type {EntityListViewItem} from '@directwerk/ui/components/entity-list-view'
import PageHeader from '@directwerk/ui/components/page-header'
import PageStack from '@directwerk/ui/components/page-stack'
import SectionHeader from '@directwerk/ui/components/section-header'
import {Skeleton} from '@directwerk/ui/components/skeleton'
import {useListViewMode} from '@directwerk/ui/hooks/use-list-view-mode'

import PublicationStatusBadge from '@/components/publication/PublicationStatusBadge'
import {listDigitalPublications} from '@/lib/api/digitalPublicationsApi'
import type {DigitalPublication} from '@directwerk/api/types'
import {getClientTenantHost} from '@directwerk/api/tenant'
import {useAuthRequired} from '@directwerk/api/auth/useAuthRequired'

function formatBytes(sizeBytes: number | null): string {
    if (sizeBytes === null || sizeBytes <= 0) {
        return 'Größe unbekannt'
    }
    if (sizeBytes < 1024) {
        return `${sizeBytes} B`
    }
    if (sizeBytes < 1024 * 1024) {
        return `${(sizeBytes / 1024).toFixed(1)} KB`
    }
    return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function BonusLibraryClient(): React.JSX.Element {
    const authRedirect = useAuthRequired()
    const [publications, setPublications] = useState<DigitalPublication[]>([])
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [reloadToken, setReloadToken] = useState(0)
    const {viewMode, setViewMode} = useListViewMode()

    useEffect(() => {
        let active = true
        setIsLoading(true)
        setErrorMessage(null)
        listDigitalPublications(getClientTenantHost())
            .then((result) => {
                if (!active) {
                    return
                }
                setPublications(result)
                setIsLoading(false)
            })
            .catch((error: unknown) => {
                if (!active) {
                    return
                }
                if (authRedirect(error)) return
                setErrorMessage(
                    error instanceof Error
                        ? error.message
                        : 'Bonusdateien konnten nicht geladen werden.',
                )
                setIsLoading(false)
            })
        return () => {
            active = false
        }
    }, [reloadToken, authRedirect])

    if (isLoading) {
        return (
            <PageStack>
                <PageHeader
                    eyebrow="Medien"
                    title="Bonusdateien"
                    description="Veröffentlichbare Dokumente für Abonnenten — mit Titel, Zugang und Workflow."
                />
                <p className="text-sm text-muted-foreground" role="status">Wird geladen…</p>
                <div className="grid gap-4" aria-hidden="true">
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                </div>
            </PageStack>
        )
    }

    const items: EntityListViewItem[] = publications.map((publication) => ({
        id: publication.id,
        title: publication.title,
        href: `/bonus/${publication.id}`,
        description: `${publication.accessPolicy === 'PAID' ? 'Bezahlt' : 'Frei'} · ${publication.originalFilename ?? `Asset #${publication.assetId}`} · ${formatBytes(publication.sizeBytes)}`,
        trailing: (
            <PublicationStatusBadge
                status={
                    publication.status === 'DRAFT'
                        ? 'DRAFT'
                        : publication.status === 'PUBLISHED'
                          ? 'PUBLISHED'
                          : 'ARCHIVED'
                }
            />
        ),
        actions: (
            <Button
                nativeButton={false}
                render={<Link href={`/bonus/${publication.id}`} />}
                variant="outline"
            >
                Bearbeiten
            </Button>
        ),
    }))

    return (
        <PageStack>
            <PageHeader
                eyebrow="Medien"
                title="Bonusdateien"
                description="Lege Dokumente als Bonus-Inhalte an, setze frei oder bezahlt und veröffentliche sie für Abonnenten."
                actions={
                    <Button nativeButton={false} render={<Link href="/bonus/new" />} size="lg">
                        Neue Bonusdatei
                    </Button>
                }
            />
            {errorMessage !== null ? (
                <Alert variant="destructive">
                    <AlertDescription>{errorMessage}</AlertDescription>
                    <Button
                        className="mt-3"
                        onClick={() => setReloadToken((value) => value + 1)}
                        type="button"
                        variant="outline"
                    >
                        Erneut versuchen
                    </Button>
                </Alert>
            ) : null}
            {publications.length === 0 && errorMessage === null ? (
                <EmptyState
                    title="Noch keine Bonusdateien"
                    description="Lade zuerst ein PDF in der Mediathek hoch, dann erstellst du hier den Bonus-Inhalt mit Titel und Zugang."
                    action={
                        <div className="flex flex-wrap justify-center gap-2">
                            <Button nativeButton={false} render={<Link href="/bonus/new" />}>
                                Bonusdatei anlegen
                            </Button>
                            <Button
                                nativeButton={false}
                                render={<Link href="/media" />}
                                variant="outline"
                            >
                                Zur Mediathek
                            </Button>
                        </div>
                    }
                />
            ) : null}
            {publications.length > 0 ? (
                <section aria-labelledby="bonus-files-heading" className="flex flex-col gap-4">
                    <SectionHeader
                        id="bonus-files-heading"
                        title={`Bonusdateien (${publications.length})`}
                        description="Entwürfe, veröffentlichte und archivierte Bonus-Inhalte."
                    />
                    <EntityListSection
                        items={items}
                        onViewModeChange={setViewMode}
                        showSelection={false}
                        viewMode={viewMode}
                    />
                    <p className="text-sm text-muted-foreground">
                        Bezahlt-Inhalte brauchen ein LEVEL oder eine{' '}
                        <Link className="underline" href="/manage/products">
                            DIGITAL_ASSET-Regel
                        </Link>{' '}
                        am Paket.
                    </p>
                    <Badge variant="outline" className="w-fit">
                        Modul BONUS_CONTENT
                    </Badge>
                </section>
            ) : null}
        </PageStack>
    )
}
