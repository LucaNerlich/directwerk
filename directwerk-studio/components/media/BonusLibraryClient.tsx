'use client'

import Link from 'next/link'
import {useRouter} from 'next/navigation'
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

import {listMedia} from '@/lib/api/mediaApi'
import type {MediaAsset} from '@directwerk/api/types'
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
    const router = useRouter()
    const authRedirect = useAuthRequired()
    const [assets, setAssets] = useState<MediaAsset[]>([])
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [reloadToken, setReloadToken] = useState(0)
    const {viewMode, setViewMode} = useListViewMode()

    useEffect(() => {
        let active = true
        setIsLoading(true)
        setErrorMessage(null)
        listMedia(getClientTenantHost())
            .then((result) => {
                if (!active) {
                    return
                }
                setAssets(
                    result.filter(
                        (item) =>
                            item.assetType === 'DOCUMENT' && item.status === 'READY',
                    ),
                )
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
    }, [reloadToken, router])

    if (isLoading) {
        return (
            <PageStack>
                <PageHeader
                    eyebrow="Medien"
                    title="Bonusdateien"
                    description="Dokumente aus der Mediathek. Hänge sie über DIGITAL_ASSET an ein Paket — Abonnenten sehen sie unter Bonusdateien."
                />
                <p className="text-sm text-muted-foreground" role="status">Wird geladen…</p>
                <div className="grid gap-4" aria-hidden="true">
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                </div>
            </PageStack>
        )
    }

    const assetItems: EntityListViewItem[] = assets.map((asset) => ({
        id: asset.id,
        title: asset.originalFilename ?? `Datei #${asset.id}`,
        description: `${asset.mimeType ?? 'Dokument'} · ${formatBytes(asset.sizeBytes)}`,
        trailing: <Badge variant="secondary">Bereit</Badge>,
        actions: (
            <Button
                nativeButton={false}
                render={<Link href="/manage/products" />}
                variant="outline"
            >
                An Paket hängen
            </Button>
        ),
    }))

    return (
        <PageStack>
            <PageHeader
                eyebrow="Medien"
                title="Bonusdateien"
                description="Dokumente aus der Mediathek. Hänge sie über DIGITAL_ASSET an ein Paket — Abonnenten sehen sie unter Bonusdateien."
                actions={
                    <Button nativeButton={false} render={<Link href="/media" />} size="lg">
                        Zur Mediathek
                    </Button>
                }
            />
            {errorMessage !== null && (
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
            )}
            {assets.length === 0 ? (
                <EmptyState
                    title="Noch keine Bonusdateien"
                    description="Lade ein PDF in der Mediathek hoch. Danach verknüpfst du es in den Produktregeln."
                    action={
                        <div className="flex flex-wrap justify-center gap-2">
                            <Button nativeButton={false} render={<Link href="/media" />}>
                                Datei hochladen
                            </Button>
                            <Button
                                nativeButton={false}
                                render={<Link href="/manage/products" />}
                                variant="outline"
                            >
                                Zu den Produkten
                            </Button>
                        </div>
                    }
                />
            ) : (
                <section aria-labelledby="bonus-files-heading" className="flex flex-col gap-4">
                    <SectionHeader
                        id="bonus-files-heading"
                        title={`Verfügbare Dateien (${assets.length})`}
                        description="Nur bereite Dokumente. Wähle ein Paket, um eine Datei per Zugriffsregel freizuschalten."
                    />
                <EntityListSection
                    items={assetItems}
                    onViewModeChange={setViewMode}
                    showSelection={false}
                    viewMode={viewMode}
                />
                </section>
            )}
        </PageStack>
    )
}
