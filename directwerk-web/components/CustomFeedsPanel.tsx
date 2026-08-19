'use client'

import {useEffect, useState} from 'react'

import {Button} from '@directwerk/ui/components/button'
import {Input} from '@directwerk/ui/components/input'

import {
    createCustomFeed,
    deleteCustomFeed,
    listPublicFormats,
    previewCustomFeed,
    rotateFeedToken,
    setFeedEnabled,
    updateCustomFeed,
} from '@/lib/api/client'
import {AUTH_REQUIRED} from '@/lib/api/errors'
import type {FeedPreview, PublicFormat, SubscriberFeed} from '@/lib/api/types'
import {formatPublishedAt} from '@/lib/format'

interface CustomFeedsPanelProps {
    tenantHost: string
    feeds: SubscriberFeed[]
    canBuild: boolean
    onFeedsChange: (feeds: SubscriberFeed[]) => void
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
                .catch(() => {
                    if (active) {
                        setPreview(null)
                    }
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

    function startEdit(feed: SubscriberFeed): void {
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

    async function handleToggle(feed: SubscriberFeed): Promise<void> {
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

    async function handleRotate(feed: SubscriberFeed): Promise<void> {
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

    async function handleDelete(feed: SubscriberFeed): Promise<void> {
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
        <section className="space-y-4">
            <h2>Eigene Feeds (Formate)</h2>
            <p className="text-sm text-muted-foreground">
                Baue private RSS-Feeds nur mit den Formaten, die du hören willst.
                Es erscheinen nur Folgen, die du freigeschaltet hast.
            </p>
            {formatsError !== null && <p role="alert">{formatsError}</p>}
            {canBuild && formats.length === 0 && formatsError === null ? (
                <p>Der Verlag hat noch keine Formate angelegt.</p>
            ) : null}
            {canBuild && atFeedLimit && editingId === null ? (
                <p>Du kannst höchstens {MAX_CUSTOM_FEEDS} eigene Feeds anlegen.</p>
            ) : null}
            {showCreateForm ? (
                <form
                    className="space-y-3 rounded-lg border p-4"
                    onSubmit={(event) => {
                        event.preventDefault()
                        void handleSave()
                    }}
                >
                    <h3>{editingId === null ? 'Neuen Feed anlegen' : 'Feed bearbeiten'}</h3>
                    <label className="block space-y-1 text-sm">
                        <span>Name</span>
                        <Input
                            maxLength={80}
                            onChange={(event) => setTitle(event.target.value)}
                            value={title}
                        />
                    </label>
                    <fieldset className="space-y-2">
                        <legend className="text-sm">Formate</legend>
                        {formats.map((format) => (
                            <label className="flex items-center gap-2 text-sm" key={format.id}>
                                <input
                                    checked={selectedIds.includes(format.id)}
                                    onChange={() => toggleFormat(format.id)}
                                    type="checkbox"
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
                            <Button
                                onClick={resetForm}
                                type="button"
                                variant="outline"
                            >
                                Abbrechen
                            </Button>
                        ) : null}
                    </div>
                </form>
            ) : null}
            {customFeeds.length === 0 ? (
                <p>Noch keine eigenen Feeds.</p>
            ) : (
                <ul className="space-y-4">
                    {customFeeds.map((feed) => (
                        <li key={feed.id}>
                            <h3>{feed.title}</h3>
                            <p>
                                <small>
                                    {feed.enabled ? 'Aktiv' : 'Deaktiviert'}
                                    {feed.formats.length > 0
                                        ? ` · ${feed.formats.map((item) => item.name).join(', ')}`
                                        : ''}{' '}
                                    · aktualisiert {formatPublishedAt(feed.updatedAt)}
                                </small>
                            </p>
                            {feed.enabled ? (
                                <p className="break-all">
                                    <a href={feed.url} rel="noreferrer">
                                        {feed.url}
                                    </a>
                                </p>
                            ) : (
                                <p>Dieser Feed ist derzeit deaktiviert.</p>
                            )}
                            <div className="mt-2 flex flex-wrap gap-2">
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
                        </li>
                    ))}
                </ul>
            )}
        </section>
    )
}
