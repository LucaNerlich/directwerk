'use client'

import {useEffect, useState} from 'react'

import {Badge} from '@directwerk/ui/components/badge'
import {Button} from '@directwerk/ui/components/button'
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@directwerk/ui/components/card'
import {Skeleton} from '@directwerk/ui/components/skeleton'
import {getPlatformData} from '@/lib/api/client'
import type {PlatformBranding} from '@directwerk/api/types'

export default function TenantAnalyticsCard({tenantId}: {tenantId: string}): React.JSX.Element {
    const [branding, setBranding] = useState<PlatformBranding | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [reloadKey, setReloadKey] = useState(0)

    useEffect(() => {
        let active = true
        setBranding(null)
        setError(null)
        setIsLoading(true)
        getPlatformData<PlatformBranding>(`tenants/${tenantId}/branding`)
            .then((result) => {
                if (!active) return
                setError(null)
                setBranding(result)
                setIsLoading(false)
            })
            .catch(() => {
                if (!active) return
                setError('Analytics config unavailable.')
                setIsLoading(false)
            })
        return () => {
            active = false
        }
    }, [tenantId, reloadKey])

    const trackingEnabled = branding?.umamiWebsiteId != null

    return (
        <Card aria-labelledby="tenant-analytics-heading" role="region">
            <CardHeader>
                <CardTitle id="tenant-analytics-heading">Analytics (read-only)</CardTitle>
                <CardDescription>
                    Platform view of the tenant Umami configuration. Tracking
                    itself is managed in directwerk-studio under Branding.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {error ? (
                    <>
                        <p className="text-sm text-destructive" role="alert">
                            {error}
                        </p>
                        <div className="mt-2">
                            <Button onClick={() => setReloadKey((value) => value + 1)} type="button" variant="outline">
                                Retry
                            </Button>
                        </div>
                    </>
                ) : null}
                {!error && isLoading ? (
                    <>
                        <div aria-hidden="true" className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Skeleton className="h-4 w-24" />
                                <Skeleton className="h-5 w-40" />
                            </div>
                            <div className="space-y-2">
                                <Skeleton className="h-4 w-24" />
                                <Skeleton className="h-5 w-40" />
                            </div>
                        </div>
                        <p aria-live="polite" className="mt-2 text-sm text-muted-foreground">
                            Loading…
                        </p>
                    </>
                ) : null}
                {branding ? (
                    <dl className="grid gap-4 sm:grid-cols-2 [&_dd]:mt-1 [&_dt]:text-sm [&_dt]:font-medium [&_dt]:text-muted-foreground">
                        <div>
                            <dt>Website ID</dt>
                            <dd>{branding.umamiWebsiteId ?? '—'}</dd>
                        </div>
                        <div>
                            <dt>Umami host</dt>
                            <dd>{branding.umamiHostUrl ?? 'Platform default'}</dd>
                        </div>
                        <div>
                            <dt>Status</dt>
                            <dd>
                                <Badge variant={trackingEnabled ? 'default' : 'outline'}>
                                    {trackingEnabled ? 'Tracking enabled' : 'Disabled'}
                                </Badge>
                            </dd>
                        </div>
                    </dl>
                ) : null}
                {branding && !trackingEnabled ? (
                    <p className="mt-3 text-sm text-muted-foreground">
                        Tracking is disabled. Tenant admins enable it in
                        directwerk-studio under Branding.
                    </p>
                ) : null}
            </CardContent>
        </Card>
    )
}
