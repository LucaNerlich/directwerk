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
    createCustomArticleFeed,
    deleteCustomArticleFeed,
    listPublicArticleCategories,
    previewCustomArticleFeed,
    rotateArticleFeedToken,
    setArticleFeedEnabledForUser,
    updateCustomArticleFeed,
} from '@/lib/api/client'
import {AUTH_REQUIRED} from '@directwerk/api/constants'
import type {ArticleFeedPreview, ArticleFeedView, PublicCategory} from '@directwerk/api/types'
import {formatPublishedAt} from '@directwerk/api/format/datetime'

interface ArticleCustomFeedsPanelProps {
    tenantHost: string
    feeds: ArticleFeedView[]
    canBuild: boolean
    onFeedsChange: (feeds: ArticleFeedView[]) => void
    onError: (message: string) => void
    onAuthRequired: () => void
}

const MAX_CUSTOM_FEEDS = 5

export default function ArticleCustomFeedsPanel({
    tenantHost,
    feeds,
    canBuild,
    onFeedsChange,
    onError,
    onAuthRequired,
}: ArticleCustomFeedsPanelProps): React.JSX.Element {
    const customFeeds = feeds.filter((feed) => !feed.isDefault)
    const [categories, setCategories] = useState<PublicCategory[]>([])
    const [categoriesError, setCategoriesError] = useState<string | null>(null)
    const [title, setTitle] = useState('')
    const [selectedIds, setSelectedIds] = useState<number[]>([])
    const [editingId, setEditingId] = useState<number | null>(null)
    const [preview, setPreview] = useState<ArticleFeedPreview | null>(null)
    const [busy, setBusy] = useState(false)

    useEffect(() => {
        let active = true
        listPublicArticleCategories(tenantHost)
            .then((loaded) => {
                if (active) {
                    setCategories(loaded)
                    setCategoriesError(null)
                }
            })
            .catch((error: unknown) => {
                if (!active) {
                    return
                }
                setCategories([])
                setCategoriesError(
                    error instanceof Error
                        ? error.message
                        : 'Kategorien konnten nicht geladen werden.',
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
            previewCustomArticleFeed(tenantHost, selectedIds)
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

    function toggleCategory(categoryId: number): void {
        setSelectedIds((current) =>
            current.includes(categoryId)
                ? current.filter((id) => id !== categoryId)
                : [...current, categoryId],
        )
    }

    function startEdit(feed: ArticleFeedView): void {
        setEditingId(feed.id)
        setTitle(feed.title)
        setSelectedIds(feed.categoryIds)
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
                const created = await createCustomArticleFeed(tenantHost, title.trim(), selectedIds)
                onFeedsChange([...feeds, created])
            } else {
                const updated = await updateCustomArticleFeed(
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

    async function handleToggle(feed: ArticleFeedView): Promise<void> {
        setBusy(true)
        try {
            const updated = await setArticleFeedEnabledForUser(tenantHost, feed.id, !feed.enabled)
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

    async function handleRotate(feed: ArticleFeedView): Promise<void> {
        if (
            !window.confirm(
                'Token erneuern? Feed-Reader müssen die neue URL speichern.',
            )
        ) {
            return
        }
        setBusy(true)
        try {
            const updated = await rotateArticleFeedToken(tenantHost, feed.id)
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

    async function handleDelete(feed: ArticleFeedView): Promise<void> {
        if (!window.confirm(`Feed „${feed.title}“ wirklich löschen?`)) {
            return
        }
        setBusy(true)
        try {
            await deleteCustomArticleFeed(tenantHost, feed.id)
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
        canBuild && categories.length > 0 && (editingId !== null || !atFeedLimit)
    const canSave = title.trim().length > 0 && selectedIds.length > 0 && !busy

    return (
        <section className="flex flex-col gap-4">
            <SectionHeader
                description="Baue private RSS-Feeds nur mit den Kategorien, die dich interessieren. Es erscheinen nur Beiträge, die du freigeschaltet hast."
                title="Eigene Feeds (Kategorien)"
            />
            {categoriesError !== null ? (
                <Alert variant="destructive">
                    <AlertDescription>{categoriesError}</AlertDescription>
                </Alert>
            ) : null}
            {canBuild && categories.length === 0 && categoriesError === null ? (
                <p className="text-sm text-muted-foreground">
                    Der Verlag hat noch keine Kategorien angelegt.
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
                                <legend className="mb-1 text-sm font-medium">Kategorien</legend>
                                {categories.map((category) => (
                                    <label
                                        className="flex cursor-pointer items-center gap-2 text-sm font-normal"
                                        key={category.id}
                                    >
                                        <Checkbox
                                            checked={selectedIds.includes(category.id)}
                                            onCheckedChange={() => toggleCategory(category.id)}
                                        />
                                        <span>{category.name}</span>
                                    </label>
                                ))}
                            </fieldset>
                            {preview !== null ? (
                                <p className="text-sm text-muted-foreground">
                                    Dieser Feed enthält aktuell {preview.articleCount}{' '}
                                    {preview.articleCount === 1 ? 'Beitrag' : 'Beiträge'}
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
                                    {feed.categories.length > 0
                                        ? feed.categories.map((item) => item.name).join(', ')
                                        : 'Keine Kategorien'}{' '}
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
                                {canBuild && categories.length > 0 ? (
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
