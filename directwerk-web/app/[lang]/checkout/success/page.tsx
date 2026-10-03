'use client'

import Link from 'next/link'
import {useRouter, useSearchParams} from 'next/navigation'
import {Suspense, useEffect, useState} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {buttonVariants, Button} from '@directwerk/ui/components/button'
import PageHeader from '@directwerk/ui/components/page-header'
import PageStack from '@directwerk/ui/components/page-stack'

import {getAccess, listMySubscriptions} from '@/lib/api/client'
import {AUTH_REQUIRED} from '@directwerk/api/constants'
import type {Access, SubscriptionSummary} from '@directwerk/api/types'
import {getWebClientTenantHost} from '@/lib/tenant/clientHost'
import {userFacingBillingError} from '@/lib/billing/userFacingBillingError'
import {useDictionary, useLocale} from '@/lib/i18n/LocaleProvider'
import {interpolate} from '@/lib/i18n/interpolate'
import {localizedPath} from '@/lib/i18n/paths'

const POLL_MS = 2000
const MAX_ATTEMPTS = 30
const SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/

function hasGrantedAccess(
    access: Access | null,
    subscriptions: SubscriptionSummary[],
): boolean {
    if (access !== null && access.maxLevelSortOrder !== null) {
        return true
    }
    if (access !== null && access.activeLevels.length > 0) {
        return true
    }
    return subscriptions.some((item) => item.status === 'ACTIVE')
}

function CheckoutSuccessContent(): React.JSX.Element {
    const router = useRouter()
    const lang = useLocale()
    const {billing, common, errors, nav} = useDictionary()
    const searchParams = useSearchParams()
    const sessionParam = searchParams.get('session_id') ?? ''
    const sessionId = SESSION_ID_PATTERN.test(sessionParam) ? sessionParam : null
    const [phase, setPhase] = useState<'checking' | 'ready' | 'waiting'>('checking')
    const [error, setError] = useState<string | null>(null)
    const [subscriptions, setSubscriptions] = useState<SubscriptionSummary[]>([])
    const [round, setRound] = useState(0)

    useEffect(() => {
        let cancelled = false
        let attempts = 0
        let timer: ReturnType<typeof setTimeout> | undefined

        async function poll(): Promise<void> {
            try {
                const tenantHost = getWebClientTenantHost()
                const [accessResponse, subscriptionList] = await Promise.all([
                    getAccess(tenantHost),
                    listMySubscriptions(tenantHost),
                ])
                if (cancelled) {
                    return
                }
                setSubscriptions(subscriptionList)
                setError(null)
                if (hasGrantedAccess(accessResponse.data, subscriptionList)) {
                    setPhase('ready')
                    return
                }
            } catch (pollError: unknown) {
                if (cancelled) {
                    return
                }
                if (
                    pollError instanceof Error &&
                    pollError.message === AUTH_REQUIRED
                ) {
                    router.replace(localizedPath(lang, '/login'))
                    return
                }
                setError(userFacingBillingError(pollError, 'checkout', errors))
            }

            attempts += 1
            if (attempts >= MAX_ATTEMPTS) {
                if (!cancelled) {
                    setPhase('waiting')
                }
                return
            }
            timer = setTimeout(() => {
                void poll()
            }, POLL_MS)
        }

        setPhase('checking')
        void poll()
        return () => {
            cancelled = true
            if (timer !== undefined) {
                clearTimeout(timer)
            }
        }
    }, [errors, lang, round, router])

    function retry(): void {
        setError(null)
        setPhase('checking')
        setRound((current) => current + 1)
    }

    const activeSubscriptions = subscriptions.filter(
        (item) => item.status === 'ACTIVE',
    )

    return (
        <PageStack className="page-container">
            <PageHeader
                title={billing.successTitle}
                description={
                    phase === 'ready'
                        ? billing.successDescReady
                        : phase === 'waiting'
                          ? billing.successDescWaiting
                          : billing.successDescChecking
                }
            />
            <div role="status" aria-live="polite" aria-busy={phase === 'checking'} className="max-w-xl space-y-3 text-sm leading-6 text-muted-foreground">
                {phase === 'checking' ? (
                    <p className="flex items-center gap-2 font-medium text-foreground">
                        <span
                            aria-hidden="true"
                            className="size-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none"
                        />
                        {billing.successChecking}
                    </p>
                ) : null}
                <p>
                    {phase === 'ready'
                        ? billing.successBodyReady
                        : billing.successBodyPending}
                </p>
                {sessionId !== null ? (
                    <p>
                        {billing.orderReference}{' '}
                        <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
                            {sessionId.slice(0, 16)}…
                        </code>
                    </p>
                ) : null}
                {phase === 'ready' && activeSubscriptions.length > 0 ? (
                    <ul className="list-disc space-y-1 pl-5 text-foreground">
                        {activeSubscriptions.map((item) => (
                            <li key={item.id}>
                                {item.productTitle}
                                {item.source.length > 0 ? ` (${item.source})` : null}
                            </li>
                        ))}
                    </ul>
                ) : null}
            </div>
            {error !== null ? (
                <Alert variant="destructive" role="alert">
                    <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <span>{error}</span>
                        <Button type="button" variant="outline" size="sm" onClick={retry}>
                            {common.retryCheck}
                        </Button>
                    </AlertDescription>
                </Alert>
            ) : null}
            {phase === 'waiting' ? (
                <Alert role="status">
                    <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <span>{billing.successWaitingAlert}</span>
                        <Button type="button" variant="outline" size="sm" onClick={retry}>
                            {common.retryCheck}
                        </Button>
                    </AlertDescription>
                </Alert>
            ) : null}
            <div className="flex flex-wrap gap-3">
                <Link className={buttonVariants()} href={localizedPath(lang, '/account')}>
                    {nav.toAccount}
                </Link>
                <Link className={buttonVariants({variant: 'outline'})} href={localizedPath(lang, '/downloads')}>
                    {nav.downloads}
                </Link>
            </div>
        </PageStack>
    )
}

export default function CheckoutSuccessPage(): React.JSX.Element {
    const {billing, common} = useDictionary()
    return (
        <Suspense
            fallback={
                <PageStack className="page-container">
                    <PageHeader
                        title={billing.successTitle}
                        description={billing.successDescChecking}
                    />
                    <p role="status" className="text-sm text-muted-foreground">
                        {common.checking}
                    </p>
                </PageStack>
            }
        >
            <CheckoutSuccessContent />
        </Suspense>
    )
}
