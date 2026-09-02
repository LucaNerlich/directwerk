'use client'

import SelectControl from '@/components/studio/SelectControl'
import {suggestSlug} from '@/lib/api/studioHelpers'
import LevelSelect from '@/components/studio/LevelSelect'

import {Button} from '@directwerk/ui/components/button'
import {Input} from '@directwerk/ui/components/input'

import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {useCallback, useEffect, useEffectEvent, useRef, useState} from 'react'

import MediaLibraryPicker from '@/components/media/MediaLibraryPicker'
import UploadProgress from '@/components/media/UploadProgress'
import FormatCategoryPicker from '@/components/publication/FormatCategoryPicker'
import PublicationEditorLayout from '@/components/publication/PublicationEditorLayout'
import PublishedLinksPanel from '@/components/publication/PublishedLinksPanel'
import {hasModule} from '@/lib/api/client'
import {listCategories, listFormats, replaceEpisodeCategories, replaceEpisodeFormats} from '@/lib/api/catalogApi'
import {getMedia, getMediaPreviewUrl} from '@/lib/api/mediaApi'
import {archiveEpisode, attachEpisodeAudio, cancelScheduleEpisode, createEpisode, getEpisode, listEpisodes, listSeries, publishEpisode, scheduleEpisode, setEpisodeEnclosureEnabled, unarchiveEpisode, unpublishEpisode, updateEpisode} from '@/lib/api/podcastApi'
import type {CategorySummary, EpisodeDetail, FormatSummary, SeriesSummary} from '@directwerk/api/types'
import {mediaLimitLabel} from '@/lib/media/limits'
import {uploadMediaFile} from '@/lib/media/upload'
import {episodePublishBlockReason} from '@/lib/podcast/episodePreflight'
import {publicEpisodePageUrl} from '@directwerk/api/urls/publicContentUrls'
import {isSlugTaken} from '@/lib/publication/slugAvailability'
import {usePublicationEditorFields} from '@/lib/publication/usePublicationEditorFields'
import {usePublicationEditorWorkflow} from '@/lib/publication/usePublicationEditorWorkflow'
import {useNotifyAudienceHint} from '@/lib/studio/useNotifyAudienceHint'
import {useDefaultNotifySubscribers} from '@/lib/publication/useDefaultNotifySubscribers'
import {useSiteConfig} from '@/lib/site/SiteConfigProvider'
import {getClientTenantHost} from '@directwerk/api/tenant'
import {useAuthRequired} from '@directwerk/api/auth/useAuthRequired'

function optionalMinInt(value: string, minimum: number): number | undefined {
    const trimmed = value.trim()
    if (trimmed.length === 0) {
        return undefined
    }
    const parsed = Number.parseInt(trimmed, 10)
    if (!Number.isSafeInteger(parsed) || parsed < minimum) {
        return undefined
    }
    return parsed
}

