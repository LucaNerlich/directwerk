'use client'

import {useEffect, useMemo, useState} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Button} from '@directwerk/ui/components/button'
import {Skeleton} from '@directwerk/ui/components/skeleton'

import SetupChecklist from '@/components/studio/SetupChecklist'
import {useDictionary} from '@/components/i18n/LocaleProvider'
import {hasDesk, hasModule} from '@/lib/api/client'
import {getIntegrationsStatus} from '@/lib/api/integrationsApi'
import {listEpisodes} from '@/lib/api/podcastApi'
import {listDomains} from '@/lib/api/tenantSettingsApi'
import {listArticles} from '@/lib/api/writeApi'
import {isTenantAdminRole} from '@/lib/api/studioHelpers'
import {useOptionalMe} from '@/lib/auth/MeProvider'
import {t} from '@/lib/i18n/dictionary'
import {useSiteConfig} from '@/lib/site/SiteConfigProvider'
import {
    isShowOpsPreferred,
    isTenantSetupDismissed,
    setShowOpsPreferred,
    setTenantSetupDismissed,
} from '@/lib/studio/setupPreferences'
import {
    buildTenantSetupSteps,
    evaluateTenantSetupSignals,
    isTenantSetupComplete,
} from '@/lib/studio/tenantSetup'
import {apiErrorStatus} from '@directwerk/api/envelope'
import type {IntegrationsStatus, TenantDomain} from '@directwerk/api/types'
import {useAuthRequired} from '@directwerk/api/auth/useAuthRequired'

export default function TenantSetupChecklist({
    onOpsVisibilityChange,
}: {
    onOpsVisibilityChange?: (showOps: boolean) => void
}): React.JSX.Element | null {
    const dict = useDictionary()
    const setup = dict.shell.home.setup
    const config = useSiteConfig()
    const me = useOptionalMe()
    const authRedirect = useAuthRequired()
    const isAdmin = me !== null && isTenantAdminRole(me.roles)

    const [domains, setDomains] = useState<TenantDomain[] | null>(null)
    const [integrations, setIntegrations] = useState<IntegrationsStatus | null>(null)
    const [hasPublishedContent, setHasPublishedContent] = useState(false)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [dismissed, setDismissed] = useState(false)
    const [showOps, setShowOps] = useState(false)
    const [forceExpanded, setForceExpanded] = useState(false)
    const [reloadToken, setReloadToken] = useState(0)

    useEffect(() => {
        setDismissed(isTenantSetupDismissed())
        setShowOps(isShowOpsPreferred())
    }, [])

    useEffect(() => {
        if (!isAdmin) {
            onOpsVisibilityChange?.(true)
            setIsLoading(false)
            return
        }

        let active = true
        setIsLoading(true)
        setErrorMessage(null)

        const loadPublished = async (): Promise<boolean> => {
            const tasks: Promise<boolean>[] = []
            if (hasDesk(config, 'WRITE')) {
                tasks.push(
                    listArticles().then((articles) =>
                        articles.some((article) => article.status === 'PUBLISHED'),
                    ),
                )
            }
            if (hasDesk(config, 'PODCAST')) {
                tasks.push(
                    listEpisodes().then((episodes) =>
                        episodes.some((episode) => episode.status === 'PUBLISHED'),
                    ),
                )
            }
            if (tasks.length === 0) {
                return false
            }
            const results = await Promise.all(tasks)
            return results.some(Boolean)
        }

        void Promise.allSettled([
            listDomains(),
            hasModule(config, 'STRIPE_BILLING') || hasModule(config, 'EMAIL_NOTIFY')
                ? getIntegrationsStatus()
                : Promise.resolve(null),
            loadPublished(),
        ]).then(([domainsResult, integrationsResult, publishedResult]) => {
            if (!active) {
                return
            }

            const errors: string[] = []

            if (domainsResult.status === 'fulfilled') {
                setDomains(domainsResult.value)
            } else {
                if (authRedirect(domainsResult.reason)) return
                setDomains(null)
                errors.push(
                    domainsResult.reason instanceof Error
                        ? domainsResult.reason.message
                        : setup.loadFailed,
                )
            }

            if (integrationsResult.status === 'fulfilled') {
                setIntegrations(integrationsResult.value)
            } else if (apiErrorStatus(integrationsResult.reason) === 403) {
                setIntegrations(null)
            } else {
                if (authRedirect(integrationsResult.reason)) return
                setIntegrations(null)
                errors.push(
                    integrationsResult.reason instanceof Error
                        ? integrationsResult.reason.message
                        : setup.loadFailed,
                )
            }

            if (publishedResult.status === 'fulfilled') {
                setHasPublishedContent(publishedResult.value)
            } else {
                if (authRedirect(publishedResult.reason)) return
                setHasPublishedContent(false)
                errors.push(
                    publishedResult.reason instanceof Error
                        ? publishedResult.reason.message
                        : setup.loadFailed,
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
    }, [authRedirect, config, isAdmin, onOpsVisibilityChange, reloadToken, setup.loadFailed])

    const signals = useMemo(
        () =>
            evaluateTenantSetupSignals({
                config,
                domains,
                hasPublishedContent,
                integrations,
            }),
        [config, domains, hasPublishedContent, integrations],
    )

    const steps = useMemo(
        () => buildTenantSetupSteps(signals, dict, config),
        [config, dict, signals],
    )
    const complete = isTenantSetupComplete(steps)

    useEffect(() => {
        if (!isAdmin) {
            return
        }
        const shouldShowOps = complete || showOps
        onOpsVisibilityChange?.(shouldShowOps)
    }, [complete, isAdmin, onOpsVisibilityChange, showOps])

    if (!isAdmin) {
        return null
    }

    if (dismissed && complete) {
        return null
    }

    if (isLoading) {
        return (
            <div aria-busy="true" className="flex flex-col gap-3">
                <Skeleton className="h-8 w-64" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
            </div>
        )
    }

    if (errorMessage !== null) {
        return (
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
        )
    }

    const doneCount = steps.filter((step) => step.done).length

    return (
        <SetupChecklist
            actions={
                <div className="flex flex-wrap gap-2">
                    {!showOps && !complete ? (
                        <Button
                            onClick={() => {
                                setShowOps(true)
                                setShowOpsPreferred(true)
                                onOpsVisibilityChange?.(true)
                            }}
                            size="sm"
                            type="button"
                            variant="outline"
                        >
                            {setup.showOps}
                        </Button>
                    ) : null}
                    {complete ? (
                        <Button
                            onClick={() => {
                                setDismissed(true)
                                setTenantSetupDismissed(true)
                            }}
                            size="sm"
                            type="button"
                            variant="outline"
                        >
                            {setup.dismiss}
                        </Button>
                    ) : null}
                </div>
            }
            activatePrimary
            collapsed={complete && !forceExpanded}
            collapsedSummary={setup.completeSummary}
            description={t(setup.description, {
                done: doneCount,
                total: steps.length,
            })}
            id="tenant-setup-heading"
            onExpand={
                complete
                    ? () => {
                          setForceExpanded(true)
                          setDismissed(false)
                          setTenantSetupDismissed(false)
                      }
                    : undefined
            }
            steps={steps}
            title={setup.title}
        />
    )
}
