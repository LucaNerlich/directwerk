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
    createCustomFeed,
    deleteCustomArticleFeed,
    deleteCustomFeed,
    listPublicArticleCategories,
    listPublicFormats,
    previewCustomArticleFeed,
    previewCustomFeed,
    rotateArticleFeedToken,
    rotateFeedToken,
    setArticleFeedEnabledForUser,
    setFeedEnabled,
    updateCustomArticleFeed,
    updateCustomFeed,
} from '@/lib/api/client'
import {AUTH_REQUIRED} from '@directwerk/api/constants'
import type {
    ArticleFeedPreview,
    ArticleFeedView,
    FeedPreview,
    PublicCategory,
    PublicFormat,
    SubscriberFeedView,
} from '@directwerk/api/types'
import {formatPublishedAt} from '@directwerk/api/format/datetime'
import {userFacingFeedsError} from '@/lib/billing/userFacingBillingError'

interface CustomFeedBase {
    id: number
    title: string
    isDefault: boolean
    enabled: boolean
    url: string
    updatedAt: string
}

interface CustomFeedOption {
    id: number
    name: string
}

export interface CustomFeedsPanelConfig<
    TFeed extends CustomFeedBase,
    TOption extends CustomFeedOption,
    TPreview,
> {
    headerTitle: string
    headerDescription: string
    optionsLegend: string
    noOptionsMessage: string
    noOptionsSelectedLabel: string
    urlDisabledHint: string
    rotateConfirmMessage: string
    renderOptionLabel: (option: TOption) => React.ReactNode
    renderPreview: (preview: TPreview) => React.ReactNode
    getFeedOptionIds: (feed: TFeed) => number[]
    getFeedOptionSummaries: (feed: TFeed) => CustomFeedOption[]
    fetchOptions: (tenantHost: string) => Promise<TOption[]>
    fetchPreview: (tenantHost: string, ids: number[]) => Promise<TPreview>
    createFeed: (tenantHost: string, title: string, ids: number[]) => Promise<TFeed>
    updateFeed: (
        tenantHost: string,
        feedId: number,
        title: string,
        ids: number[],
    ) => Promise<TFeed>
    setEnabled: (tenantHost: string, feedId: number, enabled: boolean) => Promise<TFeed>
    rotateToken: (tenantHost: string, feedId: number) => Promise<TFeed>
    deleteFeed: (tenantHost: string, feedId: number) => Promise<void>
}

interface CustomFeedsPanelProps<
    TFeed extends CustomFeedBase,
    TOption extends CustomFeedOption,
    TPreview,
> {
    config: CustomFeedsPanelConfig<TFeed, TOption, TPreview>
    tenantHost: string
    feeds: TFeed[]
    canBuild: boolean
    onFeedsChange: (feeds: TFeed[]) => void
    onError: (message: string) => void
    onAuthRequired: () => void
}

const MAX_CUSTOM_FEEDS = 5

type RowAction = 'toggle' | 'rotate' | 'delete'

/**
 * Displays and manages custom feeds, including creation, editing, previewing, activation, token rotation, and deletion.
 *
 * @param config - Feed-specific labels, renderers, preview handling, and API operations.
 * @param tenantHost - Host identifying the tenant whose feeds are managed.
 * @param feeds - All feeds available to the tenant.
 * @param canBuild - Whether the tenant can create or edit feeds.
 * @param onFeedsChange - Called with the updated feed list after a successful mutation.
 * @param onError - Called with a user-facing error message when an operation fails.
 * @param onAuthRequired - Called when an operation requires authentication.
 */
export default function CustomFeedsPanel<
    TFeed extends CustomFeedBase,
    TOption extends CustomFeedOption,
    TPreview,
