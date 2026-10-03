'use client'

import {useEffect, useState} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Badge} from '@directwerk/ui/components/badge'
import {Button} from '@directwerk/ui/components/button'
import SectionHeader from '@directwerk/ui/components/section-header'
import {Skeleton} from '@directwerk/ui/components/skeleton'
import StatCard from '@directwerk/ui/components/stat-card'

import LocaleLink from '@/components/i18n/LocaleLink'
import {useDictionary} from '@/components/i18n/LocaleProvider'
import {getIntegrationsStatus} from '@/lib/api/integrationsApi'
import {getStorageSummary} from '@/lib/api/mediaApi'
import {t} from '@/lib/i18n/dictionary'
import {apiErrorStatus} from '@directwerk/api/envelope'
import {formatBytes} from '@directwerk/api/format/bytes'
import type {IntegrationsStatus, MediaStorageSummary} from '@directwerk/api/types'
import {getClientTenantHost} from '@directwerk/api/tenant'
import {useAuthRequired} from '@directwerk/api/auth/useAuthRequired'

function stripeLabel(
    status: string,
    home: {
        statusNotConnected: string
        statusRestricted: string
        statusSetupOpen: string
    },
): string {
    switch (status) {
        case 'CONNECTED':
            return 'Verbunden'
        case 'RESTRICTED':
            return home.statusRestricted
        case 'PENDING':
            return home.statusSetupOpen
        case 'NOT_CONNECTED':
            return home.statusNotConnected
        default:
            return status
    }
}

export default function OverviewOpsWidgets(): React.JSX.Element {
    const dict = useDictionary()
    const home = dict.shell.home
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
                        : home.storageLoadFailed,
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
                        : dict.settings.integrationenKonntenGeladen,
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
    }, [
        authRedirect,
        dict.settings.integrationenKonntenGeladen,
        home.storageLoadFailed,
        reloadToken,
    ])

    const mailgun = integrations?.emailNotify.mailgun ?? null
    const mailgunConnected = mailgun?.status === 'CONNECTED'

    return (
        <section aria-labelledby="overview-ops-heading" className="flex flex-col gap-4">
            <SectionHeader
                description={home.opsDescription}
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
                        {dict.common.retry}
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
                            storage === null
                                ? null
                                : t(home.filesCount, {
                                      'storage.totalAssets': storage.totalAssets,
                                  })
                        }
                        hint={
                            storage === null
                                ? home.noData
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
                                : t(home.templatesCount, {
                                      'integrations.emailNotify.customTemplateCount':
                                          integrations.emailNotify.customTemplateCount,
                                  })
                        }
                        hint={
                            integrationsForbidden
                                ? home.tenantAdminsOnly
                                : integrations?.emailNotify.moduleEnabled === true
                                  ? home.moduleActive
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
                                    render={<LocaleLink href="/settings/integrations" />}
                                    size="sm"
                                    variant="outline"
                                >
                                    {dict.nav.verwaltung.integrations}
                                </Button>
                            )
                        }
                        hint={
                            mailgun === null
                                ? home.notConnectedYet
                                : t(home.mailgunDomainRegion, {
                                      'mailgun.domain': mailgun.domain,
                                      'mailgun.region': mailgun.region,
                                  })
                        }
                        label="Mailgun"
                        value={
                            integrationsForbidden
                                ? '—'
                                : mailgunConnected
                                  ? 'Verbunden'
                                  : home.statusNotConnected
                        }
                    />
                    <StatCard
                        footer={
                            integrationsForbidden || integrations === null ? null : (
                                <Badge variant="secondary">
                                    {integrations.stripe.chargesEnabled
                                        ? home.paymentsOn
                                        : home.paymentsOff}
                                </Badge>
                            )
                        }
                        hint={
                            integrations?.stripe.moduleEnabled === false
                                ? 'Modul aus'
                                : (integrations?.stripe.message ?? undefined)
                        }
                        label={dict.nav.verwaltung.stripe}
                        value={
                            integrationsForbidden || integrations === null
                                ? '—'
                                : stripeLabel(integrations.stripe.status, home)
                        }
                    />
                </div>
            )}
        </section>
    )
}
