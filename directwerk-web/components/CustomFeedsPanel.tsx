'use client'

import {useEffect, useState} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Badge} from '@directwerk/ui/components/badge'
import {Button} from '@directwerk/ui/components/button'
import {Card, CardContent, CardHeader, CardTitle} from '@directwerk/ui/components/card'
import {Checkbox} from '@directwerk/ui/components/checkbox'
import ConfirmDialog from '@directwerk/ui/components/confirm-dialog'
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
import {userFacingFeedsError} from '@/lib/billing/userFacingBillingError'
import {formatPublishedAt} from '@/lib/format/dateTime'
import type {Dictionary} from '@/lib/i18n/dictionary'
import {interpolate} from '@/lib/i18n/interpolate'
import {useDictionary, useLocale} from '@/lib/i18n/LocaleProvider'

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
    headerTitle: (dictionary: Dictionary) => string
    headerDescription: (dictionary: Dictionary) => string
    optionsLegend: (dictionary: Dictionary) => string
    noOptionsMessage: (dictionary: Dictionary) => string
    noOptionsSelectedLabel: (dictionary: Dictionary) => string
    urlDisabledHint: (dictionary: Dictionary) => string
    rotateConfirmMessage: (dictionary: Dictionary) => string
    renderOptionLabel: (option: TOption, dictionary: Dictionary) => React.ReactNode
    renderPreview: (preview: TPreview, dictionary: Dictionary) => React.ReactNode
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