>({
    config,
    tenantHost,
    feeds,
    canBuild,
    onFeedsChange,
    onError,
    onAuthRequired,
}: CustomFeedsPanelProps<TFeed, TOption, TPreview>): React.JSX.Element {
    const customFeeds = feeds.filter((feed) => !feed.isDefault)
    const [options, setOptions] = useState<TOption[]>([])
    const [optionsError, setOptionsError] = useState<string | null>(null)
    const [title, setTitle] = useState('')
    const [selectedIds, setSelectedIds] = useState<number[]>([])
    const [editingId, setEditingId] = useState<number | null>(null)
    const [preview, setPreview] = useState<TPreview | null>(null)
    const [previewError, setPreviewError] = useState<string | null>(null)
    const [isSaving, setIsSaving] = useState(false)
    const [pendingFeedId, setPendingFeedId] = useState<number | null>(null)
    const [pendingAction, setPendingAction] = useState<RowAction | null>(null)

    useEffect(() => {
        let active = true
        config
            .fetchOptions(tenantHost)
            .then((loaded) => {
                if (active) {
                    setOptions(loaded)
                    setOptionsError(null)
                }
            })
            .catch((error: unknown) => {
                if (!active) {
                    return
                }
                setOptions([])
                setOptionsError(userFacingFeedsError(error))
            })
        return () => {
            active = false
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tenantHost, config])

    useEffect(() => {
        if (!canBuild || selectedIds.length === 0) {
            setPreview(null)
            setPreviewError(null)
            return
        }
        let active = true
        const handle = window.setTimeout(() => {
            config
                .fetchPreview(tenantHost, selectedIds)
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tenantHost, selectedIds, canBuild, config])

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

    function toggleOption(optionId: number): void {
        setSelectedIds((current) =>
            current.includes(optionId)
                ? current.filter((id) => id !== optionId)
                : [...current, optionId],
        )
    }

    function startEdit(feed: TFeed): void {
        setEditingId(feed.id)
        setTitle(feed.title)
        setSelectedIds(config.getFeedOptionIds(feed))
    }

    function resetForm(): void {
        setEditingId(null)
        setTitle('')
        setSelectedIds([])
        setPreview(null)
        setPreviewError(null)
    }

    function feedOptionNames(feed: TFeed): string {
        const summaries = config.getFeedOptionSummaries(feed)
        return summaries.length > 0
            ? summaries.map((item) => item.name).join(', ')
            : config.noOptionsSelectedLabel
    }

    async function handleSave(): Promise<void> {
        setIsSaving(true)
        try {
            if (editingId === null) {
                const created = await config.createFeed(tenantHost, title.trim(), selectedIds)
                onFeedsChange([...feeds, created])
            } else {
                const updated = await config.updateFeed(
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

    async function handleToggle(feed: TFeed): Promise<void> {
        setPendingFeedId(feed.id)
        setPendingAction('toggle')
        try {
            const updated = await config.setEnabled(tenantHost, feed.id, !feed.enabled)
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

    async function handleRotate(feed: TFeed): Promise<void> {
        if (!window.confirm(config.rotateConfirmMessage)) {
            return
        }
        setPendingFeedId(feed.id)
        setPendingAction('rotate')
        try {
            const updated = await config.rotateToken(tenantHost, feed.id)
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

    async function handleDelete(feed: TFeed): Promise<void> {
        if (!window.confirm(`Feed „${feed.title}“ wirklich löschen?`)) {
            return
        }
        setPendingFeedId(feed.id)
        setPendingAction('delete')
        try {
            await config.deleteFeed(tenantHost, feed.id)
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
        canBuild && options.length > 0 && (editingId !== null || !atFeedLimit)
    const isRowMutationPending = pendingFeedId !== null
    const canSave =
        title.trim().length > 0 &&
        selectedIds.length > 0 &&
        !isSaving &&
        !isRowMutationPending
    const showEditHiddenHint = !canBuild && customFeeds.length > 0

    return (
        <section className="flex flex-col gap-4">
            <SectionHeader description={config.headerDescription} title={config.headerTitle} />
            {optionsError !== null ? (
                <Alert variant="destructive">
                    <AlertDescription>{optionsError}</AlertDescription>
                </Alert>
            ) : null}
            {canBuild && options.length === 0 && optionsError === null ? (
                <p className="text-sm text-muted-foreground">{config.noOptionsMessage}</p>
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
                                <legend className="mb-1 text-sm font-medium">
                                    {config.optionsLegend}
                                </legend>
                                {options.map((option) => (
                                    <label
                                        className="flex cursor-pointer items-center gap-2 text-sm font-normal"
                                        key={option.id}
                                    >
                                        <Checkbox
                                            checked={selectedIds.includes(option.id)}
                                            onCheckedChange={() => toggleOption(option.id)}
                                        />
                                        <span>{config.renderOptionLabel(option)}</span>
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
                                    {config.renderPreview(preview)}
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
                                    {feedOptionNames(feed)} · aktualisiert{' '}
                                    {formatPublishedAt(feed.updatedAt)}
                                </p>
                                <div className={feed.enabled ? undefined : 'opacity-70'}>
                                    <FeedUrlDisplay url={feed.url} />
                                    {!feed.enabled ? (
                                        <p className="mt-2 text-sm text-muted-foreground">
                                            {config.urlDisabledHint}
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
                                {canBuild && options.length > 0 ? (
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

export const podcastCustomFeedsConfig: CustomFeedsPanelConfig<
    SubscriberFeedView,
    PublicFormat,
    FeedPreview
> = {
    headerTitle: 'Eigene Feeds (Formate)',
    headerDescription:
        'Baue private RSS-Feeds nur mit den Formaten, die du hören willst. Es erscheinen nur Folgen, die du freigeschaltet hast.',
    optionsLegend: 'Formate',
    noOptionsMessage: 'Der Verlag hat noch keine Formate angelegt.',
    noOptionsSelectedLabel: 'Keine Formate',
    urlDisabledHint:
        'Deaktiviert — die URL ist sichtbar, aber Podcast-Apps können sie erst nach dem Aktivieren wieder abrufen.',
    rotateConfirmMessage:
        'Token erneuern? Die alte URL wird sofort ungültig. Trage die neue URL danach in deiner Podcast-App ein.',
    renderOptionLabel: (format) => (
        <>
            {format.name}
            {format.requiredLevelSortOrder !== null
                ? ` (ab Stufe ${format.requiredLevelSortOrder})`
                : null}
        </>
    ),
    renderPreview: (preview) => (
        <>
            Dieser Feed enthält aktuell {preview.episodeCount}{' '}
            {preview.episodeCount === 1 ? 'Folge' : 'Folgen'}
            {preview.sampleTitles.length > 0 ? `: ${preview.sampleTitles.join(', ')}` : '.'}
        </>
    ),
    getFeedOptionIds: (feed) => feed.formatIds,
    getFeedOptionSummaries: (feed) => feed.formats,
    fetchOptions: listPublicFormats,
    fetchPreview: previewCustomFeed,
    createFeed: createCustomFeed,
    updateFeed: updateCustomFeed,
    setEnabled: setFeedEnabled,
    rotateToken: rotateFeedToken,
    deleteFeed: deleteCustomFeed,
}

export const articleCustomFeedsConfig: CustomFeedsPanelConfig<
    ArticleFeedView,
    PublicCategory,
    ArticleFeedPreview
> = {
    headerTitle: 'Eigene Feeds (Kategorien)',
    headerDescription:
        'Baue private RSS-Feeds nur mit den Kategorien, die dich interessieren. Es erscheinen nur Beiträge, die du freigeschaltet hast.',
    optionsLegend: 'Kategorien',
    noOptionsMessage: 'Der Verlag hat noch keine Kategorien angelegt.',
    noOptionsSelectedLabel: 'Keine Kategorien',
    urlDisabledHint:
        'Deaktiviert — die URL ist sichtbar, aber Feed-Reader können sie erst nach dem Aktivieren wieder abrufen.',
    rotateConfirmMessage:
        'Token erneuern? Die alte URL wird sofort ungültig. Trage die neue URL danach in deinem Feed-Reader ein.',
    renderOptionLabel: (category) => <>{category.name}</>,
    renderPreview: (preview) => (
        <>
            Dieser Feed enthält aktuell {preview.articleCount}{' '}
            {preview.articleCount === 1 ? 'Beitrag' : 'Beiträge'}
            {preview.sampleTitles.length > 0 ? `: ${preview.sampleTitles.join(', ')}` : '.'}
        </>
    ),
    getFeedOptionIds: (feed) => feed.categoryIds,
    getFeedOptionSummaries: (feed) => feed.categories,
    fetchOptions: listPublicArticleCategories,
    fetchPreview: previewCustomArticleFeed,
    createFeed: createCustomArticleFeed,
    updateFeed: updateCustomArticleFeed,
    setEnabled: setArticleFeedEnabledForUser,
    rotateToken: rotateArticleFeedToken,
    deleteFeed: deleteCustomArticleFeed,
}
