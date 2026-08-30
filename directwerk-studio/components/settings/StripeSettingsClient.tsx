'use client'

import {Button} from '@directwerk/ui/components/button'
import {EntityListView} from '@directwerk/ui/components/entity-list-view'
import PageHeader from '@directwerk/ui/components/page-header'

import {useEffect, useState} from 'react'
import {useRouter} from 'next/navigation'

import {getStripeStatus, startStripeOnboard} from '@/lib/api/subscriptionApi'
import type {StripeStatus} from '@directwerk/api/types'
import {getClientTenantHost} from '@directwerk/api/tenant'
import {useAuthRequired} from '@directwerk/api/auth/useAuthRequired'

export default function StripeSettingsClient(): React.JSX.Element {
    const router = useRouter()
    const authRedirect = useAuthRequired()
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
                if (authRedirect(error)) return
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
            if (authRedirect(error)) return
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

    const statusItems =
        status === null
            ? []
            : [
                  {id: 'status', title: 'Status', trailing: status.status},
                  {
                      id: 'charges',
                      title: 'Zahlungen möglich',
                      trailing: status.chargesEnabled ? 'ja' : 'nein',
                  },
                  {
                      id: 'payouts',
                      title: 'Auszahlungen',
                      trailing: status.payoutsEnabled ? 'ja' : 'nein',
                  },
                  {
                      id: 'module',
                      title: 'Modul STRIPE_BILLING',
                      trailing: status.moduleEnabled ? 'aktiv' : 'nicht aktiv',
                  },
                  {id: 'message', title: 'Hinweis', trailing: status.message},
              ]

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

            {statusItems.length > 0 ? (
                <EntityListView items={statusItems} viewMode="list" />
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
