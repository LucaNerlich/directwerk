'use client'

import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {useEffect, useState} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Button} from '@directwerk/ui/components/button'
import EmptyState from '@directwerk/ui/components/empty-state'
import FeatureCard from '@directwerk/ui/components/feature-card'
import PageHeader from '@directwerk/ui/components/page-header'
import PageStack from '@directwerk/ui/components/page-stack'

import {CardGridSkeleton} from '@/components/ContentLoadingSkeleton'
import {assetTypeLabel} from '@/lib/format/content'
import {listMyDownloads} from '@/lib/api/client'
import {userFacingDownloadsError} from '@/lib/billing/userFacingBillingError'
import {formatBytes} from '@directwerk/api/format/bytes'
import {isAllowedFeedUrl} from '@directwerk/api/validation/primitives'
import type {SubscriberDownload} from '@directwerk/api/types'
import {getWebClientTenantHost} from '@/lib/tenant/clientHost'
import {useAuthRequired} from '@directwerk/api/auth/useAuthRequired'

function packageHint(item: SubscriberDownload): string | null {
    const record = item as unknown as Record<string, unknown>
    const candidates = [
        record.packageTitle,
        record.packageName,
        record.productTitle,
    ]
    for (const candidate of candidates) {
        if (typeof candidate === 'string' && candidate.trim().length > 0) {
            return candidate.trim()
        }
    }
    return null
}

/**
 * Displays subscriber downloads and their associated package information.
 */
export default function DownloadsPage(): React.JSX.Element {
    const router = useRouter()
    const authRedirect = useAuthRequired()
    const tenantHost = getWebClientTenantHost()
    const [downloads, setDownloads] = useState<SubscriberDownload[]>([])
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        let active = true
        listMyDownloads(tenantHost)
            .then((items) => {
                if (active) {
                    setDownloads(items)
                    setIsLoading(false)
                }
            })
            .catch((error: unknown) => {
                if (!active) {
                    return
                }
                if (authRedirect(error)) return
                setErrorMessage(userFacingDownloadsError(error))
                setIsLoading(false)
            })
        return () => {
            active = false
        }
    }, [router, tenantHost, authRedirect])

    return (
        <PageStack className="page-container">
            <PageHeader
                title="Bonusdateien"
                description="PDFs und andere Dateien, die dein Abo freischaltet. Downloads sind an dein Konto gebunden."
            />
            {isLoading ? <CardGridSkeleton cards={4} columns={2} /> : null}
            {errorMessage !== null ? (
                <Alert variant="destructive">
                    <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
            ) : null}
            {!isLoading && errorMessage === null && downloads.length === 0 ? (
                <EmptyState
                    title="Noch keine Bonusdateien"
                    description="Bonusdateien gibt es nur mit bestimmten Paketen — Stufen allein schalten keine Downloads frei. Sobald ein Paket eine Datei freischaltet, erscheint sie hier."
                    action={
                        <Button nativeButton={false} render={<Link href="/pricing" />}>
                            Tarife ansehen
                        </Button>
                    }
                />
            ) : null}
            {downloads.length > 0 ? (
                <>
                    <p className="text-sm text-muted-foreground">
                        {downloads.length}{' '}
                        {downloads.length === 1 ? 'Datei' : 'Dateien'} verfügbar.
                        Bonusdateien werden über Pakete freigeschaltet.
                    </p>
                    <ul className="grid gap-4 sm:grid-cols-2">
                        {downloads.map((item) => {
                            const sizeLabel = formatBytes(item.sizeBytes)
                            const unlockedBy = packageHint(item)
                            // Signed download URLs are validated before render
                            // so a compromised record cannot turn the button
                            // into a javascript:/data: link.
                            const safeDownloadUrl = isAllowedFeedUrl(item.downloadUrl)
                                ? item.downloadUrl
                                : null
                            return (
                                <li key={item.id}>
                                    <FeatureCard
                                        description={
                                            <>
                                                {assetTypeLabel(item.assetType)}
                                                {item.mimeType !== null ? ` · ${item.mimeType}` : ''}
                                                {sizeLabel !== null ? ` · ${sizeLabel}` : ''}
                                            </>
                                        }
                                        title={item.title}
                                    >
                                        <p className="text-sm text-muted-foreground">
                                            {unlockedBy !== null ? (
                                                <>
                                                    Freigeschaltet über Paket:{' '}
                                                    <strong>{unlockedBy}</strong>
                                                </>
                                            ) : (
                                                'Über ein Paket freigeschaltet.'
                                            )}
                                        </p>
                                        {safeDownloadUrl !== null ? (
                                        <Button
                                            nativeButton={false}
                                            render={
                                                <a href={safeDownloadUrl} rel="noreferrer" />
                                            }
                                            size="sm"
                                            variant="outline"
                                        >
                                            Herunterladen
                                        </Button>
                                        ) : (
                                            <p className="text-sm text-muted-foreground" role="alert">
                                                Download-Link ungültig.
                                            </p>
                                        )}
                                    </FeatureCard>
                                </li>
                            )
                        })}
                    </ul>
                </>
            ) : null}
        </PageStack>
    )
}
