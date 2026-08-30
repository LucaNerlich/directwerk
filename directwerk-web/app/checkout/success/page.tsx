'use client'

import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {useEffect, useState} from 'react'

import {buttonVariants} from '@directwerk/ui/components/button'
import PageHeader from '@directwerk/ui/components/page-header'
import PageStack from '@directwerk/ui/components/page-stack'

import {getAccess, listMySubscriptions} from '@/lib/api/client'
import {AUTH_REQUIRED} from '@directwerk/api/constants'
import type {Access, SubscriptionSummary} from '@directwerk/api/types'
import {getClientTenantHost} from '@/lib/tenant/clientHost'
import {useAuthRequired} from '@directwerk/api/auth/useAuthRequired'

const POLL_MS = 2000
const MAX_ATTEMPTS = 10

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

export default function CheckoutSuccessPage(): React.JSX.Element {
    const router = useRouter()
    const authRedirect = useAuthRequired()
    const [phase, setPhase] = useState<'checking' | 'ready' | 'waiting'>('checking')

    useEffect(() => {
        let cancelled = false
        let attempts = 0
        let timer: ReturnType<typeof setTimeout> | undefined

        async function poll(): Promise<void> {
            try {
                const tenantHost = getClientTenantHost()
                const [accessResponse, subscriptions] = await Promise.all([
                    getAccess(tenantHost),
                    listMySubscriptions(tenantHost),
                ])
                if (cancelled) {
                    return
                }
                if (hasGrantedAccess(accessResponse.data, subscriptions)) {
                    setPhase('ready')
                    return
                }
            } catch (error: unknown) {
                if (cancelled) {
                    return
                }
                if (authRedirect(error)) return
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

        void poll()
        return () => {
            cancelled = true
            if (timer !== undefined) {
                clearTimeout(timer)
            }
        }
    }, [router])

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
            <p className="max-w-xl text-sm leading-6 text-muted-foreground">
                {phase === 'ready'
                    ? 'Du kannst jetzt bezahlte Folgen und Bonusdateien nutzen.'
                    : 'Webhook-Bestätigungen können ein paar Sekunden brauchen. Lade das Konto später neu, falls der Zugang noch fehlt.'}
            </p>
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
