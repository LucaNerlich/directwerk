'use client'

import {useEffect, useState} from 'react'

import {Card, CardContent, CardHeader, CardTitle} from '@directwerk/ui/components/card'
import {getPlatformData} from '@/lib/api/client'
import type {PlatformBranding} from '@directwerk/api/types'

export default function TenantAnalyticsCard({tenantId}: {tenantId: string}): React.JSX.Element {
    const [branding, setBranding] = useState<PlatformBranding | null>(null)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        let active = true
        getPlatformData<{data: PlatformBranding} | PlatformBranding>(`tenants/${tenantId}/branding`)
            .then((res) => {
                if (!active) return
                const value = (res as {data?: PlatformBranding}).data ?? (res as PlatformBranding)
                setBranding(value)
            })
            .catch(() => {
                if (!active) return
                setError('Analytics config unavailable.')
            })
        return () => {
            active = false
        }
    }, [tenantId])

    return (
        <Card>
            <CardHeader><CardTitle>Analytics (read-only)</CardTitle></CardHeader>
            <CardContent>
                {error ? <p className="text-sm text-destructive">{error}</p> : null}
                {!error && !branding ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
                {branding ? (
                    <dl className="grid gap-4 sm:grid-cols-2 [&_dd]:mt-1 [&_dt]:text-sm [&_dt]:font-medium [&_dt]:text-muted-foreground">
                        <dt>Website-ID</dt>
                        <dd>{branding.umamiWebsiteId ?? '—'}</dd>
                        <dt>Umami-Server</dt>
                        <dd>{branding.umamiHostUrl ?? 'Plattform-Standard'}</dd>
                        <dt>Status</dt>
                        <dd>{branding.umamiWebsiteId ? 'Tracking aktiv (siehe Studio → Branding)' : 'Deaktiviert'}</dd>
                    </dl>
                ) : null}
            </CardContent>
        </Card>
    )
}
