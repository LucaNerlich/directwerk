'use client'

import {useEffect, useState} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Badge} from '@directwerk/ui/components/badge'
import {Button} from '@directwerk/ui/components/button'
import {Card, CardContent, CardHeader, CardTitle} from '@directwerk/ui/components/card'
import {Checkbox} from '@directwerk/ui/components/checkbox'
import {Input} from '@directwerk/ui/components/input'
import ListPanel, {ListPanelRow} from '@directwerk/ui/components/list-panel'
import SectionHeader from '@directwerk/ui/components/section-header'

import FeedUrlDisplay from '@/components/FeedUrlDisplay'
import {
    createCustomFeed,
    deleteCustomFeed,
    listPublicFormats,
    previewCustomFeed,
    rotateFeedToken,
    setFeedEnabled,
    updateCustomFeed,
} from '@/lib/api/client'
import {AUTH_REQUIRED} from '@directwerk/api/constants'
import type {FeedPreview, PublicFormat, SubscriberFeedView} from '@directwerk/api/types'
import {formatPublishedAt} from '@directwerk/api/format/datetime'
import {userFacingFeedsError} from '@/lib/billing/userFacingBillingError'

interface CustomFeedsPanelProps {
    tenantHost: string
    feeds: SubscriberFeedView[]
    canBuild: boolean
    onFeedsChange: (feeds: SubscriberFeedView[]) => void
    onError: (message: string) => void
    onAuthRequired: () => void
}

const MAX_CUSTOM_FEEDS = 5

type RowAction = 'toggle' | 'rotate' | 'delete'