export default function EpisodeEditor({episodeId}: {episodeId?: number}): React.JSX.Element {
    const router = useRouter()
    const authRedirect = useAuthRequired()
    const config = useSiteConfig()
    const showNotify = config.emailNotifyAvailable === true
    const notifyAudienceHint = useNotifyAudienceHint(showNotify)
    const [episode, setEpisode] = useState<EpisodeDetail | null>(null)
    const [allEpisodes, setAllEpisodes] = useState<EpisodeDetail[]>([])
    const [series, setSeries] = useState<SeriesSummary[]>([])
    const [seriesId, setSeriesId] = useState<number | null>(null)
    const [title, setTitle] = useState('')
    const [slug, setSlug] = useState('')
    const [body, setBody] = useState('')
    const {
        accessPolicy,
        setAccessPolicy,
        requiredLevelSortOrder,
        setRequiredLevelSortOrder,
        notifySubscribers,
        setNotifySubscribers,
        scheduledAt,
        setScheduledAt,
        applyPublicationSchedule,
        parseScheduledAt,
        setScheduleValidationError,
        publishedAt,
        setPublishedAt,
        applyPublicationPublishedAt,
        validatePublishedAt,
        setPublishValidationError,
        publishValidationError,
    } = usePublicationEditorFields()
    useDefaultNotifySubscribers(showNotify, setNotifySubscribers)
    const [episodeNumber, setEpisodeNumber] = useState('')
    const [isUploading, setIsUploading] = useState(false)
    const [isEnclosureSaving, setIsEnclosureSaving] = useState(false)
    const [uploadProgress, setUploadProgress] = useState<{file: File; progress: number} | null>(
        null,
    )
    const [isLoading, setIsLoading] = useState(true)
    const mountedRef = useRef(true)
    const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null)
    const [audioPreviewError, setAudioPreviewError] = useState<string | null>(null)
    const [audioReady, setAudioReady] = useState(false)
    const [audioStatusKnown, setAudioStatusKnown] = useState(true)
    const [availableFormats, setAvailableFormats] = useState<FormatSummary[]>([])
    const [availableCategories, setAvailableCategories] = useState<CategorySummary[]>([])
    const [selectedFormatIds, setSelectedFormatIds] = useState<Set<number>>(new Set())
    const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<number>>(new Set())
    const [coverAssetId, setCoverAssetId] = useState<number | null>(null)
    const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null)
    const [isUploadingCover, setIsUploadingCover] = useState(false)
    const [coverUploadProgress, setCoverUploadProgress] = useState<{file: File; progress: number} | null>(
        null,
    )
    const audioAssetId = episode?.audioAssetId ?? null
    const hasDigitalContent = hasModule(config, 'DIGITAL_CONTENT')

    const redirectToLogin = useEffectEvent(() => {
        router.replace('/login')
    })

    const episodeFields = useCallback(() => {
        const resolvedSlug = slug.trim() || suggestSlug(title) || 'folge'
        return {
            title: title.trim() || 'Ohne Titel',
            slug: resolvedSlug,
            description: body,
            accessPolicy,
            episodeNumber: optionalMinInt(episodeNumber, 1),
            requiredLevelSortOrder: requiredLevelSortOrder ?? undefined,
            coverAssetId: coverAssetId ?? undefined,
        }
    }, [accessPolicy, body, coverAssetId, episodeNumber, requiredLevelSortOrder, slug, title])

    const persistTags = useCallback(
        async (current: EpisodeDetail): Promise<EpisodeDetail> => {
            const host = getClientTenantHost()
            const [afterFormats, afterCategories] = await Promise.all([
                replaceEpisodeFormats(host, current.id, Array.from(selectedFormatIds)),
                replaceEpisodeCategories(host, current.id, Array.from(selectedCategoryIds)),
            ])
            const merged = {
                ...afterCategories,
                formats: afterFormats.formats,
            }
            setEpisode(merged)
            setSelectedFormatIds(new Set(afterFormats.formats.map((tag) => tag.id)))
            setSelectedCategoryIds(new Set(afterCategories.categories.map((tag) => tag.id)))
            return merged
        },
        [selectedCategoryIds, selectedFormatIds],
    )

    const saveImpl = useCallback(async (): Promise<EpisodeDetail | null> => {
        if (seriesId === null) {
            throw new Error('Bitte zuerst eine Sendung anlegen.')
        }

        const host = getClientTenantHost()
        const payload = episodeFields()

        if (episodeId === undefined) {
            const created = await createEpisode(host, {
                ...payload,
                seriesId,
            })
            setEpisode(created)
            router.replace(`/podcast/episodes/${created.id}`)
            return created
        }

        const updated = await updateEpisode(host, episodeId, payload)
        const withTags = await persistTags(updated)
        setEpisode(withTags)
        setAllEpisodes((current) =>
            current.map((item) => (item.id === withTags.id ? withTags : item)),
        )
        return withTags
    }, [episodeFields, episodeId, persistTags, router, seriesId])

    const {
        isSaving,
        errorMessage,
        setErrorMessage,
        saveHint,
        markDirty,
        save,
        runWorkflow,
    } = usePublicationEditorWorkflow({
        publicationId: episodeId,
        publication: episode,
        persistTags,
        saveImpl,
        onWorkflowComplete: (next) => {
            setEpisode(next)
            applyPublicationSchedule(next.scheduledAt)
            applyPublicationPublishedAt(next.publishedAt)
            if (next.episodeNumber !== null) {
                setEpisodeNumber(String(next.episodeNumber))
            }
            setRequiredLevelSortOrder(next.requiredLevelSortOrder)
        },
        autosaveBlocked: isUploading,
        authRedirect,
    })

    const handleAuthError = useCallback(
        (error: unknown) => {
            if (authRedirect(error)) return
            setErrorMessage(
                error instanceof Error ? error.message : 'Aktion fehlgeschlagen.',
            )
        },
        [authRedirect, setErrorMessage],
    )

    useEffect(() => {
        let active = true

        if (audioAssetId === null) {
            setAudioPreviewUrl(null)
            setAudioPreviewError(null)
            setAudioReady(false)
            setAudioStatusKnown(true)
            return
        }

        setAudioPreviewUrl(null)
        setAudioPreviewError(null)
        setAudioReady(false)
        setAudioStatusKnown(false)

        async function loadAudio(assetId: number): Promise<void> {
            try {
                const host = getClientTenantHost()
                const [url, asset] = await Promise.all([
                    getMediaPreviewUrl(host, assetId),
                    getMedia(host, assetId),
                ])
                if (!active) {
                    return
                }
                setAudioPreviewUrl(url)
                setAudioReady(asset.status === 'READY')
                setAudioStatusKnown(true)
            } catch (error) {
                if (!active) {
                    return
                }
                if (authRedirect(error)) return
                setAudioPreviewError(
                    error instanceof Error
                        ? error.message
                        : 'Audio-Vorschau konnte nicht geladen werden.',
                )
                setAudioReady(false)
                setAudioStatusKnown(true)
            }
        }

        void loadAudio(audioAssetId)

        return () => {
            active = false
        }
    }, [audioAssetId])

    useEffect(() => {
        let active = true

        if (coverAssetId === null) {
            setCoverPreviewUrl(null)
            return
        }

        getMediaPreviewUrl(getClientTenantHost(), coverAssetId)
            .then((url) => {
                if (active) {
                    setCoverPreviewUrl(url)
                }
            })
            .catch((error) => {
                if (!active) {
                    return
                }
                if (authRedirect(error)) return
                setCoverPreviewUrl(null)
            })

        return () => {
            active = false
        }
    }, [authRedirect, coverAssetId])

    useEffect(() => {
        mountedRef.current = true
        let active = true

        async function load(): Promise<void> {
            try {
                const host = getClientTenantHost()
                const [seriesList, formatList, categoryList, episodeList, loadedEpisode] =
                    await Promise.all([
                    listSeries(host),
                    listFormats(host),
                    listCategories(host),
                    listEpisodes(host),
                    episodeId === undefined ? null : getEpisode(host, episodeId),
                ])

                if (!active) {
                    return
                }

                setSeries(seriesList)
                setAllEpisodes(episodeList)
                setAvailableFormats(formatList.filter((item) => item.active))
                setAvailableCategories(categoryList.filter((item) => item.active))
                if (seriesList.length > 0) {
                    setSeriesId(loadedEpisode?.seriesId ?? seriesList[0].id)
                }

                if (loadedEpisode !== null) {
                    setEpisode(loadedEpisode)
                    setTitle(loadedEpisode.title)
                    setSlug(loadedEpisode.slug)
                    setBody(loadedEpisode.description ?? '')
                    setAccessPolicy(loadedEpisode.accessPolicy)
                    setEpisodeNumber(
                        loadedEpisode.episodeNumber !== null
                            ? String(loadedEpisode.episodeNumber)
                            : '',
                    )
                    setRequiredLevelSortOrder(loadedEpisode.requiredLevelSortOrder)
                    setCoverAssetId(loadedEpisode.coverAssetId)
                    applyPublicationSchedule(loadedEpisode.scheduledAt)
                    applyPublicationPublishedAt(loadedEpisode.publishedAt)
                    setSelectedFormatIds(new Set(loadedEpisode.formats.map((tag) => tag.id)))
                    setSelectedCategoryIds(new Set(loadedEpisode.categories.map((tag) => tag.id)))
                }
            } catch (error) {
                if (!active) {
                    return
                }
                if (authRedirect(error)) return
                setErrorMessage(
                    error instanceof Error
                        ? error.message
                        : 'Folge konnte nicht geladen werden.',
                )
            } finally {
                if (active) {
                    setIsLoading(false)
                }
            }
        }

        load()

        return () => {
            active = false
            mountedRef.current = false
        }
    }, [episodeId, authRedirect, setErrorMessage])

    const handleAuthRequired = useCallback(() => {
        router.replace('/login')
    }, [router])

    const handleAudioUpload = useCallback(
        async (file: File | null) => {
            if (file === null) {
                return
            }

            const saved = await save()
            if (saved === null) {
                return
            }

            setIsUploading(true)
            setErrorMessage(null)
            setUploadProgress({file, progress: 0})
            try {
                const host = getClientTenantHost()
                const asset = await uploadMediaFile(host, file, {
                    assetType: 'AUDIO',
                    visibility: 'PRIVATE',
                    episodeId: saved.id,
                    onProgress: (percent) => {
                        if (mountedRef.current) {
                            setUploadProgress({file, progress: percent})
                        }
                    },
                })
                const updated = await attachEpisodeAudio(host, saved.id, asset.id)
                setEpisode(updated)
            } catch (error) {
                handleAuthError(error)
            } finally {
                if (mountedRef.current) {
                    setIsUploading(false)
                    setUploadProgress(null)
                }
            }
        },
        [handleAuthError, save],
    )

    const handleAudioFromLibrary = useCallback(
        async (assetId: number) => {
            const saved = await save()
            if (saved === null) {
                return
            }

            setIsUploading(true)
            setErrorMessage(null)
            try {
                const updated = await attachEpisodeAudio(
                    getClientTenantHost(),
                    saved.id,
                    assetId,
                )
                setEpisode(updated)
            } catch (error) {
                handleAuthError(error)
            } finally {
                setIsUploading(false)
            }
        },
        [handleAuthError, save],
    )

    async function handleCoverUpload(file: File | null): Promise<void> {
        if (file === null) {
            return
        }
        setIsUploadingCover(true)
        setErrorMessage(null)
        setCoverUploadProgress({file, progress: 0})
        try {
            const asset = await uploadMediaFile(getClientTenantHost(), file, {
                assetType: 'IMAGE',
                visibility: 'PUBLIC',
                onProgress: (percent) => {
                    if (mountedRef.current) {
                        setCoverUploadProgress({file, progress: percent})
                    }
                },
            })
            setCoverAssetId(asset.id)
            markDirty()
        } catch (error) {
            handleAuthError(error)
        } finally {
            if (mountedRef.current) {
                setIsUploadingCover(false)
                setCoverUploadProgress(null)
            }
        }
    }

    const handleEnclosureChange = useCallback(
        async (enabled: boolean) => {
            if (episode === null) {
                return
            }

            setIsEnclosureSaving(true)
            setErrorMessage(null)
            try {
                const updated = await setEpisodeEnclosureEnabled(
                    getClientTenantHost(),
                    episode.id,
                    enabled,
                )
                setEpisode(updated)
            } catch (error) {
                handleAuthError(error)
            } finally {
                setIsEnclosureSaving(false)
            }
        },
        [episode, handleAuthError, setErrorMessage],
    )

    const slugTaken = useCallback(
        (candidate: string) => isSlugTaken(allEpisodes, candidate, episodeId),
        [allEpisodes, episodeId],
    )

    if (isLoading) {
        return <p>Folge wird geladen…</p>
    }

    if (series.length === 0) {
        return (
            <div className="flex flex-col gap-3">
                <p className="text-sm text-muted-foreground">
                    Bevor du eine Folge erstellst, brauchst du eine Sendung (dein
                    Podcast-Kanal).
                </p>
                <p>
                    <Link href="/podcast/series/new">Zuerst eine Sendung anlegen</Link>
                    {' · '}
                    <Link href="/podcast">Zur Podcast-Übersicht</Link>
                </p>
            </div>
        )
    }

    const busy = isSaving || isUploading || isUploadingCover || isEnclosureSaving
    const hasAudio = audioAssetId !== null
    const selectedSeries = series.find((item) => item.id === seriesId) ?? null
    const publishBlockedReason = episodePublishBlockReason({
        seriesStatus: selectedSeries?.status ?? null,
        hasAudioAsset: hasAudio,
        audioReady,
        audioStatusKnown,
        formatRequired: availableFormats.length > 0,
        formatSelected: selectedFormatIds.size > 0,
    })
    const episodePageUrl = publicEpisodePageUrl(config.publicSiteUrl, slug)
    const publishedLinks = [
        config.publicRssUrl !== null
            ? {label: 'Allgemeiner Feed', url: config.publicRssUrl}
            : null,
        selectedSeries?.rssUrl != null
            ? {label: 'Sendungs-Feed', url: selectedSeries.rssUrl}
            : null,
        episodePageUrl !== null
            ? {label: 'Öffentliche Folge', url: episodePageUrl}
            : null,
    ].filter((item): item is {label: string; url: string} => item !== null)

    return (
        <div className="grid gap-4">
            {episodeId === undefined && (
                <label className="grid gap-2 text-sm font-medium">
                    <span>Sendung</span>
                    <SelectControl
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
                        value={seriesId ?? ''}
                        onChange={(event) => setSeriesId(Number(event.target.value))}
                    >
                        {series.map((item) => (
                            <option key={item.id} value={item.id}>
                                {item.status === 'PUBLISHED'
                                    ? item.title
                                    : `${item.title} (Entwurf)`}
                            </option>
                        ))}
                    </SelectControl>
                    {selectedSeries?.status === 'DRAFT' ? (
                        <p className="text-xs text-muted-foreground">
                            Diese Sendung ist noch ein Entwurf.{' '}
                            <Link href={`/podcast/series/${selectedSeries.id}`}>
                                Sendung veröffentlichen
                            </Link>
                            , damit der Feed erscheint.
                        </p>
                    ) : null}
                </label>
            )}
            {episodeId !== undefined && selectedSeries?.status === 'DRAFT' ? (
                <p className="text-xs text-muted-foreground">
                    Die Sendung ist noch nicht veröffentlicht.{' '}
                    <Link href={`/podcast/series/${selectedSeries.id}`}>
                        Sendung veröffentlichen
                    </Link>
                    , damit der öffentliche Feed die Folge aufnehmen kann.
                </p>
            ) : null}
            <PublicationEditorLayout
                kind="episode"
                status={episode?.status ?? 'DRAFT'}
                title={title}
                body={body}
                accessPolicy={accessPolicy}
                slug={slug}
                slugTaken={slugTaken}
                onTitleChange={(value) => {
                    setTitle(value)
                    markDirty()
                    if (episodeId === undefined && slug.trim().length === 0) {
                        setSlug(suggestSlug(value))
                    }
                }}
                onBodyChange={(value) => {
                    setBody(value)
                    markDirty()
                }}
                onAccessPolicyChange={(value) => {
                    setAccessPolicy(value)
                    markDirty()
                }}
                onSlugChange={(value) => {
                    setSlug(value)
                    markDirty()
                }}
                isSaving={busy}
                saveHint={saveHint}
                errorMessage={errorMessage}
                canPublish={publishBlockedReason === null}
                publishBlockedReason={publishBlockedReason}
                showNotify={showNotify}
                notifySubscribers={notifySubscribers}
                onNotifyChange={setNotifySubscribers}
                notifyAudienceHint={notifyAudienceHint}
                scheduledAt={scheduledAt}
                onScheduledAtChange={setScheduledAt}
                publishedAt={publishedAt}
                onPublishedAtChange={setPublishedAt}
                publishValidationError={publishValidationError}
                onSave={() => {
                    void save()
                }}
                onPublish={() => {
                    const validation = validatePublishedAt()
                    if (!validation.valid) {
                        setPublishValidationError(validation.message)
                        setErrorMessage(validation.message)
                        return
                    }
                    setPublishValidationError(null)
                    void runWorkflow(
                        (saved) =>
                            publishEpisode(getClientTenantHost(), saved.id, {
                                notifySubscribers,
                                ...(validation.iso !== null ? {publishedAt: validation.iso} : {}),
                            }),
                        {persistTags: true},
                    )
                }}
                onSchedule={() => {
                    const iso = parseScheduledAt()
                    if (iso === null) {
                        setScheduleValidationError('Bitte einen gültigen Zeitpunkt wählen.')
                        setErrorMessage('Bitte einen gültigen Zeitpunkt wählen.')
                        return
                    }
                    setScheduleValidationError(null)
                    void runWorkflow(
                        (saved) =>
                            scheduleEpisode(getClientTenantHost(), saved.id, {
                                scheduledAt: iso,
                                notifySubscribers,
                            }),
                        {persistTags: true},
                    )
                }}
                onCancelSchedule={() => {
                    void runWorkflow((saved) =>
                        cancelScheduleEpisode(getClientTenantHost(), saved.id),
                    )
                }}
                onUnpublish={() => {
                    void runWorkflow((saved) =>
                        unpublishEpisode(getClientTenantHost(), saved.id),
                    )
                }}
                onArchive={() => {
                    void runWorkflow((saved) =>
                        archiveEpisode(getClientTenantHost(), saved.id),
                    )
                }}
                onUnarchive={() => {
                    void runWorkflow((saved) =>
                        unarchiveEpisode(getClientTenantHost(), saved.id),
                    )
                }}
                sidebarExtra={
                    <>
                        {episode?.status === 'PUBLISHED' ? (
                            <PublishedLinksPanel
                                title="Öffentliche Links"
                                links={publishedLinks}
                                hint="Direkt nach dem Veröffentlichen kann der Feed noch 404 liefern, bis der Snapshot geschrieben ist. Danach leitet Directwerk mit 302 zur Datei weiter."
                            />
                        ) : null}
                        <label className="grid gap-2 text-sm font-medium">
                            <span>Folgennummer</span>
                            <Input
                                min={1}
                                onChange={(event) => {
                                    setEpisodeNumber(event.target.value)
                                    markDirty()
                                }}
                                type="number"
                                value={episodeNumber}
                            />
                        </label>
                        <label className="grid gap-2 text-sm font-medium">
                            <span>Mindest-Stufe</span>
                            <LevelSelect
                                disabled={accessPolicy === 'FREE'}
                                onChange={(value) => {
                                    setRequiredLevelSortOrder(value)
                                    markDirty()
                                }}
                                value={requiredLevelSortOrder}
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
                        {episode !== null ? (
                            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                                <Input
                                    checked={episode.enclosureEnabled !== false}
                                    className="size-4 shrink-0"
                                    onChange={(event) => {
                                        void handleEnclosureChange(event.target.checked)
                                    }}
                                    type="checkbox"
                                />
                                Audio im Feed (Enclosure)
                            </label>
                        ) : null}
                        <div className="grid gap-2">
                            <p className="text-sm font-semibold">Titelbild (RSS)</p>
                            <p className="text-xs text-muted-foreground">
                                Wird im Feed als Folgen-Cover genutzt. Ohne eigenes Bild gilt
                                das Format- oder Sendungs-Titelbild.
                            </p>
                            {coverPreviewUrl !== null ? (
                                <img
                                    alt=""
                                    className="block max-w-48"
                                    src={coverPreviewUrl}
                                />
                            ) : null}
                            <label className="grid gap-2 text-sm font-medium">
                                <span>{coverAssetId !== null ? 'Titelbild ersetzen' : 'Titelbild hochladen'}</span>
                                <Input
                                    accept="image/png,image/jpeg,image/webp"
                                    disabled={busy}
                                    onChange={(event) => {
                                        const file = event.target.files?.[0] ?? null
                                        void handleCoverUpload(file)
                                        event.target.value = ''
                                    }}
                                    type="file"
                                />
                                <span className="text-xs font-normal text-muted-foreground">
                                    Max. {mediaLimitLabel('IMAGE')}.
                                </span>
                            </label>
                            {hasDigitalContent ? (
                                <MediaLibraryPicker
                                    assetType="IMAGE"
                                    disabled={busy}
                                    label="Titelbild aus Mediathek"
                                    onAuthRequired={handleAuthRequired}
                                    onSelect={(asset) => {
                                        setCoverAssetId(asset.id)
                                        markDirty()
                                    }}
                                    selectedId={coverAssetId}
                                />
                            ) : null}
                            {coverUploadProgress !== null ? (
                                <UploadProgress
                                    file={coverUploadProgress.file}
                                    progress={coverUploadProgress.progress}
                                />
                            ) : null}
                        </div>
                        <div className="grid gap-2">
                            <p className="text-sm font-semibold">Audio</p>
                            {hasAudio ? (
                                <>
                                    <p className="text-xs text-muted-foreground">
                                        Audio angehängt (Asset-ID {episode?.audioAssetId}
                                        {audioStatusKnown
                                            ? audioReady
                                                ? ', READY'
                                                : ', noch nicht READY'
                                            : ''}
                                        ).
                                    </p>
                                    {audioPreviewUrl !== null ? (
                                        <audio
                                            className="w-full max-w-full"
                                            controls
                                            preload="metadata"
                                            src={audioPreviewUrl}
                                        >
                                            Audio-Wiedergabe wird nicht unterstützt.
                                        </audio>
                                    ) : audioPreviewError !== null ? (
                                        <p className="text-xs text-muted-foreground" role="alert">
                                            {audioPreviewError}
                                        </p>
                                    ) : (
                                        <p className="text-xs text-muted-foreground">Vorschau wird geladen…</p>
                                    )}
                                </>
                            ) : (
                                <p className="text-xs text-muted-foreground">
                                    Vor dem Veröffentlichen muss Audio hochgeladen werden.
                                </p>
                            )}
                            <label className="grid gap-2 text-sm font-medium">
                                <span>{hasAudio ? 'Audio ersetzen' : 'Audio-Datei'}</span>
                                <Input
                                    type="file"
                                    accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/ogg,audio/webm,.mp3,.m4a,.wav,.ogg,.webm"
                                    disabled={busy}
                                    onChange={(event) => {
                                        const file = event.target.files?.[0] ?? null
                                        void handleAudioUpload(file)
                                        event.target.value = ''
                                    }}
                                />
                                <span className="text-xs font-normal text-muted-foreground">
                                    Max. {mediaLimitLabel('AUDIO')}.
                                </span>
                            </label>
                            {hasDigitalContent ? (
                                <MediaLibraryPicker
                                    assetType="AUDIO"
                                    disabled={busy}
                                    label={hasAudio ? 'Audio aus Mediathek ersetzen' : 'Audio aus Mediathek'}
                                    onAuthRequired={handleAuthRequired}
                                    onSelect={(asset) => {
                                        void handleAudioFromLibrary(asset.id)
                                    }}
                                    selectedId={audioAssetId}
                                />
                            ) : null}
                            {isUploading && uploadProgress === null ? <p className="text-xs text-muted-foreground">Upload läuft…</p> : null}
                            {uploadProgress !== null ? (
                                <UploadProgress
                                    file={uploadProgress.file}
                                    progress={uploadProgress.progress}
                                />
                            ) : null}
                        </div>
                        {episode !== null ? (
                            <FormatCategoryPicker
                                categories={availableCategories}
                                disabled={busy}
                                formats={availableFormats}
                                onCategoryChange={(ids) => {
                                    setSelectedCategoryIds(ids)
                                    markDirty()
                                }}
                                onFormatChange={(ids) => {
                                    setSelectedFormatIds(ids)
                                    markDirty()
                                }}
                                selectedCategoryIds={selectedCategoryIds}
                                selectedFormatIds={selectedFormatIds}
                            />
                        ) : null}
                    </>
                }
            />
        </div>
    )
}
