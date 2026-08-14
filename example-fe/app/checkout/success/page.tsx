'use client'

import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {useEffect, useState} from 'react'

import {buttonVariants} from '@publish/ui/components/button'
import PageHeader from '@publish/ui/components/page-header'

import {getAccess, listMySubscriptions} from '@/lib/api/client'
import {AUTH_REQUIRED} from '@/lib/api/errors'
import type {Access, SubscriptionSummary} from '@/lib/api/types'
import {getSelectedTenant} from '@/lib/tenantStore'

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
    if (access !== null && access.activePackages.length > 0) {
        return true
    }
    return subscriptions.some((item) => item.status === 'ACTIVE')
}

export default function CheckoutSuccessPage(): React.JSX.Element {
    const router = useRouter()
    const [phase, setPhase] = useState<'checking' | 'ready' | 'waiting'>('checking')

    useEffect(() => {
        let cancelled = false
        let attempts = 0
        let timer: ReturnType<typeof setTimeout> | undefined

        async function poll(): Promise<void> {
            try {
                const tenantHost = getSelectedTenant()
                const [accessResponse, subscriptions] = await Promise.all([
                    getAccess(tenantHost),
                    listMySubscriptions(tenantHost).catch(() => []),
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
                if (error instanceof Error && error.message === AUTH_REQUIRED) {
                    router.replace('/login')
                    return
                }
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
        <div className="page-container space-y-6">
            <PageHeader
                title="Checkout complete"
                description={
                    phase === 'ready'
                        ? 'Your access is active.'
                        : phase === 'waiting'
                          ? 'Payment was received. Access appears on Account once Stripe confirms the webhook.'
                          : 'Waiting for Stripe to confirm — usually a few seconds.'
                }
            />
            <p className="max-w-xl text-sm leading-6 text-muted-foreground">
                {phase === 'ready'
                    ? 'Paid episodes and downloads should now unlock.'
                    : 'Webhook confirmation can lag. Reload Account later if access is still missing.'}
            </p>
            <div className="flex flex-wrap gap-3">
                <Link className={buttonVariants()} href="/account">
                    Account
                </Link>
                <Link className={buttonVariants({variant: 'outline'})} href="/downloads">
                    Downloads
                </Link>
            </div>
        </div>
    )
}
