'use client'

import LocaleLink from '@/components/i18n/LocaleLink'
import {useLayoutEffect, useRef, useState} from 'react'

import {Button} from '@directwerk/ui/components/button'
import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Input} from '@directwerk/ui/components/input'
import PageHeader from '@directwerk/ui/components/page-header'
import PageStack from '@directwerk/ui/components/page-stack'
import SectionHeader from '@directwerk/ui/components/section-header'

import StreamProgress from '@/components/media/StreamProgress'
import {useAuthRequired} from '@directwerk/api/auth/useAuthRequired'
import {useDictionary} from '@/components/i18n/LocaleProvider'
import type {AccessPolicy} from '@directwerk/api/types'

import {RssWizardStepPills} from './RssImportSharedUi'
import type {
    RssImportBulkResultView,
    RssImportWizardConfig,
    StreamProgressState,
} from './types'

/**
 * Parameterised RSS import wizard shell. Content-type specifics (steps, APIs,
 * field bindings, asset ingest) come from {@link RssImportWizardConfig}.
 */
export default function RssImportWizardShared({
    config,
}: {
    config: RssImportWizardConfig
}): React.JSX.Element {
    const dict = useDictionary()
    const authRedirect = useAuthRequired()
    const authRedirectRef = useRef(authRedirect)
    // Issue #417: writing a ref during render violates the Rules of React and makes the React
    // Compiler bail out of optimising this component.
    useLayoutEffect(() => {
        authRedirectRef.current = authRedirect
    }, [authRedirect])

    const adapter = config.useAdapter()
    const labels = adapter.labels(dict)

    const [step, setStep] = useState('url')
    const [feedUrl, setFeedUrl] = useState('')
    const [accessPolicy, setAccessPolicy] = useState<AccessPolicy>('FREE')
    const [requiredLevelSortOrder, setRequiredLevelSortOrder] = useState<number | null>(null)
    const [importedCount, setImportedCount] = useState(0)
    const [skippedCount, setSkippedCount] = useState(0)
    const [alreadyImportedCount, setAlreadyImportedCount] = useState(0)
    const [bulkResult, setBulkResult] = useState<RssImportBulkResultView | null>(null)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [streamProgress, setStreamProgress] = useState<StreamProgressState>(null)
    const [busy, setBusy] = useState(false)

    const chrome = {
        busy,
        setBusy,
        errorMessage,
        setErrorMessage,
        streamProgress,
        setStreamProgress,
        accessPolicy,
        setAccessPolicy,
        requiredLevelSortOrder,
        setRequiredLevelSortOrder,
        authRedirect,
        dict,
    }

    async function handlePreview(): Promise<void> {
        setErrorMessage(null)
        setBusy(true)
        try {
            await adapter.previewFeed(feedUrl.trim())
            setStep(adapter.afterPreviewStepId)
        } catch (error) {
            if (authRedirect(error)) {
                return
            }
            setErrorMessage(
                error instanceof Error ? error.message : labels.previewErrorFallback,
            )
        } finally {
            setBusy(false)
        }
    }

    function finishWizard(): void {
        setStep('done')
    }

    function goToItemStep(index: number): void {
        const result = adapter.goToItem(index)
        if (result === 'done') {
            setStep('done')
            return
        }
        if (adapter.resetAccessOnItemNavigate) {
            setAccessPolicy('FREE')
            setRequiredLevelSortOrder(null)
        }
        setStep(adapter.itemStepId)
    }

    async function handleImportItem(): Promise<void> {
        setErrorMessage(null)
        setStreamProgress(null)
        setBusy(true)
        try {
            const outcome = await adapter.importCurrentItem(chrome)
            if (outcome === 'already') {
                setAlreadyImportedCount((count) => count + 1)
            } else {
                setImportedCount((count) => count + 1)
            }
            goToItemStep(adapter.itemIndex + 1)
        } catch (error) {
            if (authRedirect(error)) {
                return
            }
            setErrorMessage(
                error instanceof Error ? error.message : labels.importErrorFallback,
            )
        } finally {
            setStreamProgress(null)
            setBusy(false)
        }
    }

    function handleSkipItem(): void {
        const outcome = adapter.noteSkip()
        if (outcome === 'already') {
            setAlreadyImportedCount((count) => count + 1)
        } else {
            setSkippedCount((count) => count + 1)
        }
        goToItemStep(adapter.itemIndex + 1)
    }

    function resetWizard(): void {
        setStep('url')
        setFeedUrl('')
        setAccessPolicy('FREE')
        setRequiredLevelSortOrder(null)
        setImportedCount(0)
        setSkippedCount(0)
        setAlreadyImportedCount(0)
        setBulkResult(null)
        setErrorMessage(null)
        setStreamProgress(null)
        setBusy(false)
        adapter.resetTypeState()
    }

    const remaining = adapter.itemCount - adapter.itemIndex
    const onItemStep = step === adapter.itemStepId && adapter.itemCount > 0

    if (adapter.prerequisitesMode === 'gate' && adapter.prerequisitesStatus === 'loading') {
        return (
            <p className="text-sm text-muted-foreground" role="status">
                {labels.prerequisitesLoading}
            </p>
        )
    }

    if (adapter.prerequisitesMode === 'gate' && adapter.prerequisitesStatus === 'error') {
        return (
            <PageStack>
                <Alert variant="destructive">
                    <AlertDescription>{adapter.prerequisitesError}</AlertDescription>
                </Alert>
                <Button
                    onClick={() => adapter.reloadPrerequisites()}
                    type="button"
                    variant="outline"
                >
                    {labels.prerequisitesReload}
                </Button>
            </PageStack>
        )
    }

    return (
        <PageStack>
            <PageHeader
                eyebrow={labels.eyebrow}
                title={labels.title}
                description={labels.description}
            />

            <RssWizardStepPills steps={adapter.steps} step={step} />

            {adapter.showStepAnnouncement && adapter.announceStep != null ? (
                <p aria-live="polite" className="sr-only">
                    Aktueller Schritt: {adapter.announceStep(step, adapter.itemIndex)}
                </p>
            ) : null}

            {errorMessage !== null ? (
                <Alert variant="destructive">
                    <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
            ) : null}
            {streamProgress !== null ? (
                <StreamProgress
                    className="max-w-2xl rounded-xl border bg-muted/40 p-4"
                    detail={labels.serverSideTransfer}
                    label={streamProgress.label}
                    progress={streamProgress.progress}
                />
            ) : null}

            {step === 'url' ? (
                <section className="flex max-w-2xl flex-col gap-4">
                    <SectionHeader title={labels.urlTitle} description={labels.urlDescription} />
                    <label className="grid gap-1.5">
                        <span className="text-sm font-medium">RSS-URL</span>
                        <Input
                            disabled={
                                busy ||
                                (adapter.prerequisitesMode === 'inline' &&
                                    adapter.prerequisitesStatus !== 'ready')
                            }
                            maxLength={adapter.urlInputMaxLength}
                            onChange={(event) => setFeedUrl(event.target.value)}
                            placeholder={labels.urlPlaceholder}
                            type="url"
                            value={feedUrl}
                        />
                    </label>
                    {adapter.prerequisitesMode === 'inline' &&
                    adapter.prerequisitesStatus === 'loading' ? (
                        <p className="text-sm text-muted-foreground" role="status">
                            {labels.prerequisitesLoading}
                        </p>
                    ) : null}
                    {adapter.prerequisitesMode === 'inline' &&
                    adapter.prerequisitesStatus === 'error' ? (
                        <div className="grid gap-2">
                            <Alert variant="destructive">
                                <AlertDescription>{adapter.prerequisitesError}</AlertDescription>
                            </Alert>
                            <Button
                                onClick={() => adapter.reloadPrerequisites()}
                                type="button"
                                variant="outline"
                            >
                                {labels.prerequisitesReload}
                            </Button>
                        </div>
                    ) : null}
                    <Button
                        disabled={
                            busy ||
                            feedUrl.trim().length === 0 ||
                            (adapter.prerequisitesMode === 'inline' &&
                                adapter.prerequisitesStatus !== 'ready')
                        }
                        onClick={() => void handlePreview()}
                    >
                        {busy ? labels.urlSubmitBusy : labels.urlSubmit}
                    </Button>
                </section>
            ) : null}

            {adapter.renderContextSteps({
                ...chrome,
                step,
                setStep,
                onBulkQueued: (result) => {
                    setBulkResult(result)
                    setStep('done')
                },
                finishWizard,
            })}

            {onItemStep ? (
                <section className="flex max-w-2xl flex-col gap-4">
                    <SectionHeader
                        title={adapter.itemHeading(adapter.itemIndex, adapter.itemCount)}
                        description={adapter.itemDescription(remaining)}
                    />
                    {adapter.currentAlreadyImportedId !== null &&
                    adapter.currentOpenHref !== null ? (
                        <p className="rounded-xl border bg-muted/40 px-4 py-3 text-sm">
                            {adapter.alreadyImportedMessage}{' '}
                            <LocaleLink href={adapter.currentOpenHref}>Öffnen</LocaleLink>
                        </p>
                    ) : null}
                    {adapter.renderItemFields(chrome)}
                    <div className="flex flex-wrap gap-2">
                        {adapter.itemIndex === 0 ? (
                            <Button
                                disabled={busy}
                                onClick={() => {
                                    setErrorMessage(null)
                                    setStep(adapter.itemBackStepId)
                                }}
                                type="button"
                                variant="outline"
                            >
                                {labels.itemBackLabel}
                            </Button>
                        ) : null}
                        <Button
                            disabled={busy || adapter.currentAlreadyImportedId !== null}
                            onClick={() => void handleImportItem()}
                        >
                            {busy ? labels.itemImportBusy : labels.itemImportLabel}
                        </Button>
                        <Button
                            disabled={busy}
                            onClick={handleSkipItem}
                            type="button"
                            variant="outline"
                        >
                            {adapter.currentAlreadyImportedId !== null ? 'Weiter' : 'Überspringen'}
                        </Button>
                    </div>
                </section>
            ) : null}

            {step === 'done' ? (
                <section className="flex max-w-2xl flex-col gap-4">
                    {bulkResult !== null ? (
                        <SectionHeader
                            title={labels.bulkImportStartedTitle}
                            description={adapter.formatBulkDoneDescription(bulkResult)}
                        />
                    ) : (
                        <SectionHeader
                            title={labels.importFinishedTitle}
                            description={adapter.formatManualDoneDescription(
                                importedCount,
                                alreadyImportedCount,
                                skippedCount,
                            )}
                        />
                    )}
                    <div className="flex flex-wrap gap-2">
                        <Button
                            nativeButton={false}
                            render={<LocaleLink href={labels.doneListHref} />}
                        >
                            {labels.doneListLabel}
                        </Button>
                        <Button onClick={resetWizard} type="button" variant="outline">
                            Weiteren Feed importieren
                        </Button>
                    </div>
                </section>
            ) : null}
        </PageStack>
    )
}
