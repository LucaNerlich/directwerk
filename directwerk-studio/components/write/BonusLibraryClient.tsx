'use client'

import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {useEffect, useState} from 'react'

import {Button} from '@directwerk/ui/components/button'
import EmptyState from '@directwerk/ui/components/empty-state'
import PageHeader from '@directwerk/ui/components/page-header'

import {listMedia} from '@/lib/api/tenantApi'
import type {MediaAsset} from '@directwerk/api/types'
import {getClientTenantHost} from '@/lib/tenant/getClientTenantHost'
import {useAuthRequired} from '@directwerk/api/auth/useAuthRequired'

/**
 * Lists READY document assets as the studio bonus-file library.
 */
export default function BonusLibraryClient(): React.JSX.Element {
    const router = useRouter()
    const authRedirect = useAuthRequired()
    const [assets, setAssets] = useState<MediaAsset[]>([])
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        let active = true
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
    }, [router])

    if (isLoading) {
        return <p>Wird geladen…</p>
    }

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                eyebrow="Schreiben"
                title="Bonusdateien"
                description="Dokumente aus der Mediathek. Hänge sie über DIGITAL_ASSET an ein Paket — Abonnenten sehen sie unter Bonusdateien."
                actions={
                    <Button nativeButton={false} render={<Link href="/media" />} size="lg">
                        Zur Mediathek
                    </Button>
                }
            />
            {errorMessage !== null ? (
                <p className="text-sm text-destructive" role="alert">
                    {errorMessage}
                </p>
            ) : null}
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
                <ul className="overflow-hidden rounded-xl border bg-card divide-y">
                    {assets.map((asset) => (
                        <li className="flex items-center justify-between gap-4 p-4" key={asset.id}>
                            <div>
                                <p className="font-medium">
                                    {asset.originalFilename ?? `Datei #${asset.id}`}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    {asset.mimeType ?? 'Dokument'} · Asset #{asset.id}
                                </p>
                            </div>
                            <Button
                                nativeButton={false}
                                render={<Link href="/manage/products" />}
                                variant="outline"
                            >
                                An Paket hängen
                            </Button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )
}
