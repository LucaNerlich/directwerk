'use client'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Badge} from '@directwerk/ui/components/badge'
import {Button} from '@directwerk/ui/components/button'
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@directwerk/ui/components/card'
import {EntityListView} from '@directwerk/ui/components/entity-list-view'
import PageHeader from '@directwerk/ui/components/page-header'
import PageStack from '@directwerk/ui/components/page-stack'
import SectionHeader from '@directwerk/ui/components/section-header'
import {Skeleton} from '@directwerk/ui/components/skeleton'

import {useCallback, useEffect, useState} from 'react'
import {useRouter} from 'next/navigation'

import {getStripeStatus, startStripeOnboard} from '@/lib/api/subscriptionApi'
import type {StripeStatus} from '@directwerk/api/types'
import {getClientTenantHost} from '@directwerk/api/tenant'
import {useAuthRequired} from '@directwerk/api/auth/useAuthRequired'
import {safeLinkHref} from '@/lib/url/safeUrl'

function stripeStatusLabel(status: string): string {
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

function booleanLabel(value: boolean, positive = 'Ja', negative = 'Nein'): string {
    return value ? positive : negative
}

export default function StripeSettingsClient(): React.JSX.Element {
    const router = useRouter()
    const authRedirect = useAuthRequired()
    const [status, setStatus] = useState<StripeStatus | null>(null)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [statusMessage, setStatusMessage] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isBusy, setIsBusy] = useState(false)

    const loadStatus = useCallback(async (): Promise<void> => {
        setIsLoading(true)
        setErrorMessage(null)
        try {
            const result = await getStripeStatus(getClientTenantHost())
            setStatus(result)
        } catch (error: unknown) {
            if (authRedirect(error)) return
            setErrorMessage(
                error instanceof Error
                    ? error.message
                    : 'Stripe-Status konnte nicht geladen werden.',
            )
        } finally {
            setIsLoading(false)
        }
    }, [router])

    useEffect(() => {
        void loadStatus()
    }, [loadStatus])

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
            if (safeLinkHref(url) === null) {
                throw new Error('Stripe-Onboarding ist noch nicht verfügbar.')
            }
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
        return (
            <PageStack>
                <PageHeader
                    eyebrow="Einstellungen"
                    title="Stripe"
                    description="Verbinde dein Stripe-Konto, damit Hörerinnen und Hörer Mitgliedschaften und Einmalkäufe bezahlen können."
                />
                <p className="text-sm text-muted-foreground" role="status">Wird geladen…</p>
                <Skeleton className="h-40 w-full max-w-2xl" />
            </PageStack>
        )
    }

    const connected = status?.status === 'CONNECTED'
    const moduleBlocked = status?.moduleEnabled === false

    const statusItems =
        status === null
            ? []
            : [
                  {
                      id: 'status',
                      title: 'Verbindungsstatus',
                      description: status.message,
                      trailing: (
                          <Badge variant={connected ? 'default' : 'outline'}>
                              {stripeStatusLabel(status.status)}
                          </Badge>
                      ),
                  },
                  {
                      id: 'charges',
                      title: 'Zahlungen möglich',
                      description: 'Checkout kann Zahlungen annehmen.',
                      trailing: <Badge variant={status.chargesEnabled ? 'default' : 'outline'}>{booleanLabel(status.chargesEnabled)}</Badge>,
                  },
                  {
                      id: 'payouts',
                      title: 'Auszahlungen möglich',
                      description: 'Stripe kann Geld an dein Bankkonto auszahlen.',
                      trailing: <Badge variant={status.payoutsEnabled ? 'default' : 'outline'}>{booleanLabel(status.payoutsEnabled)}</Badge>,
                  },
                  {
                      id: 'module',
                      title: 'Modul STRIPE_BILLING',
                      description: 'Muss für diesen Mandanten aktiv sein — sonst bleibt Onboarding gesperrt.',
                      trailing: (
                          <Badge variant={status.moduleEnabled ? 'default' : 'destructive'}>
                              {status.moduleEnabled ? 'Aktiv' : 'Nicht aktiv'}
                          </Badge>
                      ),
                  },
              ]

    return (
        <PageStack>
            <PageHeader
                eyebrow="Einstellungen"
                title="Stripe"
                description="Verbinde dein Stripe-Konto, damit Hörerinnen und Hörer Mitgliedschaften und Einmalkäufe bezahlen können."
            />

            {errorMessage !== null ? (
                <Alert variant="destructive">
                    <AlertDescription>
                        {errorMessage}{' '}
                        <Button onClick={() => void loadStatus()} size="sm" type="button" variant="outline">
                            Wiederholen
                        </Button>
                    </AlertDescription>
                </Alert>
            ) : null}

            {statusItems.length > 0 ? (
                <section aria-labelledby="stripe-status-heading" className="flex max-w-2xl flex-col gap-4">
                    <SectionHeader
                        id="stripe-status-heading"
                        title="Verbindungsstatus"
                        description="Erst wenn Zahlungen möglich sind, können Käufe über den Checkout laufen."
                    />
                <EntityListView items={statusItems} viewMode="list" />
                </section>
            ) : null}

            {moduleBlocked ? (
                <Alert variant="destructive">
                    <AlertDescription>
                        Das Modul STRIPE_BILLING ist für diesen Mandanten nicht aktiv. Bitte wende dich an den Plattform-Support — Onboarding ist bis dahin gesperrt.
                    </AlertDescription>
                </Alert>
            ) : (
                <Card className="max-w-2xl">
                    <CardHeader>
                        <CardTitle>{connected ? 'Stripe-Konto verwalten' : 'Stripe verbinden'}</CardTitle>
                        <CardDescription>
                            {connected
                                ? 'Aktualisiere deine Kontodaten oder hinterlegte Bankverbindung bei Stripe.'
                                : 'Du wirst zu Stripe weitergeleitet, um dein Konto zu verknüpfen oder einzurichten.'}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-4">
            <p className="text-sm text-muted-foreground">
                Aktionscodes legst du im Stripe-Dashboard an. Der Checkout erlaubt sie automatisch.
            </p>

            {statusMessage !== null ? (
                <Alert role="status">
                    <AlertDescription>{statusMessage}</AlertDescription>
                </Alert>
            ) : null}

            <div>
            <Button
                disabled={isBusy || moduleBlocked}
                onClick={() => {
                    void handleOnboard()
                }}
                type="button"
            >
                {isBusy ? 'Wird geöffnet…' : connected ? 'Stripe-Konto aktualisieren' : 'Stripe verbinden'}
            </Button>
            </div>
                    </CardContent>
                </Card>
            )}
        </PageStack>
    )
}
