'use client'

import {Alert, AlertDescription, AlertTitle} from '@directwerk/ui/components/alert'
import {Badge} from '@directwerk/ui/components/badge'
import {Button} from '@directwerk/ui/components/button'
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@directwerk/ui/components/card'
import {Checkbox} from '@directwerk/ui/components/checkbox'
import {Input} from '@directwerk/ui/components/input'
import {Label} from '@directwerk/ui/components/label'
import {Progress} from '@directwerk/ui/components/progress'
import {apiErrorCode} from '@directwerk/api/envelope'
import type {DomainVerificationChallenge} from '@directwerk/api/types'
import Form from 'next/form'
import {useCallback, useEffect, useRef, useState, useTransition} from 'react'

import {useDictionary} from '@/components/i18n/LocaleProvider'
import {t} from '@/lib/i18n/dictionary'
import {
    addDomain,
    getDomainVerification,
    verifyDomain,
} from '@/lib/api/tenantSettingsApi'

export type WizardStep = 'add' | 'dns' | 'check' | 'done'

const HOST_LABEL_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i
const POLL_INTERVAL_MS = 5000

export function isValidHostname(value: string): boolean {
    if (value.length === 0 || value.length > 253) {
        return false
    }
    const labels = value.split('.')
    return labels.length >= 2 && labels.every((label) => HOST_LABEL_PATTERN.test(label))
}

export interface DomainVerificationWizardProps {
    /** Skip the add step and open DNS instructions for an existing unverified host. */
    initialHost?: string | null
    onComplete: (host: string) => void
    onCancel: () => void
    onAuthError: (error: unknown) => boolean
}

type CheckStatus = 'idle' | 'checking' | 'waiting' | 'error' | 'success'

