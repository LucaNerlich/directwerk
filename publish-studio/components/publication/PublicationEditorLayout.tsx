'use client'

import {Textarea} from '@publish/ui/components/textarea'
import {Input} from '@publish/ui/components/input'

import type {ReactNode} from 'react'

import AccessPolicySelect from '@/components/publication/AccessPolicySelect'
import PublicationStatusBadge from '@/components/publication/PublicationStatusBadge'
import PublicationWorkflowActions from '@/components/publication/PublicationWorkflowActions'
import ShowNotesEditor from '@/components/editors/ShowNotesEditor'
import type {AccessPolicy, PublicationStatus} from '@/lib/api/types'

interface PublicationEditorLayoutProps {
    kind: 'article' | 'episode'
    status: PublicationStatus
    title: string
    body: string
    accessPolicy: AccessPolicy
    slug?: string
    excerpt?: string
    onTitleChange: (value: string) => void
    onBodyChange: (value: string) => void
    onAccessPolicyChange: (value: AccessPolicy) => void
    onSlugChange?: (value: string) => void
    onExcerptChange?: (value: string) => void
    isSaving: boolean
    saveHint?: string | null
    errorMessage: string | null
    canPublish?: boolean
    publishBlockedReason?: string | null
    showNotify: boolean
    notifySubscribers: boolean
    onNotifyChange: (value: boolean) => void
    scheduledAt: string
    onScheduledAtChange: (value: string) => void
    onSave: () => void
    onPublish: () => void
    onSchedule: () => void
    onCancelSchedule: () => void
    onUnpublish: () => void
    onArchive: () => void
    onUnarchive: () => void
    sidebarExtra?: ReactNode
}

export default function PublicationEditorLayout({
    kind,
    status,
    title,
    body,
    accessPolicy,
    slug,
    excerpt,
    onTitleChange,
    onBodyChange,
    onAccessPolicyChange,
    onSlugChange,
    onExcerptChange,
    isSaving,
    saveHint = null,
    errorMessage,
    canPublish = true,
    publishBlockedReason = null,
    showNotify,
    notifySubscribers,
    onNotifyChange,
    scheduledAt,
    onScheduledAtChange,
    onSave,
    onPublish,
    onSchedule,
    onCancelSchedule,
    onUnpublish,
    onArchive,
    onUnarchive,
    sidebarExtra,
}: PublicationEditorLayoutProps): React.JSX.Element {
    const bodyLabel = kind === 'episode' ? 'Shownotes' : 'Text'
    const fieldsDisabled = isSaving || status !== 'DRAFT'

    return (
        <div className="flex flex-col gap-6">
            <header className="flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{kind === 'episode' ? 'Folge' : 'Beitrag'}</p>
                    <PublicationStatusBadge status={status} />
                    {saveHint !== null && saveHint.length > 0 ? (
                        <p className="mt-2 text-xs text-muted-foreground" role="status">
                            {saveHint}
                        </p>
                    ) : null}
                </div>
                <PublicationWorkflowActions
                    status={status}
                    isSaving={isSaving}
                    canPublish={canPublish}
                    publishBlockedReason={publishBlockedReason}
                    showNotify={showNotify}
                    notifySubscribers={notifySubscribers}
                    onNotifyChange={onNotifyChange}
                    scheduledAt={scheduledAt}
                    onScheduledAtChange={onScheduledAtChange}
                    onSave={onSave}
                    onPublish={onPublish}
                    onSchedule={onSchedule}
                    onCancelSchedule={onCancelSchedule}
                    onUnpublish={onUnpublish}
                    onArchive={onArchive}
                    onUnarchive={onUnarchive}
                />
            </header>
            {errorMessage !== null && (
                <p className="text-sm text-destructive" role="alert">
                    {errorMessage}
                </p>
            )}
            <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]">
                <section className="flex flex-col gap-4">
                    <label className="grid gap-2 text-sm font-medium">
                        <span>Titel</span>
                        <Input
                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                            value={title}
                            disabled={fieldsDisabled}
                            onChange={(event) => onTitleChange(event.target.value)}
                        />
                    </label>
                    {onSlugChange !== undefined && slug !== undefined && (
                        <label className="grid gap-2 text-sm font-medium">
                            <span>Slug</span>
                            <Input
                                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                                value={slug}
                                disabled={fieldsDisabled}
                                onChange={(event) => onSlugChange(event.target.value)}
                            />
                        </label>
                    )}
                    <ShowNotesEditor
                        label={bodyLabel}
                        value={body}
                        onChange={onBodyChange}
                        disabled={fieldsDisabled}
                    />
                </section>
                <aside className="flex flex-col gap-4 rounded-xl border bg-muted/20 p-4">
                    <AccessPolicySelect
                        value={accessPolicy}
                        onChange={onAccessPolicyChange}
                        disabled={fieldsDisabled}
                    />
                    {kind === 'article' ? (
                        <label className="grid gap-2 text-sm font-medium">
                            <span>Auszug</span>
                            <Textarea
                                className="flex min-h-24 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                                rows={4}
                                value={excerpt ?? ''}
                                disabled={fieldsDisabled}
                                onChange={(event) => onExcerptChange?.(event.target.value)}
                            />
                        </label>
                    ) : null}
                    {sidebarExtra}
                </aside>
            </div>
        </div>
    )
}
