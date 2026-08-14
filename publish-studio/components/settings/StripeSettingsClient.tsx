'use client'

import {Button} from '@publish/ui/components/button'
import PageHeader from '@publish/ui/components/page-header'

import {useEffect, useState} from 'react'
import {useRouter} from 'next/navigation'

import {AUTH_REQUIRED} from '@/lib/api/errors'
import {getStripeStatus, startStripeOnboard} from '@/lib/api/tenantApi'
import type {StripeStatus} from '@/lib/api/types'
import {getClientTenantHost} from '@/lib/tenant/getClientTenantHost'

export default function StripeSettingsClient(): React.JSX.Element {
    const router = useRouter()
    const [status, setStatus] = useState<StripeStatus | null>(null)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [statusMessage, setStatusMessage] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isBusy, setIsBusy] = useState(false)

    useEffect(() => {
        let active = true

        getStripeStatus(getClientTenantHost())
            .then((result) => {
                if (!active) {
                    return
                }
                setStatus(result)
                setIsLoading(false)
            })
            .catch((error: unknown) => {
                if (!active) {
                    return
                }
                if (error instanceof Error && error.message === AUTH_REQUIRED) {
                    router.replace('/login')
                    return
                }
                setErrorMessage(
                    error instanceof Error
                        ? error.message
                        : 'Stripe-Status konnte nicht geladen werden.',
                )
                setIsLoading(false)
            })

        return () => {
            active = false
        }
    }, [router])

    async function handleOnboard(): Promise<void> {
        setIsBusy(true)
        setErrorMessage(null)
        setStatusMessage(null)
        try {
            const origin = window.location.origin
            const url = await startStripeOnboard(
                getClientTenantHost(),
                `${origin}/settings/stripe?onboard=return`,
                `${origin}/settings/stripe?onboard=refresh`,
            )
            window.location.assign(url)
        } catch (error: unknown) {
            if (error instanceof Error && error.message === AUTH_REQUIRED) {
                router.replace('/login')
                return
            }
            setStatusMessage(
                error instanceof Error
                    ? error.message
                    : 'Stripe-Onboarding ist noch nicht verfügbar.',
            )
            setIsBusy(false)
        }
    }

    if (isLoading) {
        return <p>Wird geladen…</p>
    }

    const connected = status?.status === 'CONNECTED'

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                eyebrow="Einstellungen"
                title="Stripe"
                description="Verbinde dein Stripe-Konto, damit Hörerinnen und Hörer Mitgliedschaften und Einmalkäufe bezahlen können."
            />

            {errorMessage !== null ? (
                <p className="text-sm text-destructive" role="alert">
                    {errorMessage}
                </p>
            ) : null}

            {status !== null ? (
                <ul className="overflow-hidden rounded-xl border bg-card divide-y [&>li]:flex [&>li]:items-center [&>li]:justify-between [&>li]:gap-4 [&>li]:p-4">
                    <li>
                        <span>Status</span>
                        <span className="flex shrink-0 items-center gap-3 text-sm text-muted-foreground">
                            {status.status}
                        </span>
                    </li>
                    <li>
                        <span>Zahlungen möglich</span>
                        <span className="flex shrink-0 items-center gap-3 text-sm text-muted-foreground">
                            {status.chargesEnabled ? 'ja' : 'nein'}
                        </span>
                    </li>
                    <li>
                        <span>Auszahlungen</span>
                        <span className="flex shrink-0 items-center gap-3 text-sm text-muted-foreground">
                            {status.payoutsEnabled ? 'ja' : 'nein'}
                        </span>
                    </li>
                    <li>
                        <span>Modul STRIPE_BILLING</span>
                        <span className="flex shrink-0 items-center gap-3 text-sm text-muted-foreground">
                            {status.moduleEnabled ? 'aktiv' : 'nicht aktiv'}
                        </span>
                    </li>
                    <li>
                        <span>Hinweis</span>
                        <span className="flex shrink-0 items-center gap-3 text-sm text-muted-foreground">
                            {status.message}
                        </span>
                    </li>
                </ul>
            ) : null}

            <p className="text-sm text-muted-foreground">
                Aktionscodes legst du im Stripe-Dashboard an. Der Checkout erlaubt sie automatisch.
                Das Modul STRIPE_BILLING muss für diesen Mandanten aktiv sein — sonst bleibt Onboarding gesperrt.
            </p>

            {statusMessage !== null ? <p role="status">{statusMessage}</p> : null}

            <Button
                disabled={isBusy || status?.moduleEnabled === false}
                onClick={() => {
                    void handleOnboard()
                }}
                type="button"
            >
                {isBusy ? '…' : connected ? 'Stripe-Konto aktualisieren' : 'Stripe verbinden'}
            </Button>
        </div>
    )
}