export default function DomainVerificationWizard({
    initialHost = null,
    onComplete,
    onCancel,
    onAuthError,
}: DomainVerificationWizardProps): React.JSX.Element {
    const dict = useDictionary()
    const s = dict.settings
    const [step, setStep] = useState<WizardStep>(initialHost ? 'dns' : 'add')
    const [host, setHost] = useState(initialHost ?? '')
    const [challenge, setChallenge] = useState<DomainVerificationChallenge | null>(null)
    const [addError, setAddError] = useState<string | null>(null)
    const [dnsError, setDnsError] = useState<string | null>(null)
    const [checkStatus, setCheckStatus] = useState<CheckStatus>('idle')
    const [checkMessage, setCheckMessage] = useState<string | null>(null)
    const [copiedField, setCopiedField] = useState<string | null>(null)
    const [autoPoll, setAutoPoll] = useState(false)
    const [addPending, startAddTransition] = useTransition()
    const pollInFlight = useRef(false)
    const activeRef = useRef(true)

    useEffect(() => {
        activeRef.current = true
        return () => {
            activeRef.current = false
        }
    }, [])

    const loadChallenge = useCallback(
        async (targetHost: string): Promise<boolean> => {
            setDnsError(null)
            try {
                const result = await getDomainVerification(targetHost)
                if (!activeRef.current) return false
                setChallenge(result)
                setHost(result.host)
                return true
            } catch (error: unknown) {
                if (onAuthError(error)) return false
                if (!activeRef.current) return false
                setDnsError(
                    error instanceof Error ? error.message : s.verifizierungKonnteGeladen,
                )
                return false
            }
        },
        [onAuthError, s.verifizierungKonnteGeladen],
    )

    useEffect(() => {
        if (step !== 'dns' || !host || challenge !== null) {
            return
        }
        void loadChallenge(host)
    }, [step, host, challenge, loadChallenge])

    const runCheck = useCallback(async (): Promise<void> => {
        if (!host || pollInFlight.current) {
            return
        }
        pollInFlight.current = true
        setCheckStatus('checking')
        setCheckMessage(s.wizardCheckingDns)
        try {
            await verifyDomain(host)
            if (!activeRef.current) return
            setCheckStatus('success')
            setCheckMessage(t(s.wizardVerified, {host}))
            setAutoPoll(false)
            setStep('done')
        } catch (error: unknown) {
            if (onAuthError(error)) return
            if (!activeRef.current) return
            const code = apiErrorCode(error)
            if (code === 'DOMAIN_VERIFICATION_FAILED') {
                setCheckStatus('waiting')
                setCheckMessage(s.wizardDnsNotVisibleYet)
            } else {
                setCheckStatus('error')
                setCheckMessage(
                    error instanceof Error ? error.message : s.verifizierungFehlgeschlagen,
                )
                setAutoPoll(false)
            }
        } finally {
            pollInFlight.current = false
        }
    }, [host, onAuthError, s.wizardCheckingDns, s.wizardDnsNotVisibleYet, s.wizardVerified, s.verifizierungFehlgeschlagen])

    useEffect(() => {
        if (step !== 'check' || !autoPoll) {
            return
        }
        void runCheck()
        const id = window.setInterval(() => {
            void runCheck()
        }, POLL_INTERVAL_MS)
        return () => {
            window.clearInterval(id)
        }
    }, [step, autoPoll, runCheck])

    function stepIndex(current: WizardStep): number {
        switch (current) {
            case 'add':
                return 0
            case 'dns':
                return 1
            case 'check':
                return 2
            case 'done':
                return 3
        }
    }

    const progressValue = ((stepIndex(step) + 1) / 4) * 100

    function handleAdd(formData: FormData): void {
        const nextHost = String(formData.get('host') ?? '')
            .trim()
            .toLowerCase()
        const isPrimary = formData.get('isPrimary') === 'on'
        setAddError(null)

        if (!isValidHostname(nextHost)) {
            setAddError(s.gueltigeDomainEingeben)
            return
        }

        startAddTransition(async () => {
            try {
                const created = await addDomain({host: nextHost, isPrimary})
                if (!activeRef.current) return
                setHost(created.host)
                setChallenge(null)
                setStep('dns')
            } catch (error: unknown) {
                if (onAuthError(error)) return
                if (!activeRef.current) return
                setAddError(
                    error instanceof Error ? error.message : s.domainKonnteHinzugefuegt,
                )
            }
        })
    }

    async function handleCopy(field: string, value: string): Promise<void> {
        try {
            await navigator.clipboard.writeText(value)
            setCopiedField(field)
            window.setTimeout(() => {
                if (activeRef.current) {
                    setCopiedField((current) => (current === field ? null : current))
                }
            }, 2000)
        } catch {
            setDnsError(s.wizardCopyFailed)
        }
    }

    function startChecking(withPoll: boolean): void {
        setCheckStatus('idle')
        setCheckMessage(null)
        setAutoPoll(withPoll)
        setStep('check')
    }

    return (
        <Card aria-labelledby="domain-wizard-heading">
            <CardHeader className="gap-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="grid gap-1">
                        <CardTitle id="domain-wizard-heading">{s.wizardTitle}</CardTitle>
                        <CardDescription>{s.wizardDescription}</CardDescription>
                    </div>
                    <Badge variant="outline">
                        {t(s.wizardStepOf, {current: stepIndex(step) + 1, total: 4})}
                    </Badge>
                </div>
                <Progress
                    aria-label={s.wizardProgressLabel}
                    value={progressValue}
                />
                <ol className="flex flex-wrap gap-2 text-xs text-muted-foreground" aria-hidden="true">
                    <li className={step === 'add' ? 'font-medium text-foreground' : undefined}>
                        {s.wizardStepAdd}
                    </li>
                    <li aria-hidden="true">·</li>
                    <li className={step === 'dns' ? 'font-medium text-foreground' : undefined}>
                        {s.wizardStepDns}
                    </li>
                    <li aria-hidden="true">·</li>
                    <li className={step === 'check' ? 'font-medium text-foreground' : undefined}>
                        {s.wizardStepCheck}
                    </li>
                    <li aria-hidden="true">·</li>
                    <li className={step === 'done' ? 'font-medium text-foreground' : undefined}>
                        {s.wizardStepDone}
                    </li>
                </ol>
            </CardHeader>
            <CardContent className="grid gap-5">
                {step === 'add' ? (
                    <Form action={handleAdd} className="grid max-w-xl gap-5">
                        <div className="grid gap-2">
                            <Label htmlFor="wizard-host">{s.wizardHostLabel}</Label>
                            <Input
                                aria-describedby="wizard-host-help"
                                id="wizard-host"
                                maxLength={253}
                                name="host"
                                placeholder={s.wizardHostPlaceholder}
                                required
                                type="text"
                            />
                            <p className="text-xs text-muted-foreground" id="wizard-host-help">
                                {s.hostnameOhneHttpsOhnePfad}
                            </p>
                        </div>
                        <Label className="flex items-center gap-2 font-normal">
                            <Checkbox id="wizard-isPrimary" name="isPrimary" />
                            <span>
                                {s.primaereDomain}{' '}
                                <span className="text-muted-foreground">
                                    ({s.wizardPrimaryHint})
                                </span>
                            </span>
                        </Label>
                        {addError ? (
                            <Alert variant="destructive">
                                <AlertDescription>{addError}</AlertDescription>
                            </Alert>
                        ) : null}
                        <div className="flex flex-wrap gap-2">
                            <Button disabled={addPending} type="submit">
                                {addPending ? s.adding : s.wizardContinueDns}
                            </Button>
                            <Button onClick={onCancel} type="button" variant="ghost">
                                {s.wizardCancel}
                            </Button>
                        </div>
                    </Form>
                ) : null}

                {step === 'dns' ? (
                    <div className="grid gap-4">
                        <p className="text-sm text-muted-foreground">
                            {t(s.wizardDnsIntro, {host: host || '…'})}
                        </p>
                        {dnsError ? (
                            <Alert variant="destructive">
                                <AlertDescription>{dnsError}</AlertDescription>
                            </Alert>
                        ) : null}
                        {challenge === null && dnsError === null ? (
                            <p className="text-sm text-muted-foreground" role="status">
                                {s.wizardLoadingChallenge}
                            </p>
                        ) : null}
                        {challenge !== null ? (
                            <div className="overflow-x-auto rounded-lg border">
                                <table className="w-full min-w-[28rem] text-left text-sm">
                                    <caption className="sr-only">{s.wizardDnsTableCaption}</caption>
                                    <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
                                        <tr>
                                            <th className="px-3 py-2 font-medium">{s.wizardDnsType}</th>
                                            <th className="px-3 py-2 font-medium">{s.wizardDnsName}</th>
                                            <th className="px-3 py-2 font-medium">{s.wizardDnsValue}</th>
                                            <th className="px-3 py-2 font-medium">
                                                <span className="sr-only">{s.wizardCopy}</span>
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr className="border-t">
                                            <td className="px-3 py-3 align-top">
                                                <code className="rounded bg-muted px-1.5 py-0.5">TXT</code>
                                            </td>
                                            <td className="px-3 py-3 align-top">
                                                <code className="break-all rounded bg-muted px-1.5 py-0.5">
                                                    {challenge.dnsNameHint}
                                                </code>
                                            </td>
                                            <td className="px-3 py-3 align-top">
                                                <code className="break-all rounded bg-muted px-1.5 py-0.5">
                                                    {challenge.dnsTxtValue}
                                                </code>
                                            </td>
                                            <td className="px-3 py-3 align-top">
                                                <div className="flex flex-col gap-2">
                                                    <Button
                                                        onClick={() => {
                                                            void handleCopy('name', challenge.dnsNameHint)
                                                        }}
                                                        size="sm"
                                                        type="button"
                                                        variant="outline"
                                                    >
                                                        {copiedField === 'name'
                                                            ? s.wizardCopied
                                                            : s.wizardCopyName}
                                                    </Button>
                                                    <Button
                                                        onClick={() => {
                                                            void handleCopy('value', challenge.dnsTxtValue)
                                                        }}
                                                        size="sm"
                                                        type="button"
                                                        variant="outline"
                                                    >
                                                        {copiedField === 'value'
                                                            ? s.wizardCopied
                                                            : s.wizardCopyValue}
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        ) : null}
                        <p className="text-xs text-muted-foreground">{s.wizardDnsProviderTip}</p>
                        <div className="flex flex-wrap gap-2">
                            <Button
                                disabled={challenge === null}
                                onClick={() => {
                                    startChecking(true)
                                }}
                                type="button"
                            >
                                {s.wizardStartChecking}
                            </Button>
                            <Button
                                disabled={challenge === null}
                                onClick={() => {
                                    startChecking(false)
                                    void runCheck()
                                }}
                                type="button"
                                variant="outline"
                            >
                                {s.wizardCheckOnce}
                            </Button>
                            {!initialHost ? (
                                <Button
                                    onClick={() => {
                                        setStep('add')
                                        setChallenge(null)
                                    }}
                                    type="button"
                                    variant="ghost"
                                >
                                    {s.wizardBack}
                                </Button>
                            ) : (
                                <Button onClick={onCancel} type="button" variant="ghost">
                                    {s.wizardCancel}
                                </Button>
                            )}
                        </div>
                    </div>
                ) : null}

                {step === 'check' ? (
                    <div className="grid gap-4">
                        <p className="text-sm text-muted-foreground">
                            {t(s.wizardCheckIntro, {host})}
                        </p>
                        {checkStatus === 'checking' || checkStatus === 'waiting' ? (
                            <Alert role="status">
                                <AlertTitle>
                                    {checkStatus === 'checking'
                                        ? s.wizardCheckingTitle
                                        : s.wizardWaitingTitle}
                                </AlertTitle>
                                <AlertDescription>
                                    {checkMessage ?? s.wizardDnsNotVisibleYet}
                                    {autoPoll ? ` ${s.wizardAutoPollHint}` : null}
                                </AlertDescription>
                            </Alert>
                        ) : null}
                        {checkStatus === 'error' && checkMessage ? (
                            <Alert variant="destructive">
                                <AlertTitle>{s.wizardErrorTitle}</AlertTitle>
                                <AlertDescription>{checkMessage}</AlertDescription>
                            </Alert>
                        ) : null}
                        {checkStatus === 'idle' ? (
                            <p className="text-sm text-muted-foreground" role="status">
                                {s.wizardCheckReady}
                            </p>
                        ) : null}
                        <div className="flex flex-wrap gap-2">
                            <Button
                                disabled={checkStatus === 'checking'}
                                onClick={() => {
                                    void runCheck()
                                }}
                                type="button"
                            >
                                {checkStatus === 'checking' ? s.pruefen : s.wizardCheckNow}
                            </Button>
                            <Button
                                disabled={autoPoll}
                                onClick={() => {
                                    setAutoPoll(true)
                                }}
                                type="button"
                                variant="outline"
                            >
                                {autoPoll ? s.wizardPolling : s.wizardEnablePoll}
                            </Button>
                            {autoPoll ? (
                                <Button
                                    onClick={() => {
                                        setAutoPoll(false)
                                    }}
                                    type="button"
                                    variant="ghost"
                                >
                                    {s.wizardStopPoll}
                                </Button>
                            ) : null}
                            <Button
                                onClick={() => {
                                    setAutoPoll(false)
                                    setStep('dns')
                                }}
                                type="button"
                                variant="ghost"
                            >
                                {s.wizardBack}
                            </Button>
                        </div>
                    </div>
                ) : null}

                {step === 'done' ? (
                    <div className="grid gap-4">
                        <Alert role="status">
                            <AlertTitle>{s.wizardSuccessTitle}</AlertTitle>
                            <AlertDescription>
                                {t(s.wizardVerified, {host})}
                            </AlertDescription>
                        </Alert>
                        <p className="text-sm text-muted-foreground">{s.wizardSuccessHint}</p>
                        <div className="flex flex-wrap gap-2">
                            <Button
                                onClick={() => {
                                    onComplete(host)
                                }}
                                type="button"
                            >
                                {s.wizardDone}
                            </Button>
                        </div>
                    </div>
                ) : null}
            </CardContent>
        </Card>
    )
}
