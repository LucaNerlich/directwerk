'use client'

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
import type {TenantDomain} from '@directwerk/api/types'
import {useRouter} from 'next/navigation'
import {useCallback, useEffect, useState} from 'react'

import DomainVerificationWizard from '@/components/settings/DomainVerificationWizard'
import {useDictionary} from '@/components/i18n/LocaleProvider'
import {t} from '@/lib/i18n/dictionary'
import {listDomains} from '@/lib/api/tenantSettingsApi'
import {useAuthRequired} from '@directwerk/api/auth/useAuthRequired'

export default function DomainsClient(): React.JSX.Element {
    const dict = useDictionary()
    const s = dict.settings
    const router = useRouter()
    const authRedirect = useAuthRequired()
    const [domains, setDomains] = useState<TenantDomain[]>([])
    const [loadError, setLoadError] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [wizardOpen, setWizardOpen] = useState(false)
    const [wizardHost, setWizardHost] = useState<string | null>(null)
    const [statusMessage, setStatusMessage] = useState<string | null>(null)
    const {viewMode, setViewMode} = useListViewMode()

    const reload = useCallback(async (): Promise<void> => {
        const result = await listDomains()
        setDomains(result)
    }, [])

    useEffect(() => {
        let active = true

        reload()
            .then(() => {
                if (!active) {
                    return
                }
                setIsLoading(false)
            })
            .catch((error: unknown) => {
                if (!active) {
                    return
                }
                if (authRedirect(error)) return
                setLoadError(
                    error instanceof Error ? error.message : s.domainsKonntenGeladen,
                )
                setIsLoading(false)
            })

        return () => {
            active = false
        }
    }, [reload, router, authRedirect, s.domainsKonntenGeladen])

    function openAddWizard(): void {
        setStatusMessage(null)
        setWizardHost(null)
        setWizardOpen(true)
    }

    function openVerifyWizard(host: string): void {
        setStatusMessage(null)
        setWizardHost(host)
        setWizardOpen(true)
    }

    async function handleWizardComplete(host: string): Promise<void> {
        setWizardOpen(false)
        setWizardHost(null)
        setStatusMessage(t(s.wizardVerified, {host}))
        try {
            await reload()
        } catch (error: unknown) {
            if (authRedirect(error)) return
            setLoadError(
                error instanceof Error ? error.message : s.domainsKonntenGeladen,
            )
        }
    }

    if (isLoading) {
        return (
            <PageStack>
                <PageHeader
                    eyebrow={dict.nav.verwaltung.settings}
                    title={dict.nav.verwaltung.domains}
                    description={s.eigeneDomainsOeffentlicheWebsiteErstPruefen}
                />
                <p className="text-sm text-muted-foreground" role="status">
                    {dict.common.loading}
                </p>
                <Skeleton className="h-20 w-full" />
            </PageStack>
        )
    }

    if (loadError !== null) {
        return (
            <PageStack>
                <PageHeader
                    eyebrow={dict.nav.verwaltung.settings}
                    title={dict.nav.verwaltung.domains}
                    description={s.eigeneDomainsOeffentlicheWebsiteErstPruefen}
                />
                <Alert variant="destructive">
                    <AlertDescription>{loadError}</AlertDescription>
                </Alert>
            </PageStack>
        )
    }

    const domainItems: EntityListViewItem[] = domains.map((domain) => ({
        id: domain.host,
        title: domain.host,
        description: domain.primary
            ? s.primaereDomainStandardadresseDeinerWebsite
            : s.sekundaereDomainLeitetPrimaere,
        trailing: (
            <Badge variant={domain.verified ? 'default' : 'outline'}>
                {domain.verified ? s.wizardBadgeVerified : s.wizardBadgeOpen}
            </Badge>
        ),
        actions: !domain.verified ? (
            <Button
                onClick={() => {
                    openVerifyWizard(domain.host)
                }}
                size="sm"
                type="button"
            >
                {s.wizardVerifyAction}
            </Button>
        ) : undefined,
    }))

    return (
        <PageStack>
            <PageHeader
                eyebrow={dict.nav.verwaltung.settings}
                title={dict.nav.verwaltung.domains}
                description={s.eigeneDomainsOeffentlicheWebsiteLegeZuerst}
            />

            {statusMessage ? (
                <Alert role="status">
                    <AlertDescription>{statusMessage}</AlertDescription>
                </Alert>
            ) : null}

            {wizardOpen ? (
                <DomainVerificationWizard
                    initialHost={wizardHost}
                    onAuthError={authRedirect}
                    onCancel={() => {
                        setWizardOpen(false)
                        setWizardHost(null)
                    }}
                    onComplete={(host) => {
                        void handleWizardComplete(host)
                    }}
                />
            ) : (
                <>
                    {domains.length === 0 ? (
                        <EmptyState
                            title={s.keineDomains}
                            description={s.fuegeUntenErsteDomainHinzu}
                            action={
                                <Button onClick={openAddWizard} type="button">
                                    {s.domainHinzufuegen}
                                </Button>
                            }
                        />
                    ) : (
                        <section aria-labelledby="domains-list-heading" className="flex flex-col gap-4">
                            <div className="flex flex-wrap items-end justify-between gap-3">
                                <SectionHeader
                                    id="domains-list-heading"
                                    title={t(s.domains, {'domains.length': domains.length})}
                                    description={s.verifizierteDomainsLiveOffeneBrauchenDns}
                                />
                                <Button onClick={openAddWizard} type="button">
                                    {s.domainHinzufuegen}
                                </Button>
                            </div>
                            <EntityListSection
                                items={domainItems}
                                onViewModeChange={setViewMode}
                                showSelection={false}
                                viewMode={viewMode}
                            />
                        </section>
                    )}
                </>
            )}
        </PageStack>
    )
}
