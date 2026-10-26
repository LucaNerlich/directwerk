'use client'

import {useDictionary} from '@/components/i18n/LocaleProvider'
import {t} from '@/lib/i18n/dictionary'
import {getSubscriberAccess} from '@/lib/api/tenantSettingsApi'
import {useAuthRequired} from '@directwerk/api/auth/useAuthRequired'
import type {SubscriberAccess, TenantSubscriber} from '@directwerk/api/types'
import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Badge} from '@directwerk/ui/components/badge'
import {Button} from '@directwerk/ui/components/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@directwerk/ui/components/dialog'
import {Input} from '@directwerk/ui/components/input'
import {Label} from '@directwerk/ui/components/label'
import {useEffect, useState} from 'react'

function reasonLabel(
    reason: string,
    labels: Record<string, string>,
): string {
    return labels[reason] ?? reason
}

export default function EntitlementDebuggerDialog({
    open,
    onOpenChange,
    subscriber,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    subscriber: TenantSubscriber | null
}): React.JSX.Element {
    const dict = useDictionary()
    const m = dict.manage
    const authRedirect = useAuthRequired()
    const [access, setAccess] = useState<SubscriberAccess | null>(null)
    const [episodeIdInput, setEpisodeIdInput] = useState('')
    const [articleIdInput, setArticleIdInput] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [isChecking, setIsChecking] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!open || subscriber === null) {
            return
        }
        let active = true
        setIsLoading(true)
        setError(null)
        setAccess(null)
        setEpisodeIdInput('')
        setArticleIdInput('')
        getSubscriberAccess(subscriber.userId)
            .then((result) => {
                if (!active) {
                    return
                }
                setAccess(result)
            })
            .catch((err: unknown) => {
                if (!active) {
                    return
                }
                if (authRedirect(err)) {
                    return
                }
                setError(err instanceof Error ? err.message : m.entitlementLoadFailed)
            })
            .finally(() => {
                if (active) {
                    setIsLoading(false)
                }
            })
        return () => {
            active = false
        }
    }, [open, subscriber, authRedirect, m.entitlementLoadFailed])

    async function runCheck(): Promise<void> {
        if (subscriber === null) {
            return
        }
        const episodeRaw = episodeIdInput.trim()
        const articleRaw = articleIdInput.trim()
        if (episodeRaw.length > 0 && articleRaw.length > 0) {
            setError(m.entitlementBothIds)
            return
        }
        const episodeId = episodeRaw.length > 0 ? Number(episodeRaw) : undefined
        const articleId = articleRaw.length > 0 ? Number(articleRaw) : undefined
        if (
            (episodeId !== undefined && !Number.isSafeInteger(episodeId)) ||
            (articleId !== undefined && !Number.isSafeInteger(articleId))
        ) {
            setError(m.entitlementInvalidId)
            return
        }
        setIsChecking(true)
        setError(null)
        try {
            const result = await getSubscriberAccess(subscriber.userId, {
                ...(episodeId !== undefined ? {episodeId} : {}),
                ...(articleId !== undefined ? {articleId} : {}),
            })
            setAccess(result)
        } catch (err: unknown) {
            if (authRedirect(err)) {
                return
            }
            setError(err instanceof Error ? err.message : m.entitlementLoadFailed)
        } finally {
            setIsChecking(false)
        }
    }

    const title =
        subscriber === null
            ? m.entitlementDebuggerTitle
            : t(m.entitlementDebuggerTitleFor, {
                  email: subscriber.email,
              })

    const reasonLabels: Record<string, string> = {
        FREE: m.entitlementReasonFree,
        LEVEL: m.entitlementReasonLevel,
        PACKAGE_RULE: m.entitlementReasonPackage,
        DENIED_LEVEL: m.entitlementReasonDeniedLevel,
        DENIED_NO_MATCH: m.entitlementReasonDeniedNoMatch,
        NOT_PUBLISHED: m.entitlementReasonNotPublished,
        CONTENT_NOT_FOUND: m.entitlementReasonNotFound,
    }

    return (
        <Dialog onOpenChange={onOpenChange} open={open}>
            <DialogContent className="sm:max-w-lg" closeLabel={dict.common.close}>
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{m.entitlementDebuggerDescription}</DialogDescription>
                </DialogHeader>

                {error !== null ? (
                    <Alert variant="destructive">
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                ) : null}

                {isLoading ? (
                    <p className="text-sm text-muted-foreground" role="status">
                        {dict.common.loading}
                    </p>
                ) : null}

                {access !== null ? (
                    <div className="flex flex-col gap-4">
                        <section aria-labelledby="entitlement-level-heading" className="flex flex-col gap-2">
                            <h3 className="text-sm font-medium" id="entitlement-level-heading">
                                {m.entitlementLevelHeading}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                                {access.maxLevelSortOrder === null
                                    ? m.entitlementNoLevel
                                    : t(m.entitlementMaxLevel, {
                                          max: access.maxLevelSortOrder,
                                      })}
                            </p>
                            {access.activeLevels.length > 0 ? (
                                <ul className="flex flex-col gap-1 text-sm">
                                    {access.activeLevels.map((level) => (
                                        <li key={level.id}>
                                            {level.title}
                                            <span className="text-muted-foreground">
                                                {' '}
                                                · {t(m.entitlementLevelSortOrder, {
                                                    sortOrder: level.sortOrder,
                                                })}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            ) : null}
                        </section>

                        <section aria-labelledby="entitlement-packages-heading" className="flex flex-col gap-2">
                            <h3 className="text-sm font-medium" id="entitlement-packages-heading">
                                {m.entitlementPackagesHeading}
                            </h3>
                            {access.activePackages.length === 0 ? (
                                <p className="text-sm text-muted-foreground">{m.entitlementNoPackages}</p>
                            ) : (
                                <ul className="flex flex-col gap-1 text-sm">
                                    {access.activePackages.map((pkg) => (
                                        <li key={pkg.id}>{pkg.title}</li>
                                    ))}
                                </ul>
                            )}
                        </section>

                        <section aria-labelledby="entitlement-check-heading" className="flex flex-col gap-3">
                            <h3 className="text-sm font-medium" id="entitlement-check-heading">
                                {m.entitlementCheckHeading}
                            </h3>
                            <p className="text-sm text-muted-foreground">{m.entitlementCheckHint}</p>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="grid gap-2">
                                    <Label htmlFor="entitlement-episode-id">{m.entitlementEpisodeId}</Label>
                                    <Input
                                        id="entitlement-episode-id"
                                        inputMode="numeric"
                                        onChange={(event) => {
                                            setEpisodeIdInput(event.target.value)
                                            if (event.target.value.trim().length > 0) {
                                                setArticleIdInput('')
                                            }
                                        }}
                                        placeholder="55"
                                        value={episodeIdInput}
                                    />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="entitlement-article-id">{m.entitlementArticleId}</Label>
                                    <Input
                                        id="entitlement-article-id"
                                        inputMode="numeric"
                                        onChange={(event) => {
                                            setArticleIdInput(event.target.value)
                                            if (event.target.value.trim().length > 0) {
                                                setEpisodeIdInput('')
                                            }
                                        }}
                                        placeholder="9"
                                        value={articleIdInput}
                                    />
                                </div>
                            </div>
                            <Button
                                disabled={isChecking || (episodeIdInput.trim() === '' && articleIdInput.trim() === '')}
                                onClick={() => {
                                    void runCheck()
                                }}
                                type="button"
                            >
                                {isChecking ? dict.common.loading : m.entitlementRunCheck}
                            </Button>

                            {access.check !== null ? (
                                <div className="flex flex-col gap-2 rounded-md border p-3 text-sm">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Badge variant={access.check.allowed ? 'secondary' : 'outline'}>
                                            {access.check.allowed
                                                ? m.entitlementUnlocked
                                                : m.entitlementLocked}
                                        </Badge>
                                        <span>{reasonLabel(access.check.reason, reasonLabels)}</span>
                                    </div>
                                    {access.check.title !== null ? (
                                        <p>
                                            {access.check.kind === 'EPISODE'
                                                ? m.entitlementEpisodeLabel
                                                : m.entitlementArticleLabel}
                                            {': '}
                                            {access.check.title}
                                            {access.check.slug !== null ? (
                                                <span className="text-muted-foreground">
                                                    {' '}
                                                    · {access.check.slug}
                                                </span>
                                            ) : null}
                                        </p>
                                    ) : null}
                                    {access.check.subject !== null && !access.check.subject.free ? (
                                        <p className="text-muted-foreground">
                                            {t(m.entitlementRequiredLevel, {
                                                required: access.check.subject.requiredLevelSortOrder,
                                            })}
                                            {access.check.subject.maxFormatRequiredLevel !== null
                                                ? ` · ${t(m.entitlementFormatFloor, {
                                                      floor: access.check.subject.maxFormatRequiredLevel,
                                                  })}`
                                                : ''}
                                        </p>
                                    ) : null}
                                    {access.check.matchedRules.length > 0 ? (
                                        <ul className="flex flex-col gap-1">
                                            {access.check.matchedRules.map((rule) => (
                                                <li key={`${rule.productId}-${rule.ruleId ?? 'x'}-${rule.scopeType}`}>
                                                    {t(m.entitlementMatchedRule, {
                                                        product: rule.productTitle,
                                                        scopeType: rule.scopeType,
                                                        scopeId:
                                                            rule.scopeId === null
                                                                ? '—'
                                                                : String(rule.scopeId),
                                                    })}
                                                </li>
                                            ))}
                                        </ul>
                                    ) : null}
                                </div>
                            ) : null}
                        </section>
                    </div>
                ) : null}
            </DialogContent>
        </Dialog>
    )
}