export default function CustomFeedsPanel({
    tenantHost,
    feeds,
    canBuild,
    onFeedsChange,
    onError,
    onAuthRequired,
}: CustomFeedsPanelProps): React.JSX.Element {
    const customFeeds = feeds.filter((feed) => !feed.isDefault)
    const [formats, setFormats] = useState<PublicFormat[]>([])
    const [formatsError, setFormatsError] = useState<string | null>(null)
    const [title, setTitle] = useState('')
    const [selectedIds, setSelectedIds] = useState<number[]>([])
    const [editingId, setEditingId] = useState<number | null>(null)
    const [preview, setPreview] = useState<FeedPreview | null>(null)
    const [previewError, setPreviewError] = useState<string | null>(null)
    const [isSaving, setIsSaving] = useState(false)
    const [pendingFeedId, setPendingFeedId] = useState<number | null>(null)
    const [pendingAction, setPendingAction] = useState<RowAction | null>(null)

    useEffect(() => {
        let active = true
        listPublicFormats(tenantHost)
            .then((loaded) => {
                if (active) {
                    setFormats(loaded)
                    setFormatsError(null)
                }
            })
            .catch((error: unknown) => {
                if (!active) {
                    return
                }
                setFormats([])
                setFormatsError(userFacingFeedsError(error))
            })
        return () => {
            active = false
        }
    }, [tenantHost])

    useEffect(() => {
        if (!canBuild || selectedIds.length === 0) {
            setPreview(null)
            setPreviewError(null)
            return
        }
        let active = true
        const handle = window.setTimeout(() => {
            previewCustomFeed(tenantHost, selectedIds)
                .then((result) => {
                    if (active) {
                        setPreview(result)
                        setPreviewError(null)
                    }
                })
                .catch((error: unknown) => {
                    if (!active) {
                        return
                    }
                    if (handleAuth(error)) {
                        return
                    }
                    setPreview(null)
                    setPreviewError(userFacingFeedsError(error))
                })
        }, 250)
        return () => {
            active = false
            window.clearTimeout(handle)
        }
    }, [tenantHost, selectedIds, canBuild])

    function handleAuth(error: unknown): boolean {
        if (error instanceof Error && error.message === AUTH_REQUIRED) {
            onAuthRequired()
            return true
        }
        return false
    }

    function isRowBusy(feedId: number, action?: RowAction): boolean {
        if (pendingFeedId !== feedId) {
            return false
        }
        if (action === undefined) {
            return true
        }
        return pendingAction === action
    }

    function toggleFormat(formatId: number): void {
        setSelectedIds((current) =>
            current.includes(formatId)
                ? current.filter((id) => id !== formatId)
                : [...current, formatId],
        )
    }

    function startEdit(feed: SubscriberFeedView): void {
        setEditingId(feed.id)
        setTitle(feed.title)
        setSelectedIds(feed.formatIds)
    }

    function resetForm(): void {
        setEditingId(null)
        setTitle('')
        setSelectedIds([])
        setPreview(null)
        setPreviewError(null)
    }

    async function handleSave(): Promise<void> {
        setIsSaving(true)
        try {
            if (editingId === null) {
                const created = await createCustomFeed(tenantHost, title.trim(), selectedIds)
                onFeedsChange([...feeds, created])
            } else {
                const updated = await updateCustomFeed(
                    tenantHost,
                    editingId,
                    title.trim(),
                    selectedIds,
                )
                onFeedsChange(feeds.map((feed) => (feed.id === updated.id ? updated : feed)))
            }
            resetForm()
        } catch (error: unknown) {
            if (handleAuth(error)) {
                return
            }
            onError(userFacingFeedsError(error))
        } finally {
            setIsSaving(false)
        }
    }

    async function handleToggle(feed: SubscriberFeedView): Promise<void> {
        setPendingFeedId(feed.id)
        setPendingAction('toggle')
        try {
            const updated = await setFeedEnabled(tenantHost, feed.id, !feed.enabled)
            onFeedsChange(feeds.map((item) => (item.id === updated.id ? updated : item)))
        } catch (error: unknown) {
            if (handleAuth(error)) {
                return
            }
            onError(userFacingFeedsError(error))
        } finally {
            setPendingFeedId(null)
            setPendingAction(null)
        }
    }

    async function handleRotate(feed: SubscriberFeedView): Promise<void> {
        if (
            !window.confirm(
                'Token erneuern? Die alte URL wird sofort ungültig. Trage die neue URL danach in deiner Podcast-App ein.',
            )
        ) {
            return
        }
        setPendingFeedId(feed.id)
        setPendingAction('rotate')
        try {
            const updated = await rotateFeedToken(tenantHost, feed.id)
            onFeedsChange(feeds.map((item) => (item.id === updated.id ? updated : item)))
        } catch (error: unknown) {
            if (handleAuth(error)) {
                return
            }
            onError(userFacingFeedsError(error))
        } finally {
            setPendingFeedId(null)
            setPendingAction(null)
        }
    }

    async function handleDelete(feed: SubscriberFeedView): Promise<void> {
        if (!window.confirm(`Feed „${feed.title}“ wirklich löschen?`)) {
            return
        }
        setPendingFeedId(feed.id)
        setPendingAction('delete')
        try {
            await deleteCustomFeed(tenantHost, feed.id)
            onFeedsChange(feeds.filter((item) => item.id !== feed.id))
            if (editingId === feed.id) {
                resetForm()
            }
        } catch (error: unknown) {
            if (handleAuth(error)) {
                return
            }
            onError(userFacingFeedsError(error))
        } finally {
            setPendingFeedId(null)
            setPendingAction(null)
        }
    }

    const atFeedLimit = customFeeds.length >= MAX_CUSTOM_FEEDS
    const showCreateForm =
        canBuild && formats.length > 0 && (editingId !== null || !atFeedLimit)
    const isRowMutationPending = pendingFeedId !== null
    const canSave =
        title.trim().length > 0 &&
        selectedIds.length > 0 &&
        !isSaving &&
        !isRowMutationPending
    const showEditHiddenHint =
        !canBuild && customFeeds.length > 0

    return (
        <section className="flex flex-col gap-4">
            <SectionHeader
                description="Baue private RSS-Feeds nur mit den Formaten, die du hören willst. Es erscheinen nur Folgen, die du freigeschaltet hast."
                title="Eigene Feeds (Formate)"
            />
            {formatsError !== null ? (
                <Alert variant="destructive">
                    <AlertDescription>{formatsError}</AlertDescription>
                </Alert>
            ) : null}
            {canBuild && formats.length === 0 && formatsError === null ? (
                <p className="text-sm text-muted-foreground">
                    Der Verlag hat noch keine Formate angelegt.
                </p>
            ) : null}
            {canBuild && atFeedLimit && editingId === null ? (
                <p className="text-sm text-muted-foreground">
                    Du kannst höchstens {MAX_CUSTOM_FEEDS} eigene Feeds anlegen.
                </p>
            ) : null}
            {showEditHiddenHint ? (
                <p className="text-sm text-muted-foreground">
                    Neue Feeds anlegen und bearbeiten ist für dieses Angebot
                    deaktiviert. Deine bestehenden Feeds bleiben nutzbar — du
                    kannst sie weiterhin aktivieren, das Token erneuern oder
                    löschen.
                </p>
            ) : null}
            {showCreateForm ? (
                <Card>
                    <CardHeader>
                        <CardTitle>
                            {editingId === null ? 'Neuen Feed anlegen' : 'Feed bearbeiten'}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form
                            className="flex flex-col gap-4"
                            onSubmit={(event) => {
                                event.preventDefault()
                                void handleSave()
                            }}
                        >
                            <label className="grid gap-2 text-sm font-medium">
                                <span>Name</span>
                                <Input
                                    maxLength={80}
                                    onChange={(event) => setTitle(event.target.value)}
                                    value={title}
                                />
                            </label>
                            <fieldset className="flex flex-col gap-2 border-0 p-0">
                                <legend className="mb-1 text-sm font-medium">Formate</legend>
                                {formats.map((format) => (
                                    <label
                                        className="flex cursor-pointer items-center gap-2 text-sm font-normal"
                                        key={format.id}
                                    >
                                        <Checkbox
                                            checked={selectedIds.includes(format.id)}
                                            onCheckedChange={() => toggleFormat(format.id)}
                                        />
                                        <span>
                                            {format.name}
                                            {format.requiredLevelSortOrder !== null
                                                ? ` (ab Stufe ${format.requiredLevelSortOrder})`
                                                : null}
                                        </span>
                                    </label>
                                ))}
                            </fieldset>
                            {previewError !== null ? (
                                <p className="text-sm text-muted-foreground" role="status">
                                    {previewError} Speichern ist trotzdem möglich.
                                </p>
                            ) : null}
                            {preview !== null ? (
                                <p className="text-sm text-muted-foreground" role="status">
                                    Dieser Feed enthält aktuell {preview.episodeCount}{' '}
                                    {preview.episodeCount === 1 ? 'Folge' : 'Folgen'}
                                    {preview.sampleTitles.length > 0
                                        ? `: ${preview.sampleTitles.join(', ')}`
                                        : '.'}
                                </p>
                            ) : null}
                            <div className="flex flex-wrap gap-2">
                                <Button disabled={!canSave} type="submit">
                                    {isSaving
                                        ? 'Wird gespeichert…'
                                        : editingId === null
                                          ? 'Feed speichern'
                                          : 'Änderungen speichern'}
                                </Button>
                                {editingId !== null ? (
                                    <Button onClick={resetForm} type="button" variant="outline">
                                        Abbrechen
                                    </Button>
                                ) : null}
                            </div>
                        </form>
                    </CardContent>
                </Card>
            ) : null}
            {customFeeds.length === 0 ? (
                <p className="text-sm text-muted-foreground">Noch keine eigenen Feeds.</p>
            ) : (
                <ListPanel>
                    {customFeeds.map((feed) => (
                        <ListPanelRow key={feed.id}>
                            <div className="min-w-0 flex-1 space-y-3">
                                <div className="flex flex-wrap items-center gap-2">
                                    <p className="font-medium">{feed.title}</p>
                                    <Badge variant={feed.enabled ? 'secondary' : 'outline'}>
                                        {feed.enabled ? 'Aktiv' : 'Deaktiviert'}
                                    </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    {feed.formats.length > 0
                                        ? feed.formats.map((item) => item.name).join(', ')
                                        : 'Keine Formate'}{' '}
                                    · aktualisiert {formatPublishedAt(feed.updatedAt)}
                                </p>
                                <div className={feed.enabled ? undefined : 'opacity-70'}>
                                    <FeedUrlDisplay url={feed.url} />
                                    {!feed.enabled ? (
                                        <p className="mt-2 text-sm text-muted-foreground">
                                            Deaktiviert — die URL ist sichtbar, aber
                                            Podcast-Apps können sie erst nach dem
                                            Aktivieren wieder abrufen.
                                        </p>
                                    ) : null}
                                </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    disabled={isSaving || isRowMutationPending}
                                    onClick={() => void handleToggle(feed)}
                                    size="sm"
                                    type="button"
                                    variant="outline"
                                >
                                    {isRowBusy(feed.id, 'toggle')
                                        ? 'Wird umgeschaltet…'
                                        : feed.enabled
                                          ? 'Deaktivieren'
                                          : 'Aktivieren'}
                                </Button>
                                <Button
                                    disabled={isSaving || isRowMutationPending}
                                    onClick={() => void handleRotate(feed)}
                                    size="sm"
                                    type="button"
                                    variant="outline"
                                >
                                    {isRowBusy(feed.id, 'rotate')
                                        ? 'Wird erneuert…'
                                        : 'Token erneuern'}
                                </Button>
                                {canBuild && formats.length > 0 ? (
                                    <Button
                                        disabled={isSaving || isRowMutationPending}
                                        onClick={() => startEdit(feed)}
                                        size="sm"
                                        type="button"
                                        variant="outline"
                                    >
                                        Bearbeiten
                                    </Button>
                                ) : null}
                                <Button
                                    disabled={isSaving || isRowMutationPending}
                                    onClick={() => void handleDelete(feed)}
                                    size="sm"
                                    type="button"
                                    variant="outline"
                                >
                                    {isRowBusy(feed.id, 'delete')
                                        ? 'Wird gelöscht…'
                                        : 'Löschen'}
                                </Button>
                            </div>
                        </ListPanelRow>
                    ))}
                </ListPanel>
            )}
        </section>
    )
}
