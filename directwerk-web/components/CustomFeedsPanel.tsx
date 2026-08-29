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

interface CustomFeedsPanelProps {
    tenantHost: string
    feeds: SubscriberFeedView[]
    canBuild: boolean
    onFeedsChange: (feeds: SubscriberFeedView[]) => void
    onError: (message: string) => void
    onAuthRequired: () => void
}

const MAX_CUSTOM_FEEDS = 5

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
    const [busy, setBusy] = useState(false)

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
                setFormatsError(
                    error instanceof Error
                        ? error.message
                        : 'Formate konnten nicht geladen werden.',
                )
            })
        return () => {
            active = false
        }
    }, [tenantHost])

    useEffect(() => {
        if (!canBuild || selectedIds.length === 0) {
            setPreview(null)
            return
        }
        let active = true
        const handle = window.setTimeout(() => {
            previewCustomFeed(tenantHost, selectedIds)
                .then((result) => {
                    if (active) {
                        setPreview(result)
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
                    onError(
                        error instanceof Error
                            ? error.message
                            : 'Vorschau konnte nicht geladen werden.',
                    )
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
    }

    async function handleSave(): Promise<void> {
        setBusy(true)
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
            onError(
                error instanceof Error
                    ? error.message
                    : 'Feed konnte nicht gespeichert werden.',
            )
        } finally {
            setBusy(false)
        }
    }

    async function handleToggle(feed: SubscriberFeedView): Promise<void> {
        setBusy(true)
        try {
            const updated = await setFeedEnabled(tenantHost, feed.id, !feed.enabled)
            onFeedsChange(feeds.map((item) => (item.id === updated.id ? updated : item)))
        } catch (error: unknown) {
            if (handleAuth(error)) {
                return
            }
            onError(
                error instanceof Error
                    ? error.message
                    : 'Feed konnte nicht aktualisiert werden.',
            )
        } finally {
            setBusy(false)
        }
    }

    async function handleRotate(feed: SubscriberFeedView): Promise<void> {
        if (
            !window.confirm(
                'Token erneuern? Podcast-Apps müssen die neue URL speichern.',
            )
        ) {
            return
        }
        setBusy(true)
        try {
            const updated = await rotateFeedToken(tenantHost, feed.id)
            onFeedsChange(feeds.map((item) => (item.id === updated.id ? updated : item)))
        } catch (error: unknown) {
            if (handleAuth(error)) {
                return
            }
            onError(
                error instanceof Error
                    ? error.message
                    : 'Token konnte nicht erneuert werden.',
            )
        } finally {
            setBusy(false)
        }
    }

    async function handleDelete(feed: SubscriberFeedView): Promise<void> {
        if (!window.confirm(`Feed „${feed.title}“ wirklich löschen?`)) {
            return
        }
        setBusy(true)
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
            onError(
                error instanceof Error
                    ? error.message
                    : 'Feed konnte nicht gelöscht werden.',
            )
        } finally {
            setBusy(false)
        }
    }

    const atFeedLimit = customFeeds.length >= MAX_CUSTOM_FEEDS
    const showCreateForm =
        canBuild && formats.length > 0 && (editingId !== null || !atFeedLimit)
    const canSave = title.trim().length > 0 && selectedIds.length > 0 && !busy

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
                            {preview !== null ? (
                                <p className="text-sm text-muted-foreground">
                                    Dieser Feed enthält aktuell {preview.episodeCount}{' '}
                                    {preview.episodeCount === 1 ? 'Folge' : 'Folgen'}
                                    {preview.sampleTitles.length > 0
                                        ? `: ${preview.sampleTitles.join(', ')}`
                                        : '.'}
                                </p>
                            ) : null}
                            <div className="flex flex-wrap gap-2">
                                <Button disabled={!canSave} type="submit">
                                    {editingId === null ? 'Feed speichern' : 'Änderungen speichern'}
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
                                {feed.enabled ? (
                                    <FeedUrlDisplay url={feed.url} />
                                ) : (
                                    <p className="text-sm text-muted-foreground">
                                        Dieser Feed ist derzeit deaktiviert.
                                    </p>
                                )}
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    disabled={busy}
                                    onClick={() => void handleToggle(feed)}
                                    size="sm"
                                    type="button"
                                    variant="outline"
                                >
                                    {feed.enabled ? 'Deaktivieren' : 'Aktivieren'}
                                </Button>
                                <Button
                                    disabled={busy}
                                    onClick={() => void handleRotate(feed)}
                                    size="sm"
                                    type="button"
                                    variant="outline"
                                >
                                    Token erneuern
                                </Button>
                                {canBuild && formats.length > 0 ? (
                                    <Button
                                        disabled={busy}
                                        onClick={() => startEdit(feed)}
                                        size="sm"
                                        type="button"
                                        variant="outline"
                                    >
                                        Bearbeiten
                                    </Button>
                                ) : null}
                                <Button
                                    disabled={busy}
                                    onClick={() => void handleDelete(feed)}
                                    size="sm"
                                    type="button"
                                    variant="outline"
                                >
                                    Löschen
                                </Button>
                            </div>
                        </ListPanelRow>
                    ))}
                </ListPanel>
            )}
        </section>
    )
}
