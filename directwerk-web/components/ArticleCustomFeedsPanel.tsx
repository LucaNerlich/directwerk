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
import {userFacingFeedsError} from '@/lib/billing/userFacingBillingError'

interface ArticleCustomFeedsPanelProps {
    tenantHost: string
    feeds: ArticleFeedView[]
    canBuild: boolean
    onFeedsChange: (feeds: ArticleFeedView[]) => void
    onError: (message: string) => void
    onAuthRequired: () => void
}

const MAX_CUSTOM_FEEDS = 5

type RowAction = 'toggle' | 'rotate' | 'delete'

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
    const [previewError, setPreviewError] = useState<string | null>(null)
    const [isSaving, setIsSaving] = useState(false)
    const [pendingFeedId, setPendingFeedId] = useState<number | null>(null)
    const [pendingAction, setPendingAction] = useState<RowAction | null>(null)

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
                setCategoriesError(userFacingFeedsError(error))
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
            previewCustomArticleFeed(tenantHost, selectedIds)
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
        setPreviewError(null)
    }

    async function handleSave(): Promise<void> {
        setIsSaving(true)
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
            onError(userFacingFeedsError(error))
        } finally {
            setIsSaving(false)
        }
    }

    async function handleToggle(feed: ArticleFeedView): Promise<void> {
        setPendingFeedId(feed.id)
        setPendingAction('toggle')
        try {
            const updated = await setArticleFeedEnabledForUser(tenantHost, feed.id, !feed.enabled)
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

    async function handleRotate(feed: ArticleFeedView): Promise<void> {
        if (
            !window.confirm(
                'Token erneuern? Die alte URL wird sofort ungültig. Trage die neue URL danach in deinem Feed-Reader ein.',
            )
        ) {
            return
        }
        setPendingFeedId(feed.id)
        setPendingAction('rotate')
        try {
            const updated = await rotateArticleFeedToken(tenantHost, feed.id)
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

    async function handleDelete(feed: ArticleFeedView): Promise<void> {
        if (!window.confirm(`Feed „${feed.title}“ wirklich löschen?`)) {
            return
        }
        setPendingFeedId(feed.id)
        setPendingAction('delete')
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
            onError(userFacingFeedsError(error))
        } finally {
            setPendingFeedId(null)
            setPendingAction(null)
        }
    }

    const atFeedLimit = customFeeds.length >= MAX_CUSTOM_FEEDS
    const showCreateForm =
        canBuild && categories.length > 0 && (editingId !== null || !atFeedLimit)
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
                            {previewError !== null ? (
                                <p className="text-sm text-muted-foreground" role="status">
                                    {previewError} Speichern ist trotzdem möglich.
                                </p>
                            ) : null}
                            {preview !== null ? (
                                <p className="text-sm text-muted-foreground" role="status">
                                    Dieser Feed enthält aktuell {preview.articleCount}{' '}
                                    {preview.articleCount === 1 ? 'Beitrag' : 'Beiträge'}
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
                                    {feed.categories.length > 0
                                        ? feed.categories.map((item) => item.name).join(', ')
                                        : 'Keine Kategorien'}{' '}
                                    · aktualisiert {formatPublishedAt(feed.updatedAt)}
                                </p>
                                <div className={feed.enabled ? undefined : 'opacity-70'}>
                                    <FeedUrlDisplay url={feed.url} />
                                    {!feed.enabled ? (
                                        <p className="mt-2 text-sm text-muted-foreground">
                                            Deaktiviert — die URL ist sichtbar, aber
                                            Feed-Reader können sie erst nach dem
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
                                {canBuild && categories.length > 0 ? (
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