// Client-side mirror of the backend policy
// (FeedProvisioningSupport.MAX_CUSTOM_FEEDS_PER_USER in directwerk-core);
// the server is authoritative, but this must match or the form hides early.
const MAX_CUSTOM_FEEDS = 25

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
    const lang = useLocale()
    const dictionary = useDictionary()
    const {common, errors, feeds: copy, format} = dictionary
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
    const [confirmation, setConfirmation] = useState<{
        action: 'rotate' | 'delete'
        feed: TFeed
    } | null>(null)

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
                setOptionsError(userFacingFeedsError(error, errors))
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
                    setPreviewError(userFacingFeedsError(error, errors))
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
            : config.noOptionsSelectedLabel(dictionary)
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
            onError(userFacingFeedsError(error, errors))
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
            onError(userFacingFeedsError(error, errors))
        } finally {
            setPendingFeedId(null)
            setPendingAction(null)
        }
    }

    async function performRotate(feed: TFeed): Promise<void> {
        setPendingFeedId(feed.id)
        setPendingAction('rotate')
        try {
            const updated = await config.rotateToken(tenantHost, feed.id)
            onFeedsChange(feeds.map((item) => (item.id === updated.id ? updated : item)))
        } catch (error: unknown) {
            if (handleAuth(error)) {
                return
            }
            onError(userFacingFeedsError(error, errors))
        } finally {
            setPendingFeedId(null)
            setPendingAction(null)
        }
    }

    async function performDelete(feed: TFeed): Promise<void> {
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
            onError(userFacingFeedsError(error, errors))
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
            <SectionHeader
                action={<Badge variant="outline">{common.ownPrivate}</Badge>}
                description={config.headerDescription(dictionary)}
                title={config.headerTitle(dictionary)}
            />
            {optionsError !== null ? (
                <Alert variant="destructive">
                    <AlertDescription>{optionsError}</AlertDescription>
                </Alert>
            ) : null}
            {canBuild && options.length === 0 && optionsError === null ? (
                <p className="text-sm text-muted-foreground">{config.noOptionsMessage(dictionary)}</p>
            ) : null}
            {canBuild && atFeedLimit && editingId === null ? (
                <p className="text-sm text-muted-foreground">
                    {interpolate(copy.feedLimit, {max: MAX_CUSTOM_FEEDS})}
                </p>
            ) : null}
            {showEditHiddenHint ? (
                <p className="text-sm text-muted-foreground">
                    {copy.editHiddenHint}
                </p>
            ) : null}
            {showCreateForm ? (
                <Card>
                    <CardHeader>
                        <CardTitle>
                            {editingId === null ? copy.createFeedTitle : copy.editFeedTitle}
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
                                <span>{common.name}</span>
                                <Input
                                    maxLength={80}
                                    onChange={(event) => setTitle(event.target.value)}
                                    value={title}
                                />
                            </label>
                            <fieldset className="flex flex-col gap-2 border-0 p-0">
                                <legend className="mb-1 text-sm font-medium">
                                    {config.optionsLegend(dictionary)}
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
                                        <span>{config.renderOptionLabel(option, dictionary)}</span>
                                    </label>
                                ))}
                            </fieldset>
                            {previewError !== null ? (
                                <p className="text-sm text-muted-foreground" role="status">
                                    {previewError} {copy.previewSaveAnyway}
                                </p>
                            ) : null}
                            {preview !== null ? (
                                <p className="text-sm text-muted-foreground" role="status">
                                    {config.renderPreview(preview, dictionary)}
                                </p>
                            ) : null}
                            <div className="flex flex-wrap gap-2">
                                <Button disabled={!canSave} type="submit">
                                    {isSaving
                                        ? common.saving
                                        : editingId === null
                                          ? copy.saveFeed
                                          : copy.saveChanges}
                                </Button>
                                {editingId !== null ? (
                                    <Button onClick={resetForm} type="button" variant="outline">
                                        {common.cancel}
                                    </Button>
                                ) : null}
                            </div>
                        </form>
                    </CardContent>
                </Card>
            ) : null}
            {customFeeds.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                    {copy.noCustomFeeds}
                </p>
            ) : (
                <ListPanel>
                    {customFeeds.map((feed) => (
                        <ListPanelRow key={feed.id}>
                            <div className="min-w-0 flex-1 space-y-3">
                                <div className="flex flex-wrap items-center gap-2">
                                    <p className="font-medium">{feed.title}</p>
                                    <Badge variant="outline">{copy.ownFeedBadge}</Badge>
                                    <Badge variant={feed.enabled ? 'secondary' : 'outline'}>
                                        {feed.enabled ? common.active : common.disabled}
                                    </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    {feedOptionNames(feed)} ·{' '}
                                    {interpolate(common.updatedAt, {
                                        date: formatPublishedAt(feed.updatedAt, lang, format),
                                    })}
                                </p>
                                <div className={feed.enabled ? undefined : 'opacity-70'}>
                                    <FeedUrlDisplay url={feed.url} />
                                    {!feed.enabled ? (
                                        <p className="mt-2 text-sm text-muted-foreground">
                                            {config.urlDisabledHint(dictionary)}
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
                                        ? common.toggling
                                        : feed.enabled
                                          ? common.deactivate
                                          : common.activate}
                                </Button>
                                <Button
                                    disabled={isSaving || isRowMutationPending}
                                    onClick={() => setConfirmation({action: 'rotate', feed})}
                                    size="sm"
                                    type="button"
                                    variant="outline"
                                >
                                    {isRowBusy(feed.id, 'rotate')
                                        ? common.renewing
                                        : common.rotateToken}
                                </Button>
                                {canBuild && options.length > 0 ? (
                                    <Button
                                        disabled={isSaving || isRowMutationPending}
                                        onClick={() => startEdit(feed)}
                                        size="sm"
                                        type="button"
                                        variant="outline"
                                    >
                                        {common.edit}
                                    </Button>
                                ) : null}
                                <Button
                                    disabled={isSaving || isRowMutationPending}
                                    onClick={() => setConfirmation({action: 'delete', feed})}
                                    size="sm"
                                    type="button"
                                    variant="outline"
                                >
                                    {isRowBusy(feed.id, 'delete')
                                        ? common.deleting
                                        : common.delete}
                                </Button>
                            </div>
                        </ListPanelRow>
                    ))}
                </ListPanel>
            )}

            <ConfirmDialog
                cancelLabel={common.cancel}
                closeLabel={common.close}
                confirmLabel={
                    confirmation?.action === 'delete'
                        ? copy.deleteFeedConfirm
                        : common.rotateToken
                }
                description={
                    confirmation?.action === 'delete'
                        ? interpolate(copy.deleteFeedDesc, {title: confirmation.feed.title})
                        : config.rotateConfirmMessage(dictionary)
                }
                destructive={confirmation?.action === 'delete'}
                onConfirm={() => {
                    const pending = confirmation
                    if (pending === null) {
                        return
                    }
                    const run =
                        pending.action === 'delete'
                            ? performDelete(pending.feed)
                            : performRotate(pending.feed)
                    void run.finally(() => setConfirmation(null))
                }}
                onOpenChange={(open) => {
                    if (!open) {
                        setConfirmation(null)
                    }
                }}
                open={confirmation !== null}
                pending={
                    confirmation !== null &&
                    pendingFeedId === confirmation.feed.id &&
                    pendingAction === confirmation.action
                }
                pendingLabel={
                    confirmation?.action === 'delete' ? common.deleting : common.renewing
                }
                title={
                    confirmation?.action === 'delete'
                        ? copy.deleteFeedTitle
                        : copy.rotateFeedTitle
                }
            />
        </section>
    )
}

