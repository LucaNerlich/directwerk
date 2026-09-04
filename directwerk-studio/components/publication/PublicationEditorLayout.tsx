'use client'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Badge} from '@directwerk/ui/components/badge'
import {Button} from '@directwerk/ui/components/button'
import {Card, CardContent} from '@directwerk/ui/components/card'
import {Input} from '@directwerk/ui/components/input'
import PageStack from '@directwerk/ui/components/page-stack'
import SectionHeader from '@directwerk/ui/components/section-header'
import {Textarea} from '@directwerk/ui/components/textarea'

import Link from 'next/link'
import type {KeyboardEvent, ReactNode} from 'react'
import {useId, useState} from 'react'

import AccessPolicySelect from '@/components/publication/AccessPolicySelect'
import PublishConfirmDialog from '@/components/publication/PublishConfirmDialog'
import PublicationStatusBadge from '@/components/publication/PublicationStatusBadge'
import PublicationWorkflowActions from '@/components/publication/PublicationWorkflowActions'
import SlugField from '@/components/publication/SlugField'
import LevelSelect from '@/components/studio/LevelSelect'
import {ShowNotesEditor} from '@/lib/dynamic/studioHeavy'
import {rbacErrorMessage} from '@/lib/rbac/access'
import {safeLinkHref} from '@/lib/url/safeUrl'
import type {AccessPolicy, PublicationStatus} from '@directwerk/api/types'
import {sanitizeContentHtml} from '@directwerk/api/content/sanitizeContentHtml'

interface PublicationEditorLayoutProps {
    kind: 'article' | 'episode'
    status: PublicationStatus
    title: string
    body: string
    accessPolicy: AccessPolicy
    slug?: string
    excerpt?: string
    seoDescription?: string
    requiredLevelSortOrder?: number | null
    onRequiredLevelChange?: (value: number | null) => void
    onTitleChange: (value: string) => void
    onBodyChange: (value: string) => void
    onAccessPolicyChange: (value: AccessPolicy) => void
    onSlugChange?: (value: string) => void
    onExcerptChange?: (value: string) => void
    onSeoDescriptionChange?: (value: string) => void
    slugTaken?: (slug: string) => boolean
    isSaving: boolean
    isDirty?: boolean
    saveHint?: string | null
    errorMessage: string | null
    /** RBAC read-only lock (issue #148): disables fields and workflow actions with reason. */
    readOnlyReason?: string | null
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
    backHref?: string
    backLabel?: string
    previewImageUrl?: string | null
    previewImageAlt?: string
    previewExcerpt?: string
    previewUrl?: string | null
    previewUrlHint?: string
    onAuthRequired?: () => void
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
    requiredLevelSortOrder,
    onRequiredLevelChange,
    onTitleChange,
    onBodyChange,
    onAccessPolicyChange,
    onSlugChange,
    onExcerptChange,
    onSeoDescriptionChange,
    slugTaken,
    isSaving,
    isDirty = false,
    saveHint = null,
    errorMessage,
    readOnlyReason = null,
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
    backHref,
    backLabel,
    previewImageUrl = null,
    previewImageAlt = '',
    previewExcerpt,
    previewUrl = null,
    previewUrlHint,
    onAuthRequired,
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
    const readOnly = readOnlyReason !== null
    const fieldsDisabled = isSaving || status !== 'DRAFT' || readOnly
    const publicationLabel = kind === 'episode' ? 'Folge' : 'Beitrag'
    const resolvedBackHref = backHref ?? (kind === 'episode' ? '/podcast/episodes' : '/write/articles')
    const resolvedBackLabel = backLabel ?? (kind === 'episode' ? 'Alle Folgen' : 'Alle Beiträge')
    const [publishDialogOpen, setPublishDialogOpen] = useState(false)
    const [activeTab, setActiveTab] = useState<'write' | 'preview'>('write')
    const tabIdPrefix = useId()
    const writeTabId = `${tabIdPrefix}-write-tab`
    const previewTabId = `${tabIdPrefix}-preview-tab`
    const writePanelId = `${tabIdPrefix}-write-panel`
    const previewPanelId = `${tabIdPrefix}-preview-panel`

