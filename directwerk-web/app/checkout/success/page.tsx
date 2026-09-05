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
import {useAuthRequired} from '@directwerk/api/auth/useAuthRequired'

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
    const searchParams = useSearchParams()
    const authRedirect = useAuthRequired()
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
                if (authRedirect(pollError)) return
                if (
                    pollError instanceof Error &&
                    pollError.message === AUTH_REQUIRED
                ) {
                    router.replace('/login')
                    return
                }
                setError(userFacingBillingError(pollError, 'checkout'))
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
    }, [authRedirect, round, router])

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
                title="Zahlung eingegangen"
                description={
                    phase === 'ready'
                        ? 'Dein Zugang ist aktiv.'
                        : phase === 'waiting'
                          ? 'Die Zahlung ist angekommen. Der Zugang erscheint auf dem Konto, sobald Stripe uns bestätigt.'
                          : 'Wir warten auf die Bestätigung von Stripe — das dauert meist nur wenige Sekunden.'
                }
            />
            <div role="status" aria-live="polite" className="max-w-xl space-y-3 text-sm leading-6 text-muted-foreground">
                <p>
                    {phase === 'ready'
                        ? 'Du kannst jetzt bezahlte Folgen und Bonusdateien nutzen.'
                        : 'Webhook-Bestätigungen können ein paar Sekunden brauchen. Lade das Konto später neu, falls der Zugang noch fehlt.'}
                </p>
                {sessionId !== null ? (
                    <p>
                        Bestellreferenz:{' '}
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
                            Erneut prüfen
                        </Button>
                    </AlertDescription>
                </Alert>
            ) : null}
            {phase === 'waiting' ? (
                <Alert role="status">
                    <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <span>
                            Die Bestätigung dauert länger als üblich. Prüfe später
                            erneut — dein Zugang erscheint automatisch.
                        </span>
                        <Button type="button" variant="outline" size="sm" onClick={retry}>
                            Erneut prüfen
                        </Button>
                    </AlertDescription>
                </Alert>
            ) : null}
            <div className="flex flex-wrap gap-3">
                <Link className={buttonVariants()} href="/account">
                    Zum Konto
                </Link>
                <Link className={buttonVariants({variant: 'outline'})} href="/downloads">
                    Bonusdateien
                </Link>
            </div>
        </PageStack>
    )
}

export default function CheckoutSuccessPage(): React.JSX.Element {
    return (
        <Suspense
            fallback={
                <PageStack className="page-container">
                    <PageHeader
                        title="Zahlung eingegangen"
                        description="Wir warten auf die Bestätigung von Stripe — das dauert meist nur wenige Sekunden."
                    />
                    <p role="status" className="text-sm text-muted-foreground">
                        Wird geprüft…
                    </p>
                </PageStack>
            }
        >
            <CheckoutSuccessContent />
        </Suspense>
    )
}
