'use client'

import Link from 'next/link'
import {useEffect, useState} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Badge} from '@directwerk/ui/components/badge'
import {Button} from '@directwerk/ui/components/button'
import SectionHeader from '@directwerk/ui/components/section-header'
import {Skeleton} from '@directwerk/ui/components/skeleton'
import StatCard from '@directwerk/ui/components/stat-card'

import {getIntegrationsStatus} from '@/lib/api/integrationsApi'
import {getStorageSummary} from '@/lib/api/mediaApi'
import {apiErrorStatus} from '@directwerk/api/envelope'
import {formatBytes} from '@directwerk/api/format/bytes'
import type {IntegrationsStatus, MediaStorageSummary} from '@directwerk/api/types'
import {getClientTenantHost} from '@directwerk/api/tenant'
import {useAuthRequired} from '@directwerk/api/auth/useAuthRequired'

function stripeLabel(status: string): string {
    switch (status) {
        case 'CONNECTED':
            return 'Verbunden'
        case 'RESTRICTED':
            return 'Eingeschränkt'
        case 'PENDING':
            return 'Einrichtung offen'
        case 'NOT_CONNECTED':
            return 'Nicht verbunden'
        default:
            return status
    }
}

export default function OverviewOpsWidgets(): React.JSX.Element {
    const authRedirect = useAuthRequired()
    const [storage, setStorage] = useState<MediaStorageSummary | null>(null)
    const [integrations, setIntegrations] = useState<IntegrationsStatus | null>(null)
    const [integrationsForbidden, setIntegrationsForbidden] = useState(false)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [reloadToken, setReloadToken] = useState(0)

    useEffect(() => {
        let active = true
        setIsLoading(true)
        setErrorMessage(null)
        setIntegrationsForbidden(false)

        const host = getClientTenantHost()

        void Promise.allSettled([
            getStorageSummary(host),
            getIntegrationsStatus(host),
        ]).then(([storageResult, integrationsResult]) => {
            if (!active) {
                return
            }

            const errors: string[] = []

            if (storageResult.status === 'fulfilled') {
                setStorage(storageResult.value)
            } else {
                if (authRedirect(storageResult.reason)) return
                setStorage(null)
                errors.push(
                    storageResult.reason instanceof Error
                        ? storageResult.reason.message
                        : 'Speicher konnte nicht geladen werden.',
                )
            }

            if (integrationsResult.status === 'fulfilled') {
                setIntegrations(integrationsResult.value)
            } else if (apiErrorStatus(integrationsResult.reason) === 403) {
                setIntegrations(null)
                setIntegrationsForbidden(true)
            } else {
                if (authRedirect(integrationsResult.reason)) return
                setIntegrations(null)
                errors.push(
                    integrationsResult.reason instanceof Error
                        ? integrationsResult.reason.message
                        : 'Integrationen konnten nicht geladen werden.',
                )
            }

            if (errors.length > 0) {
                setErrorMessage(errors.join(' '))
            }
            setIsLoading(false)
        })

        return () => {
            active = false
        }
    }, [authRedirect, reloadToken])

    const mailgun = integrations?.emailNotify.mailgun ?? null
    const mailgunConnected = mailgun?.status === 'CONNECTED'

    return (
        <section aria-labelledby="overview-ops-heading" className="flex flex-col gap-4">
            <SectionHeader
                description="Speicher und Anbindungen auf einen Blick."
                id="overview-ops-heading"
                title="Betrieb"
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
            {isLoading ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-busy="true">
                    <Skeleton className="h-24" />
                    <Skeleton className="h-24" />
                    <Skeleton className="h-24" />
                    <Skeleton className="h-24" />
                </div>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard
                        footer={
                            storage === null ? null : `${storage.totalAssets} Dateien`
                        }
                        hint={
                            storage === null
                                ? 'Keine Daten'
                                : `${storage.buckets.length} Gruppen nach Typ/Status`
                        }
                        label="Medienspeicher"
                        value={
                            storage === null
                                ? '—'
                                : (formatBytes(storage.totalBytes) ?? '0 B')
                        }
                    />
                    <StatCard
                        footer={
                            integrations === null
                                ? null
                                : `${integrations.emailNotify.customTemplateCount} Vorlagen`
                        }
                        hint={
                            integrationsForbidden
                                ? 'Nur für Mandanten-Admins'
                                : integrations?.emailNotify.moduleEnabled === true
                                  ? 'Modul aktiv'
                                  : 'Modul aus'
                        }
                        label="E-Mail-Benachrichtigung"
                        value={
                            integrationsForbidden
                                ? '—'
                                : integrations?.emailNotify.platformSenderReady === true
                                  ? 'Bereit'
                                  : 'Nicht bereit'
                        }
                    />
                    <StatCard
                        footer={
                            integrationsForbidden ? null : (
                                <Button
                                    nativeButton={false}
                                    render={<Link href="/settings/integrations" />}
                                    size="sm"
                                    variant="outline"
                                >
                                    Integrationen
                                </Button>
                            )
                        }
                        hint={
                            mailgun === null
                                ? 'Noch nicht verbunden'
                                : `${mailgun.domain} · ${mailgun.region}`
                        }
                        label="Mailgun"
                        value={
                            integrationsForbidden
                                ? '—'
                                : mailgunConnected
                                  ? 'Verbunden'
                                  : 'Nicht verbunden'
                        }
                    />
                    <StatCard
                        footer={
                            integrationsForbidden || integrations === null ? null : (
                                <Badge variant="secondary">
                                    {integrations.stripe.chargesEnabled
                                        ? 'Zahlungen an'
                                        : 'Zahlungen aus'}
                                </Badge>
                            )
                        }
                        hint={
                            integrations?.stripe.moduleEnabled === false
                                ? 'Modul aus'
                                : (integrations?.stripe.message ?? undefined)
                        }
                        label="Stripe"
                        value={
                            integrationsForbidden || integrations === null
                                ? '—'
                                : stripeLabel(integrations.stripe.status)
                        }
                    />
                </div>
            )}
        </section>
    )
}