export const podcastCustomFeedsConfig: CustomFeedsPanelConfig<
    SubscriberFeedView,
    PublicFormat,
    FeedPreview
> = {
    headerTitle: ({feeds}) => feeds.customPodcastHeaderTitle,
    headerDescription: ({feeds}) => feeds.customPodcastHeaderDesc,
    optionsLegend: ({feeds}) => feeds.formatsLegend,
    noOptionsMessage: ({feeds}) => feeds.noFormats,
    noOptionsSelectedLabel: ({feeds}) => feeds.noFormatsSelected,
    urlDisabledHint: ({feeds}) => feeds.urlDisabledPodcast,
    rotateConfirmMessage: ({feeds}) => feeds.rotateCustomConfirm,
    renderOptionLabel: (format, {format: copy}) => (
        <>
            {format.name}
            {format.requiredLevelSortOrder !== null
                ? interpolate(copy.fromLevel, {order: format.requiredLevelSortOrder})
                : null}
        </>
    ),
    renderPreview: (preview, {catalog, feeds}) => (
        <>
            {interpolate(feeds.previewCountPodcast, {
                count: preview.episodeCount,
                noun:
                    preview.episodeCount === 1
                        ? catalog.nounEpisode
                        : catalog.nounEpisodes,
            })}
            {preview.sampleTitles.length > 0
                ? `${feeds.previewSamplePrefix}${preview.sampleTitles.join(', ')}`
                : feeds.previewSampleSuffix}
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
    headerTitle: ({feeds}) => feeds.customArticlesHeaderTitle,
    headerDescription: ({feeds}) => feeds.customArticlesHeaderDesc,
    optionsLegend: ({feeds}) => feeds.categoriesLegend,
    noOptionsMessage: ({feeds}) => feeds.noCategories,
    noOptionsSelectedLabel: ({feeds}) => feeds.noCategoriesSelected,
    urlDisabledHint: ({feeds}) => feeds.urlDisabledArticles,
    rotateConfirmMessage: ({feeds}) => feeds.rotateCustomConfirmArticles,
    renderOptionLabel: (category) => <>{category.name}</>,
    renderPreview: (preview, {catalog, feeds}) => (
        <>
            {interpolate(feeds.previewCountArticles, {
                count: preview.articleCount,
                noun:
                    preview.articleCount === 1
                        ? catalog.nounArticle
                        : catalog.nounArticles,
            })}
            {preview.sampleTitles.length > 0
                ? `${feeds.previewSamplePrefix}${preview.sampleTitles.join(', ')}`
                : feeds.previewSampleSuffix}
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
