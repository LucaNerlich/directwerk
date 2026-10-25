'use client'

import type {ReactNode} from 'react'

import type {AccessPolicy} from '@directwerk/api/types'
import type {Dictionary} from '@/lib/i18n/dictionary'

export type StreamProgressState = {
    label: string
    progress: number | null
} | null

export type PrerequisitesStatus = 'loading' | 'ready' | 'error'

export type RssWizardStepDef = {
    id: string
    label: string
}

export type RssImportWizardLabels = {
    eyebrow: string
    title: string
    description: string
    urlTitle: string
    urlDescription: string
    urlPlaceholder: string
    urlSubmit: string
    urlSubmitBusy: string
    prerequisitesLoading: string
    prerequisitesReload: string
    itemImportLabel: string
    itemImportBusy: string
    itemBackLabel: string
    doneListHref: string
    doneListLabel: string
    bulkImportStartedTitle: string
    importFinishedTitle: string
    serverSideTransfer: string
    accessFree: string
    accessPaid: string
    allFree: string
    allPaid: string
    previewErrorFallback: string
    importErrorFallback: string
}

/** Shared chrome state the shell owns and passes into content adapters. */
export type RssImportSharedChrome = {
    busy: boolean
    setBusy: (busy: boolean) => void
    errorMessage: string | null
    setErrorMessage: (message: string | null) => void
    streamProgress: StreamProgressState
    setStreamProgress: (progress: StreamProgressState) => void
    accessPolicy: AccessPolicy
    setAccessPolicy: (policy: AccessPolicy) => void
    requiredLevelSortOrder: number | null
    setRequiredLevelSortOrder: (value: number | null) => void
    authRedirect: (error: unknown) => boolean
    dict: Dictionary
}

export type RssImportBulkResultView = {
    queuedCount: number
    alreadyImported: number
    notifyEmail: string
}

/**
 * Content-type adapter: steps after URL, item form, APIs, asset ingest.
 * The shared shell owns URL → … → item navigation chrome, access policy,
 * counts, and the done screen.
 */
export type RssImportContentAdapter = {
    steps: ReadonlyArray<RssWizardStepDef>
    /** After a successful feed preview, land on this step id. */
    afterPreviewStepId: string
    /** Per-item review step id (`article` | `episode`). */
    itemStepId: string
    /** Step to return to from the first item (`categories` | `formats`). */
    itemBackStepId: string
    /** `gate` = block whole wizard until ready; `inline` = show status on URL step. */
    prerequisitesMode: 'gate' | 'inline'
    /** Podcast resets access policy when moving between items; articles keep the choice. */
    resetAccessOnItemNavigate?: boolean
    urlInputMaxLength?: number
    showStepAnnouncement?: boolean

    labels: (dict: Dictionary) => RssImportWizardLabels

    prerequisitesStatus: PrerequisitesStatus
    prerequisitesError: string | null
    reloadPrerequisites: () => void

    previewFeed: (feedUrl: string) => Promise<void>

    itemIndex: number
    itemCount: number
    currentAlreadyImportedId: number | null
    currentOpenHref: string | null
    bulkPendingCount: number
    bulkAlreadyImportedCount: number

    /** Type-specific mid-steps (categories, or series + formats) including bulk panel. */
    renderContextSteps: (chrome: RssImportSharedChrome & {
        step: string
        setStep: (step: string) => void
        onBulkQueued: (result: RssImportBulkResultView) => void
        finishWizard: () => void
    }) => ReactNode

    renderItemFields: (chrome: RssImportSharedChrome) => ReactNode

    itemHeading: (index: number, total: number) => string
    itemDescription: (remaining: number) => string
    alreadyImportedMessage: string

    importCurrentItem: (chrome: RssImportSharedChrome) => Promise<'imported' | 'already'>
    /** Returns whether the skipped item was already imported. */
    noteSkip: () => 'already' | 'skipped'
    goToItem: (nextIndex: number) => 'item' | 'done'

    announceStep?: (step: string, itemIndex: number) => string

    formatManualDoneDescription: (
        imported: number,
        alreadyImported: number,
        skipped: number,
    ) => string
    formatBulkDoneDescription: (result: RssImportBulkResultView) => string

    resetTypeState: () => void
}

export type RssImportWizardConfig = {
    useAdapter: () => RssImportContentAdapter
}
