'use client'

import type {ReactNode} from 'react'

import PageStack from '@directwerk/ui/components/page-stack'

import PublicationDangerZone from '@/components/publication/PublicationDangerZone'
import PublicationEditorLayout from '@/components/publication/PublicationEditorLayout'
import PublishedLinksPanel from '@/components/publication/PublishedLinksPanel'
import type {ContentEditorModel} from '@/components/publication/content-editor/types'
import type {PublicationStatus} from '@directwerk/api/types'

/**
 * Parameterised publication editor shell shared by articles and episodes.
 * Content-type deltas (API, labels, preflight, type-only fields) come from the
 * model/descriptor; this component owns layout wiring, workflow actions, and
 * the danger zone.
 */
export default function PublicationContentEditor<
    T extends {
        id: number
        status: PublicationStatus
        slug: string
        title: string
        createdBy?: number | null
    },
>({model}: {model: ContentEditorModel<T>}): React.JSX.Element {
    const {descriptor} = model

    if (model.isLoading) {
        return (
            <p className="text-sm text-muted-foreground" role="status">
                {descriptor.labels.loadingMessage}
            </p>
        )
    }

    if (model.gate !== null) {
        return <>{model.gate}</>
    }

    const readOnly = !model.desk.canEdit
    const status = model.publication?.status ?? 'DRAFT'
    const previewUrlHint =
        model.publication?.status === 'PUBLISHED'
            ? descriptor.labels.previewUrlHintLive
            : descriptor.labels.previewUrlHintDraft

    const layout = (
        <PublicationEditorLayout
            kind={descriptor.kind}
            status={status}
            title={model.title}
            body={model.body}
            accessPolicy={model.accessPolicy}
            slug={model.slug}
            excerpt={model.excerpt}
            seoDescription={model.seoDescription}
            requiredLevelSortOrder={model.requiredLevelSortOrder}
            onRequiredLevelChange={model.onRequiredLevelChange}
            isDirty={model.isDirty}
            previewImageUrl={model.previewImageUrl}
            previewImageAlt={descriptor.labels.coverAlt(model.title)}
            previewExcerpt={model.previewExcerpt}
            previewUrl={model.previewUrl}
            previewUrlHint={previewUrlHint}
            onAuthRequired={model.onAuthRequired}
            onTitleChange={model.onTitleChange}
            onBodyChange={model.onBodyChange}
            onAccessPolicyChange={model.onAccessPolicyChange}
            onSlugChange={model.onSlugChange}
            onExcerptChange={model.onExcerptChange}
            onSeoDescriptionChange={model.onSeoDescriptionChange}
            slugTaken={model.slugTaken}
            isSaving={model.busy}
            saveHint={model.saveHint}
            errorMessage={model.errorMessage}
            canPublish={
                model.publishBlockedReason === null && model.desk.canPublish
            }
            publishBlockedReason={
                model.desk.publishBlockedReason ?? model.publishBlockedReason
            }
            readOnlyReason={readOnly ? model.desk.editBlockedReason : null}
            showNotify={model.showNotify}
            notifySubscribers={model.notifySubscribers}
            onNotifyChange={model.onNotifyChange}
            notifyAudienceHint={model.notifyAudienceHint}
            scheduledAt={model.scheduledAt}
            onScheduledAtChange={model.onScheduledAtChange}
            publishedAt={model.publishedAt}
            onPublishedAtChange={model.onPublishedAtChange}
            publishValidationError={model.publishValidationError}
            scheduleValidationError={model.scheduleValidationError}
            onSave={() => {
                void model.save()
            }}
            onPublish={() => {
                const validation = model.validatePublishedAt()
                if (!validation.valid) {
                    model.setPublishValidationError(validation.message)
                    model.setErrorMessage(validation.message)
                    return
                }
                model.setPublishValidationError(null)
                void model.runWorkflow(
                    (saved) =>
                        descriptor.api.publish(saved.id, {
                            notifySubscribers: model.notifySubscribers,
                            ...(validation.iso !== null
                                ? {publishedAt: validation.iso}
                                : {}),
                        }),
                    {persistTags: true},
                )
            }}
            onSchedule={() => {
                const iso = model.parseScheduledAt()
                if (iso === null) {
                    model.setScheduleValidationError(
                        'Bitte einen gültigen Zeitpunkt wählen.',
                    )
                    model.setErrorMessage(
                        'Bitte einen gültigen Zeitpunkt wählen.',
                    )
                    return
                }
                model.setScheduleValidationError(null)
                void model.runWorkflow(
                    (saved) =>
                        descriptor.api.schedule(saved.id, {
                            scheduledAt: iso,
                            notifySubscribers: model.notifySubscribers,
                        }),
                    {persistTags: true},
                )
            }}
            onCancelSchedule={() => {
                void model.runWorkflow((saved) =>
                    descriptor.api.cancelSchedule(saved.id),
                )
            }}
            onUnpublish={() => {
                void model.runWorkflow((saved) =>
                    descriptor.api.unpublish(saved.id),
                )
            }}
            onArchive={() => {
                void model.runWorkflow((saved) =>
                    descriptor.api.archive(saved.id),
                )
            }}
            onUnarchive={() => {
                void model.runWorkflow((saved) =>
                    descriptor.api.unarchive(saved.id),
                )
            }}
            sidebarExtra={
                <>
                    {model.publishedLinks !== null ? (
                        <PublishedLinksPanel
                            title={descriptor.labels.publishedLinksTitle}
                            links={model.publishedLinks}
                            hint={model.publishedLinksHint}
                        />
                    ) : null}
                    {model.sidebarExtra}
                </>
            }
        />
    )

    const dangerZone =
        model.publicationId !== undefined &&
        model.publication !== null &&
        model.desk.canDelete ? (
            <PublicationDangerZone
                contentLabel={descriptor.labels.contentLabel}
                deleteErrorMessage={descriptor.labels.deleteErrorMessage}
                item={model.publication}
                onDelete={(id) => descriptor.api.delete(id)}
                onDeleted={model.onDeleted}
            />
        ) : null

    const body: ReactNode = (
        <>
            {model.aboveEditor}
            {layout}
            {dangerZone !== null ? (
                model.wrapInPageStack ? (
                    dangerZone
                ) : (
                    <div className="mt-6">{dangerZone}</div>
                )
            ) : null}
        </>
    )

    if (model.wrapInPageStack) {
        return <PageStack className="gap-6">{body}</PageStack>
    }

    return <>{body}</>
}
