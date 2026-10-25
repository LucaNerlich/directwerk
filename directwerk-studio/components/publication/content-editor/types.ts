import type {ReactNode} from 'react'

import type {DeskAccess} from '@/lib/rbac/access'
import type {
    AccessPolicy,
    PublicationStatus,
    PublishOptions,
    RbacEntityType,
    ScheduleOptions,
} from '@directwerk/api/types'

/**
 * Static content-type descriptor for the shared publication editor shell.
 * Article/episode adapters supply API bindings, labels, paths, and desk entity;
 * live field state and type-specific sidebar slots live on {@link ContentEditorModel}.
 */
export interface ContentEditorLabels {
    contentLabel: string
    loadingMessage: string
    deleteErrorMessage: string
    coverAlt: (title: string) => string
    previewUrlHintLive: string
    previewUrlHintDraft: string
    publishedLinksTitle: string
}

export interface ContentEditorPaths {
    list: string
    editor: (id: number) => string
}

export interface ContentEditorApi<T> {
    publish: (id: number, options?: PublishOptions) => Promise<T>
    schedule: (id: number, options: ScheduleOptions) => Promise<T>
    cancelSchedule: (id: number) => Promise<T>
    unpublish: (id: number) => Promise<T>
    archive: (id: number) => Promise<T>
    unarchive: (id: number) => Promise<T>
    delete: (id: number) => Promise<void>
}

export interface ContentEditorDescriptor<
    T extends {id: number; status: PublicationStatus},
> {
    kind: 'article' | 'episode'
    deskEntity: RbacEntityType
    labels: ContentEditorLabels
    paths: ContentEditorPaths
    api: ContentEditorApi<T>
}

/**
 * Live editor session produced by a content-type hook and rendered by
 * {@link PublicationContentEditor}. Type-specific fields (audio, newsletter,
 * series, …) stay in `sidebarExtra` / `aboveEditor` / `gate` rather than in the
 * shared shell body.
 */
export interface ContentEditorModel<
    T extends {
        id: number
        status: PublicationStatus
        slug: string
        title: string
        createdBy?: number | null
    },
> {
    descriptor: ContentEditorDescriptor<T>
    isLoading: boolean
    /** Early-exit UI (e.g. no series). When set, the editor body is not rendered. */
    gate: ReactNode | null
    /** Content above the shared layout (series picker, draft warnings). */
    aboveEditor: ReactNode | null
    /** Episode wraps the shell in PageStack; article uses a fragment. */
    wrapInPageStack: boolean

    publication: T | null
    publicationId: number | undefined

    title: string
    slug: string
    body: string
    excerpt?: string
    seoDescription?: string
    accessPolicy: AccessPolicy
    requiredLevelSortOrder: number | null
    onRequiredLevelChange: (value: number | null) => void

    notifySubscribers: boolean
    onNotifyChange: (value: boolean) => void
    scheduledAt: string
    onScheduledAtChange: (value: string) => void
    publishedAt: string
    onPublishedAtChange: (value: string) => void
    publishValidationError: string | null
    scheduleValidationError: string | null
    validatePublishedAt: () =>
        | {valid: true; iso: string | null}
        | {valid: false; message: string}
    parseScheduledAt: () => string | null
    setPublishValidationError: (message: string | null) => void
    setScheduleValidationError: (message: string | null) => void

    isSaving: boolean
    errorMessage: string | null
    setErrorMessage: (message: string | null) => void
    saveHint: string | null
    isDirty: boolean
    busy: boolean
    save: () => Promise<T | null>
    runWorkflow: (
        action: (current: T) => Promise<T>,
        options?: {persistTags?: boolean},
    ) => Promise<void>

    desk: DeskAccess
    publishBlockedReason: string | null
    showNotify: boolean
    notifyAudienceHint: string | null

    previewImageUrl: string | null
    previewExcerpt?: string
    previewUrl: string | null
    publishedLinks: Array<{label: string; url: string}> | null
    publishedLinksHint?: string

    slugTaken: (candidate: string) => boolean
    onAuthRequired: () => void

    onTitleChange: (value: string) => void
    onBodyChange: (value: string) => void
    onAccessPolicyChange: (value: AccessPolicy) => void
    onSlugChange: (value: string) => void
    onExcerptChange?: (value: string) => void
    onSeoDescriptionChange?: (value: string) => void

    /** Article/episode field cards (cover, audio, tags, …). */
    sidebarExtra: ReactNode
    onDeleted: () => void
}