    const slugBlocked =
        slug !== undefined &&
        slugTaken !== undefined &&
        slug.trim().length > 0 &&
        slugTaken(slug.trim())

    const publishDisabled = !canPublish || slugBlocked
    const blockedReason = slugBlocked ? 'Slug ist bereits vergeben.' : publishBlockedReason
    const isDraft = status === 'DRAFT'
    const isScheduled = status === 'SCHEDULED'
    const isPublished = status === 'PUBLISHED'
    const isArchived = status === 'ARCHIVED'
    const previewLink = previewUrl !== null ? safeLinkHref(previewUrl) : null
    const sanitizedBody = sanitizeContentHtml(body)

    const handleTabKeyDown = (
        event: KeyboardEvent<HTMLButtonElement>,
        currentTab: 'write' | 'preview',
    ): void => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
            return
        }
        event.preventDefault()
        const nextTab = currentTab === 'write' ? 'preview' : 'write'
        setActiveTab(nextTab)
        document.getElementById(nextTab === 'write' ? writeTabId : previewTabId)?.focus()
    }

    return (
        <PageStack className="gap-0">
            <div className="sticky top-0 z-20 -mx-4 border-b bg-background/95 px-4 py-2.5 backdrop-blur supports-backdrop-filter:bg-background/80">
                <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2">
                    <Button nativeButton={false} render={<Link href={resolvedBackHref} />} size="sm" variant="ghost">
                        ← {resolvedBackLabel}
                    </Button>
                    <PublicationStatusBadge status={status} />
                    {isDirty && !isSaving ? (
                        <Badge variant="outline">Ungespeichert</Badge>
                    ) : null}
                    <p aria-live="polite" className="min-w-16 text-xs text-muted-foreground" role="status">
                        {isSaving ? 'Speichert…' : (saveHint ?? '')}
                    </p>
                    <div className="ml-auto flex flex-wrap items-center gap-2">
                        {isDraft ? (
                            <Button disabled={isSaving || readOnly} onClick={onSave} size="sm" type="button" variant="outline">
                                {isSaving ? 'Speichert…' : 'Speichern'}
                            </Button>
                        ) : null}
                        {(isDraft || isScheduled) ? (
                            <Button
                                disabled={isSaving || readOnly || publishDisabled}
                                onClick={() => setPublishDialogOpen(true)}
                                size="sm"
                                title={blockedReason ?? undefined}
                                type="button"
                            >
                                Veröffentlichen
                            </Button>
                        ) : null}
                        {isPublished ? (
                            <>
                                <Button disabled={isSaving || readOnly} onClick={onUnpublish} size="sm" type="button" variant="outline">
                                    Zurückziehen
                                </Button>
                                <Button disabled={isSaving || readOnly} onClick={onArchive} size="sm" type="button" variant="outline">
                                    Archivieren
                                </Button>
                            </>
                        ) : null}
                        {isScheduled ? (
                            <Button disabled={isSaving || readOnly} onClick={onCancelSchedule} size="sm" type="button" variant="outline">
                                Planung aufheben
                            </Button>
                        ) : null}
                        {isArchived ? (
                            <Button disabled={isSaving || readOnly} onClick={onUnarchive} size="sm" type="button">
                                Wiederherstellen
                            </Button>
                        ) : null}
                    </div>
                </div>
            </div>
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
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 py-6">
            {errorMessage !== null && (
                <Alert variant="destructive">
                    <AlertDescription>{rbacErrorMessage(new Error(errorMessage))}</AlertDescription>
                </Alert>
            )}
            {readOnlyReason !== null ? (
                <Alert>
                    <AlertDescription>{readOnlyReason}</AlertDescription>
                </Alert>
            ) : null}
            {(isDraft || isScheduled) && blockedReason !== null ? (
                <Alert>
                    <AlertDescription>Vor dem Veröffentlichen: {blockedReason}</AlertDescription>
                </Alert>
            ) : null}
            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
                <Card>
                    <CardContent className="flex flex-col gap-5 pt-(--card-spacing)">
                        <SectionHeader
                            description={
                                kind === 'episode'
                                    ? 'Titel, URL und Shownotes — mit Vorschau und Medien aus der Mediathek.'
                                    : 'Titel, URL und Text — mit Vorschau und Medien aus der Mediathek.'
                            }
                            id="publication-content-heading"
                            title="Inhalt"
                        />
                        {status !== 'DRAFT' ? (
                            <Alert>
                                <AlertDescription>
                                    Diese {publicationLabel} ist {status === 'PUBLISHED' ? 'veröffentlicht' : status === 'SCHEDULED' ? 'geplant' : 'archiviert'} — Felder sind gesperrt. Zum Bearbeiten {status === 'ARCHIVED' ? 'wiederherstellen' : 'zurückziehen oder die Planung aufheben'}.
                                </AlertDescription>
                            </Alert>
                        ) : null}
                        <label className="grid gap-2">
                            <span className="text-sm font-medium">Titel</span>
                            <Input
                                aria-describedby="publication-title-hint"
                                className="text-lg font-semibold"
                                value={title}
                                disabled={fieldsDisabled}
                                maxLength={255}
                                placeholder="Titel eingeben…"
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
                        {kind === 'article' ? (
                            <label className="grid gap-2 text-sm font-medium">
                                <span>Auszug</span>
                                <Textarea
                                    rows={3}
                                    value={excerpt ?? ''}
                                    disabled={fieldsDisabled}
                                    placeholder="Teaser für Karten und E-Mail-Benachrichtigungen…"
                                    onChange={(event) => onExcerptChange?.(event.target.value)}
                                />
                                <span className="text-xs font-normal text-muted-foreground">
                                    Teaser für Karten und E-Mail-Benachrichtigungen.
                                </span>
                            </label>
                        ) : null}
                        <div className="flex gap-1 border-b pb-3" role="tablist" aria-label="Inhalt oder Vorschau">
                            <Button
                                aria-controls={writePanelId}
                                aria-selected={activeTab === 'write'}
                                id={writeTabId}
                                onClick={() => setActiveTab('write')}
                                onKeyDown={(event) => handleTabKeyDown(event, 'write')}
                                role="tab"
                                size="sm"
                                tabIndex={activeTab === 'write' ? 0 : -1}
                                type="button"
                                variant={activeTab === 'write' ? 'secondary' : 'ghost'}
                            >
                                Schreiben
                            </Button>
                            <Button
                                aria-controls={previewPanelId}
                                aria-selected={activeTab === 'preview'}
                                id={previewTabId}
                                onClick={() => setActiveTab('preview')}
                                onKeyDown={(event) => handleTabKeyDown(event, 'preview')}
                                role="tab"
                                size="sm"
                                tabIndex={activeTab === 'preview' ? 0 : -1}
                                type="button"
                                variant={activeTab === 'preview' ? 'secondary' : 'ghost'}
                            >
                                Vorschau
                            </Button>
                        </div>
                        <div
                            aria-labelledby={writeTabId}
                            hidden={activeTab !== 'write'}
                            id={writePanelId}
                            role="tabpanel"
                            tabIndex={activeTab === 'write' ? 0 : -1}
                        >
                                <ShowNotesEditor
                                    helperText={
                                        kind === 'episode'
                                            ? 'Shownotes erscheinen im Feed und auf der Folgenseite. Über „Medium“ Bilder einbetten oder Audio/Video/Dokumente verlinken (nur öffentliche Dateien).'
                                            : 'Der Text erscheint auf der Beitragsseite und im Feed. Über „Medium“ Bilder einbetten oder Audio/Video/Dokumente verlinken (nur öffentliche Dateien).'
                                    }
                                    label={bodyLabel}
                                    value={body}
                                    onChange={onBodyChange}
                                    disabled={fieldsDisabled}
                                    onAuthRequired={onAuthRequired}
                                />
                        </div>
                        <div
                            aria-labelledby={previewTabId}
                            className="grid gap-4"
                            hidden={activeTab !== 'preview'}
                            id={previewPanelId}
                            role="tabpanel"
                            tabIndex={activeTab === 'preview' ? 0 : -1}
                        >
                                <p className="text-xs text-muted-foreground">
                                    So sieht der Text ungefähr auf der öffentlichen Seite aus. Eingebettete Bilder stammen aus der Mediathek (öffentliche Dateien).
                                </p>
                                {previewLink !== null ? (
                                    <p className="text-xs text-muted-foreground">
                                        {previewUrlHint ?? 'Öffentliche URL:'}{' '}
                                        <a
                                            className="break-all text-primary underline underline-offset-4"
                                            href={previewLink}
                                            rel="noreferrer"
                                            target="_blank"
                                        >
                                            {previewUrl}
                                        </a>
                                    </p>
                                ) : null}
                                <article className="grid gap-3 rounded-xl border bg-muted/20 p-5">
                                    {previewImageUrl !== null ? (
                                        <img
                                            alt={previewImageAlt}
                                            className="aspect-video w-full rounded-lg object-cover"
                                            src={previewImageUrl}
                                        />
                                    ) : null}
                                    <h2 className="text-pretty text-2xl font-semibold tracking-tight">
                                        {title.trim().length > 0 ? title : 'Ohne Titel'}
                                    </h2>
                                    {kind === 'article' && (previewExcerpt ?? excerpt ?? '').trim().length > 0 ? (
                                        <p className="text-sm text-muted-foreground">
                                            {previewExcerpt ?? excerpt}
                                        </p>
                                    ) : null}
                                    {body.trim().length > 0 ? (
                                        <div
                                            className="content-prose"
                                            dangerouslySetInnerHTML={{__html: sanitizedBody}}
                                        />
                                    ) : (
                                        <p className="text-sm text-muted-foreground">
                                            Noch kein Text — über „Schreiben“ Inhalte und Medien hinzufügen.
                                        </p>
                                    )}
                                </article>
                        </div>
                        {kind === 'article' && onSeoDescriptionChange !== undefined ? (
                            <details className="grid gap-2 rounded-lg border p-3">
                                <summary className="cursor-pointer text-sm font-medium">
                                    SEO-Einstellungen
                                </summary>
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
                            </details>
                        ) : null}
                    </CardContent>
                </Card>
                <div className="flex min-w-0 flex-col gap-4">
                    <Card>
                        <CardContent className="flex flex-col gap-4 pt-(--card-spacing)">
                            <SectionHeader
                                as="h3"
                                description="Wer darf lesen? Gilt für Seite und Feed."
                                title="Zugriff"
                            />
                            <AccessPolicySelect
                                value={accessPolicy}
                                onChange={onAccessPolicyChange}
                                disabled={fieldsDisabled}
                            />
                            {onRequiredLevelChange !== undefined ? (
                                <label className="grid gap-2 text-sm font-medium">
                                    <span>Mindest-Stufe</span>
                                    <LevelSelect
                                        disabled={fieldsDisabled || accessPolicy === 'FREE'}
                                        onChange={onRequiredLevelChange}
                                        value={requiredLevelSortOrder ?? null}
                                    />
                                    <span className="font-normal text-muted-foreground">
                                        Niedrigste Stufe, die Zugriff erhält. Zugriff hat, wessen
                                        höchste Stufe ≥ Mindest-Stufe ist. „Öffentlich“ = jede aktive
                                        Stufe reicht.
                                        {accessPolicy === 'FREE'
                                            ? ' Nur relevant für kostenpflichtige Inhalte.'
                                            : ''}
                                    </span>
                                </label>
                            ) : null}
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="flex flex-col gap-4 pt-(--card-spacing)">
                            <SectionHeader
                                as="h3"
                                description="Planen, zurückdatieren und benachrichtigen."
                                title="Veröffentlichung"
                            />
                            <PublicationWorkflowActions
                                status={status}
                                isSaving={isSaving}
                                disabled={readOnly}
                                canPublish={!publishDisabled}
                                publishBlockedReason={blockedReason}
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
                                showPrimaryActions={false}
                                onSave={onSave}
                                onPublish={() => setPublishDialogOpen(true)}
                                onSchedule={onSchedule}
                                onCancelSchedule={onCancelSchedule}
                                onUnpublish={onUnpublish}
                                onArchive={onArchive}
                                onUnarchive={onUnarchive}
                            />
                        </CardContent>
                    </Card>
                    {sidebarExtra}
                </div>
            </div>
            </div>
        </PageStack>
    )
}
