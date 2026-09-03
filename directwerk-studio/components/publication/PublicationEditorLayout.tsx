'use client'

import {Card, CardContent} from '@directwerk/ui/components/card'
import {Input} from '@directwerk/ui/components/input'
import PageStack from '@directwerk/ui/components/page-stack'
import SectionHeader from '@directwerk/ui/components/section-header'
import {Textarea} from '@directwerk/ui/components/textarea'

import type {ReactNode} from 'react'
import {useState} from 'react'

import AccessPolicySelect from '@/components/publication/AccessPolicySelect'
import PublishConfirmDialog from '@/components/publication/PublishConfirmDialog'
import PublicationStatusBadge from '@/components/publication/PublicationStatusBadge'
import PublicationWorkflowActions from '@/components/publication/PublicationWorkflowActions'
import SlugField from '@/components/publication/SlugField'
import {ShowNotesEditor} from '@/lib/dynamic/studioHeavy'
import type {AccessPolicy, PublicationStatus} from '@directwerk/api/types'

interface PublicationEditorLayoutProps {
    kind: 'article' | 'episode'
    status: PublicationStatus
    title: string
    body: string
    accessPolicy: AccessPolicy
    slug?: string
    excerpt?: string
    seoDescription?: string
    onTitleChange: (value: string) => void
    onBodyChange: (value: string) => void
    onAccessPolicyChange: (value: AccessPolicy) => void
    onSlugChange?: (value: string) => void
    onExcerptChange?: (value: string) => void
    onSeoDescriptionChange?: (value: string) => void
    slugTaken?: (slug: string) => boolean
    isSaving: boolean
    saveHint?: string | null
    errorMessage: string | null
    canPublish?: boolean
    publishBlockedReason?: string | null
    showNotify: boolean
    notifySubscribers: boolean
    onNotifyChange: (value: boolean) => void
    notifyAudienceHint?: string | null
    scheduledAt: string
    onScheduledAtChange: (value: string) => void
    publishedAt: string
    onPublishedAtChange: (value: string) => void
    publishValidationError?: string | null
    scheduleValidationError?: string | null
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
    seoDescription,
    onTitleChange,
    onBodyChange,
    onAccessPolicyChange,
    onSlugChange,
    onExcerptChange,
    onSeoDescriptionChange,
    slugTaken,
    isSaving,
    saveHint = null,
    errorMessage,
    canPublish = true,
    publishBlockedReason = null,
    showNotify,
    notifySubscribers,
    onNotifyChange,
    notifyAudienceHint = null,
    scheduledAt,
    onScheduledAtChange,
    publishedAt,
    onPublishedAtChange,
    publishValidationError = null,
    scheduleValidationError = null,
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
    const publicationLabel = kind === 'episode' ? 'Folge' : 'Beitrag'
    const [publishDialogOpen, setPublishDialogOpen] = useState(false)

    const slugBlocked =
        slug !== undefined &&
        slugTaken !== undefined &&
        slug.trim().length > 0 &&
        slugTaken(slug.trim())

    const publishDisabled = !canPublish || slugBlocked

