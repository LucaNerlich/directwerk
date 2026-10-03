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
import {useDictionary, useLocale} from '@/lib/i18n/LocaleProvider'
import {interpolate} from '@/lib/i18n/interpolate'
import {localizedPath} from '@/lib/i18n/paths'
import {AUTH_REQUIRED} from '@directwerk/api/constants'

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
    const lang = useLocale()
    const {common, downloads: copy, errors, format, nav} = useDictionary()
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
                if (error instanceof Error && error.message === AUTH_REQUIRED) {
                    router.replace(localizedPath(lang, '/login'))
                    return
                }
                setErrorMessage(userFacingDownloadsError(error, errors))
                setIsLoading(false)
            })
        return () => {
            active = false
        }
    }, [errors, lang, router, tenantHost])

    return (
        <PageStack className="page-container">
            <PageHeader
                title={copy.title}
                description={copy.description}
            />
            {isLoading ? <CardGridSkeleton cards={4} columns={2} /> : null}
            {errorMessage !== null ? (
                <Alert variant="destructive">
                    <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
            ) : null}
            {!isLoading && errorMessage === null && downloads.length === 0 ? (
                <EmptyState
                    title={copy.emptyTitle}
                    description={copy.emptyDescription}
                    action={
                        <Button nativeButton={false} render={<Link href={localizedPath(lang, '/pricing')} />}>
                            {nav.viewPlans}
                        </Button>
                    }
                />
            ) : null}
            {downloads.length > 0 ? (
                <>
                    <p className="text-sm text-muted-foreground">
                        {interpolate(copy.downloadsCountAvailable, {
                            count: downloads.length,
                            noun:
                                downloads.length === 1
                                    ? copy.nounFile
                                    : copy.nounFiles,
                        })}{' '}
                        {copy.downloadsCountHint}
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
                                                {assetTypeLabel(item.assetType, format)}
                                                {item.mimeType !== null ? ` · ${item.mimeType}` : ''}
                                                {sizeLabel !== null ? ` · ${sizeLabel}` : ''}
                                            </>
                                        }
                                        title={item.title}
                                    >
                                        <p className="text-sm text-muted-foreground">
                                            {unlockedBy !== null ? (
                                                <>
                                                    {copy.unlockedViaPackage}{' '}
                                                    <strong>{unlockedBy}</strong>
                                                </>
                                            ) : (
                                                copy.unlockedGeneric
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
                                            {common.download}
                                        </Button>
                                        ) : (
                                            <p className="text-sm text-muted-foreground" role="alert">
                                                {copy.invalidDownloadLink}
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