    return (
        <PageStack className="gap-6">
            <header className="flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        {publicationLabel}
                    </p>
                    <PublicationStatusBadge status={status} />
                    <p aria-live="polite" className="mt-2 min-h-4 text-xs text-muted-foreground" role="status">
                        {isSaving ? 'Speichert…' : (saveHint ?? '')}
                    </p>
                </div>
                <PublicationWorkflowActions
                    status={status}
                    isSaving={isSaving}
                    canPublish={!publishDisabled}
                    publishBlockedReason={
                        slugBlocked
                            ? 'Slug ist bereits vergeben.'
                            : publishBlockedReason
                    }
                    showNotify={showNotify}
                    notifySubscribers={notifySubscribers}
                    onNotifyChange={onNotifyChange}
                    notifyAudienceHint={notifyAudienceHint}
                    scheduledAt={scheduledAt}
                    onScheduledAtChange={onScheduledAtChange}
                    publishedAt={publishedAt}
                    onPublishedAtChange={onPublishedAtChange}
                    publishValidationError={publishValidationError}
                    scheduleValidationError={scheduleValidationError}
                    onSave={onSave}
                    onPublish={() => setPublishDialogOpen(true)}
                    onSchedule={onSchedule}
                    onCancelSchedule={onCancelSchedule}
                    onUnpublish={onUnpublish}
                    onArchive={onArchive}
                    onUnarchive={onUnarchive}
                />
            </header>
            <PublishConfirmDialog
                isSaving={isSaving}
                notifyAudienceHint={notifyAudienceHint}
                notifySubscribers={notifySubscribers}
                onConfirm={() => {
                    setPublishDialogOpen(false)
                    onPublish()
                }}
                onNotifyChange={onNotifyChange}
                onOpenChange={setPublishDialogOpen}
                open={publishDialogOpen}
                publicationLabel={publicationLabel}
                showNotify={showNotify}
                title={title}
            />
            {errorMessage !== null && (
                <p className="text-sm text-destructive" role="alert">
                    {errorMessage}
                </p>
            )}
            <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]">
                <section aria-labelledby="publication-content-heading" className="flex min-w-0 flex-col gap-4">
                    <SectionHeader
                        description={kind === 'episode' ? 'Titel, URL und Shownotes. Audio und Formate rechts.' : 'Titel, URL und Text. Titelbild und Kategorien rechts.'}
                        id="publication-content-heading"
                        title="Inhalt"
                    />
                    <label className="grid gap-2 text-sm font-medium">
                        <span>Titel</span>
                        <Input
                            aria-describedby="publication-title-hint"
                            value={title}
                            disabled={fieldsDisabled}
                            maxLength={255}
                            onChange={(event) => onTitleChange(event.target.value)}
                        />
                        <span className="text-xs font-normal text-muted-foreground" id="publication-title-hint">
                            Wird als Überschrift und im Feed angezeigt.
                        </span>
                    </label>
                    {onSlugChange !== undefined && slug !== undefined ? (
                        slugTaken !== undefined ? (
                            <SlugField
                                checkTaken={slugTaken}
                                disabled={fieldsDisabled}
                                onChange={onSlugChange}
                                value={slug}
                            />
                        ) : (
                            <label className="grid gap-2 text-sm font-medium">
                                <span>Slug</span>
                                <Input
                                    value={slug}
                                    disabled={fieldsDisabled}
                                    onChange={(event) => onSlugChange(event.target.value)}
                                />
                            </label>
                        )
                    ) : null}
                    <ShowNotesEditor
                        helperText={kind === 'episode' ? 'Shownotes erscheinen im Feed und auf der Folgenseite.' : 'Der Text erscheint auf der Beitragsseite und im Feed.'}
                        label={bodyLabel}
                        value={body}
                        onChange={onBodyChange}
                        disabled={fieldsDisabled}
                    />
                </section>
                <Card className="h-fit bg-muted/20 ring-0">
                    <CardContent className="flex flex-col gap-4 pt-(--card-spacing)">
                        <SectionHeader
                            as="h3"
                            description="Wer darf lesen? Gilt für Seite und Feed."
                            title="Einstellungen"
                        />
                        <AccessPolicySelect
                            value={accessPolicy}
                            onChange={onAccessPolicyChange}
                            disabled={fieldsDisabled}
                        />
                        {kind === 'article' ? (
                            <>
                                <label className="grid gap-2 text-sm font-medium">
                                    <span>Auszug</span>
                                    <Textarea
                                        rows={4}
                                        value={excerpt ?? ''}
                                        disabled={fieldsDisabled}
                                        onChange={(event) => onExcerptChange?.(event.target.value)}
                                    />
                                    <span className="text-xs font-normal text-muted-foreground">
                                        Teaser für Karten und E-Mail-Benachrichtigungen.
                                    </span>
                                </label>
                                {onSeoDescriptionChange !== undefined ? (
                                    <label className="grid gap-2 text-sm font-medium">
                                        <span>SEO-Beschreibung</span>
                                        <Textarea
                                            maxLength={512}
                                            rows={3}
                                            value={seoDescription ?? ''}
                                            disabled={fieldsDisabled}
                                            onChange={(event) =>
                                                onSeoDescriptionChange(event.target.value)
                                            }
                                        />
                                        <span className="text-xs font-normal text-muted-foreground">
                                            Meta-Beschreibung für Suchmaschinen (max. 512 Zeichen).
                                        </span>
                                    </label>
                                ) : null}
                            </>
                        ) : null}
                        {sidebarExtra}
                    </CardContent>
                </Card>
            </div>
        </PageStack>
    )
}
