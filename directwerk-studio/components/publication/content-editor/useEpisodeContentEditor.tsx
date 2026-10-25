'use client'

import SelectControl from '@/components/studio/SelectControl'
import {suggestSlug} from '@/lib/api/studioHelpers'
import {Button} from '@directwerk/ui/components/button'
import EmptyState from '@directwerk/ui/components/empty-state'
import LocaleLink from '@/components/i18n/LocaleLink'
import {useRouter} from 'next/navigation'
import {useCallback, useEffect, useRef, useState} from 'react'

import EpisodeEditorSidebar from '@/components/publication/content-editor/EpisodeEditorSidebar'
import {episodeContentEditorDescriptor} from '@/components/publication/content-editor/episodeDescriptor'
import type {ContentEditorModel} from '@/components/publication/content-editor/types'
import {useLocalizedPath} from '@/components/i18n/useLocalizedPath'
import {useDictionary} from '@/components/i18n/LocaleProvider'
import {hasModule} from '@/lib/api/client'
import {
    listCategories,
    listFormats,
    replaceEpisodeCategories,
    replaceEpisodeFormats,
} from '@/lib/api/catalogApi'
import {getMedia, getMediaPreviewUrl} from '@/lib/api/mediaApi'
import {useDeskAccess} from '@/lib/rbac/useDeskAccess'
import {
    attachEpisodeAudio,
    createEpisode,
    getEpisode,
    listEpisodes,
    listSeries,
    setEpisodeEnclosureEnabled,
    updateEpisode,
} from '@/lib/api/podcastApi'
import type {
    CategorySummary,
    EpisodeDetail,
    FormatSummary,
    SeriesSummary,
} from '@directwerk/api/types'
import {uploadMediaFile} from '@/lib/media/upload'
import {useCoverImageUpload} from '@/lib/media/useCoverImageUpload'
import {episodePublishBlockReason} from '@/lib/podcast/episodePreflight'
import {publicEpisodePageUrl} from '@directwerk/api/urls/publicContentUrls'
import {isSlugTaken} from '@/lib/publication/slugAvailability'
import {parseOptionalInt as optionalMinInt} from '@/lib/publication/parsePositiveInt'
import {resolvePersistEpisodeId} from '@/lib/publication/resolvePersistEpisodeId'
import {usePublicationEditorFields} from '@/lib/publication/usePublicationEditorFields'
import {usePublicationEditorWorkflow} from '@/lib/publication/usePublicationEditorWorkflow'
import {useNotifyAudienceHint} from '@/lib/studio/useNotifyAudienceHint'
import {useDefaultNotifySubscribers} from '@/lib/publication/useDefaultNotifySubscribers'
import {useSiteConfig} from '@/lib/site/SiteConfigProvider'
import {getClientTenantHost} from '@directwerk/api/tenant'
import {useAuthRequired} from '@directwerk/api/auth/useAuthRequired'
import {safeImageSrc} from '@/lib/url/safeUrl'

/**
 * Episode content-type session for {@link PublicationContentEditor}.
 * Owns series gate, audio attach/save (preserved for #731), cover, formats, and
 * episode preflight. Audio upload still saves-then-attaches as today.
 */
export function useEpisodeContentEditor(
    episodeId?: number,
): ContentEditorModel<EpisodeDetail> {
    const descriptor = episodeContentEditorDescriptor
    const dict = useDictionary()
    const router = useRouter()
    const localize = useLocalizedPath()
    const authRedirect = useAuthRequired()
    const config = useSiteConfig()
    const showNotify = config.emailNotifyAvailable === true
    const notifyAudienceHint = useNotifyAudienceHint(showNotify)
    const [episode, setEpisode] = useState<EpisodeDetail | null>(null)
    // Survives a deferred-create attach failure while the route is still /new (#731 review).
    const deferredCreateIdRef = useRef<number | undefined>(undefined)
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
        scheduleValidationError,
        publishedAt,
        setPublishedAt,
        applyPublicationPublishedAt,
        validatePublishedAt,
        setPublishValidationError,
        publishValidationError,
    } = usePublicationEditorFields()
    useDefaultNotifySubscribers(showNotify, setNotifySubscribers)
    // RBAC desk adaptation (issue #148); hook call stays above all early
    // returns. New rows count as own; the backend enforces per row.
    const desk = useDeskAccess({
        entity: descriptor.deskEntity,
        ownerUserId: episodeId === undefined ? undefined : (episode?.createdBy ?? null),
        kind: descriptor.labels.contentLabel,
    })
    const [episodeNumber, setEpisodeNumber] = useState('')
    const [isUploading, setIsUploading] = useState(false)
    const [isEnclosureSaving, setIsEnclosureSaving] = useState(false)
    const [uploadProgress, setUploadProgress] = useState<{
        file: File
        progress: number
    } | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const mountedRef = useRef(true)
    const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null)
    const [audioPreviewError, setAudioPreviewError] = useState<string | null>(null)
    const [audioReady, setAudioReady] = useState(false)
    const [audioStatusKnown, setAudioStatusKnown] = useState(true)
    const [audioFilename, setAudioFilename] = useState<string | null>(null)
    const [availableFormats, setAvailableFormats] = useState<FormatSummary[]>([])
    const [availableCategories, setAvailableCategories] = useState<CategorySummary[]>([])
    const [selectedFormatIds, setSelectedFormatIds] = useState<Set<number>>(new Set())
    const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<number>>(new Set())
    const [coverAssetId, setCoverAssetId] = useState<number | null>(null)
    const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null)
    const audioAssetId = episode?.audioAssetId ?? null
    const hasDigitalContent = hasModule(config, 'DIGITAL_CONTENT')

    const episodeFields = useCallback(() => {
        const resolvedSlug = slug.trim() || suggestSlug(title) || 'folge'
        const clearedFloor = episodeId === undefined ? undefined : 0
        return {
            title: title.trim() || 'Ohne Titel',
            slug: resolvedSlug,
            description: body,
            accessPolicy,
            episodeNumber: optionalMinInt(episodeNumber, 1),
            // #530: on update an omitted field means "leave unchanged", so a cleared floor
            // must be sent as 0 (the access path already reads a null floor as 0).
            // Review fix: on CREATE, omission means "inherit the series default"
            // (EpisodeService.createEpisode), so the clear value must not be sent there —
            // otherwise a new PAID episode silently loosens to level 0.
            requiredLevelSortOrder:
                accessPolicy === 'PAID'
                    ? (requiredLevelSortOrder ?? clearedFloor)
                    : clearedFloor,
            coverAssetId: coverAssetId ?? undefined,
        }
    }, [
        accessPolicy,
        body,
        coverAssetId,
        episodeId,
        episodeNumber,
        requiredLevelSortOrder,
        slug,
        title,
    ])

    const persistTags = useCallback(
        async (current: EpisodeDetail): Promise<EpisodeDetail> => {
            const [afterFormats, afterCategories] = await Promise.all([
                replaceEpisodeFormats(current.id, Array.from(selectedFormatIds)),
                replaceEpisodeCategories(current.id, Array.from(selectedCategoryIds)),
            ])
            const merged = {
                ...afterCategories,
                formats: afterFormats.formats,
            }
            setEpisode(merged)
            setSelectedFormatIds(new Set(afterFormats.formats.map((tag) => tag.id)))
            setSelectedCategoryIds(
                new Set(afterCategories.categories.map((tag) => tag.id)),
            )
            return merged
        },
        [selectedCategoryIds, selectedFormatIds],
    )

    const saveImpl = useCallback(
        async (options?: {
            autosave?: boolean
            deferCreateRedirect?: boolean
        }): Promise<EpisodeDetail | null> => {
            if (seriesId === null) {
                throw new Error('Bitte zuerst eine Sendung anlegen.')
            }

            const payload = episodeFields()
            const existingId = resolvePersistEpisodeId(
                episodeId,
                deferredCreateIdRef.current,
                episode?.id,
            )

            if (existingId === undefined) {
                const created = await createEpisode({
                    ...payload,
                    seriesId,
                })
                deferredCreateIdRef.current = created.id
                setEpisode(created)
                // #731: audio upload/library attach navigates after attachEpisodeAudio.
                if (options?.deferCreateRedirect !== true) {
                    router.replace(localize(descriptor.paths.editor(created.id)))
                }
                return created
            }

            const updated = await updateEpisode(existingId, {
                ...payload,
                clearCoverAsset: coverAssetId === null,
            })
            const withTags = await persistTags(updated)
            setEpisode(withTags)
            setAllEpisodes((current) =>
                current.map((item) => (item.id === withTags.id ? withTags : item)),
            )
            return withTags
        },
        [
            coverAssetId,
            descriptor.paths,
            episode,
            episodeFields,
            episodeId,
            localize,
            persistTags,
            router,
            seriesId,
        ],
    )

    const {
        isSaving,
        errorMessage,
        setErrorMessage,
        saveHint,
        isDirty,
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

    const coverUpload = useCoverImageUpload({
        onUploaded: (assetId) => {
            setCoverAssetId(assetId)
            markDirty()
        },
        onError: handleAuthError,
    })

    useEffect(() => {
        let active = true

        if (audioAssetId === null) {
            setAudioPreviewUrl(null)
            setAudioPreviewError(null)
            setAudioReady(false)
            setAudioStatusKnown(true)
            setAudioFilename(null)
            return
        }

        setAudioPreviewUrl(null)
        setAudioPreviewError(null)
        setAudioReady(false)
        setAudioStatusKnown(false)

        async function loadAudio(assetId: number): Promise<void> {
            try {
                const [url, asset] = await Promise.all([
                    getMediaPreviewUrl(assetId),
                    getMedia(assetId),
                ])
                if (!active) {
                    return
                }
                const previewUrl = safeImageSrc(url)
                setAudioPreviewUrl(previewUrl)
                setAudioPreviewError(
                    previewUrl === null ? 'Audio-Vorschau ist nicht verfügbar.' : null,
                )
                setAudioReady(asset.status === 'READY')
                setAudioStatusKnown(true)
                const name = asset.originalFilename?.trim()
                setAudioFilename(
                    name !== undefined && name.length > 0 ? name : `Asset #${assetId}`,
                )
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
                setAudioFilename(`Asset #${assetId}`)
            }
        }

        void loadAudio(audioAssetId)

        return () => {
            active = false
        }
    }, [audioAssetId, authRedirect])

    useEffect(() => {
        let active = true

        if (coverAssetId === null) {
            setCoverPreviewUrl(null)
            return
        }

        getMediaPreviewUrl(coverAssetId)
            .then((url) => {
                if (active) {
                    setCoverPreviewUrl(safeImageSrc(url))
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
                const [seriesList, formatList, categoryList, episodeList, loadedEpisode] =
                    await Promise.all([
                        listSeries(),
                        listFormats(),
                        listCategories(),
                        listEpisodes(),
                        episodeId === undefined ? null : getEpisode(episodeId),
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
                    setSelectedFormatIds(
                        new Set(loadedEpisode.formats.map((tag) => tag.id)),
                    )
                    setSelectedCategoryIds(
                        new Set(loadedEpisode.categories.map((tag) => tag.id)),
                    )
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
        router.replace(localize('/login'))
    }, [localize, router])

    const handleAudioUpload = useCallback(
        async (file: File | null) => {
            if (file === null) {
                return
            }

            const wasCreate = episodeId === undefined
            const saved = await save({deferCreateRedirect: true})
            if (saved === null) {
                return
            }

            setIsUploading(true)
            setErrorMessage(null)
            setAudioFilename(file.name)
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
                const updated = await attachEpisodeAudio(saved.id, asset.id)
                setEpisode(updated)
                const name = asset.originalFilename?.trim()
                setAudioFilename(
                    name !== undefined && name.length > 0 ? name : file.name,
                )
                if (wasCreate) {
                    router.replace(localize(descriptor.paths.editor(updated.id)))
                }
            } catch (error) {
                handleAuthError(error)
                // Leave /new so a retry updates the created episode instead of creating another.
                if (wasCreate) {
                    router.replace(localize(descriptor.paths.editor(saved.id)))
                }
            } finally {
                if (mountedRef.current) {
                    setIsUploading(false)
                    setUploadProgress(null)
                }
            }
        },
        [
            descriptor.paths,
            episodeId,
            handleAuthError,
            localize,
            router,
            save,
            setErrorMessage,
        ],
    )

    const handleAudioFromLibrary = useCallback(
        async (asset: {id: number; originalFilename?: string | null}) => {
            const wasCreate = episodeId === undefined
            const saved = await save({deferCreateRedirect: true})
            if (saved === null) {
                return
            }

            const optimistic = asset.originalFilename?.trim()
            if (optimistic !== undefined && optimistic.length > 0) {
                setAudioFilename(optimistic)
            }

            setIsUploading(true)
            setErrorMessage(null)
            try {
                const updated = await attachEpisodeAudio(saved.id, asset.id)
                setEpisode(updated)
                if (wasCreate) {
                    router.replace(localize(descriptor.paths.editor(updated.id)))
                }
            } catch (error) {
                handleAuthError(error)
                if (wasCreate) {
                    router.replace(localize(descriptor.paths.editor(saved.id)))
                }
            } finally {
                setIsUploading(false)
            }
        },
        [
            descriptor.paths,
            episodeId,
            handleAuthError,
            localize,
            router,
            save,
            setErrorMessage,
        ],
    )

    function handleCoverUpload(file: File | null): Promise<void> {
        setErrorMessage(null)
        return coverUpload.upload(file)
    }

    const handleEnclosureChange = useCallback(
        async (enabled: boolean) => {
            if (episode === null) {
                return
            }

            setIsEnclosureSaving(true)
            setErrorMessage(null)
            try {
                const updated = await setEpisodeEnclosureEnabled(episode.id, enabled)
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

    const busy =
        isSaving || isUploading || coverUpload.isUploading || isEnclosureSaving
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
    const readOnly = !desk.canEdit
    const controlsDisabled = busy || readOnly
    const episodePageUrl = publicEpisodePageUrl(config.publicSiteUrl, slug)
    const publishedLinks =
        episode?.status === 'PUBLISHED'
            ? [
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
            : null

    const seriesGate =
        !isLoading && series.length === 0 ? (
            <EmptyState
                description={dict.podcast.bevorFolgeErstellstBrauchstSendungPodcast}
                title="Zuerst eine Sendung anlegen"
                action={
                    <div className="flex flex-wrap justify-center gap-2">
                        <Button
                            nativeButton={false}
                            render={<LocaleLink href="/podcast/series/new" />}
                        >
                            Zuerst eine Sendung anlegen
                        </Button>
                        <Button
                            nativeButton={false}
                            render={<LocaleLink href="/podcast" />}
                            variant="outline"
                        >
                            Zur Podcast-Übersicht
                        </Button>
                    </div>
                }
            />
        ) : null

    const aboveEditor =
        seriesGate === null ? (
            <>
                {episodeId === undefined && (
                    <label className="grid max-w-2xl gap-2 text-sm font-medium">
                        <span>Sendung</span>
                        <SelectControl
                            aria-label="Sendung"
                            value={seriesId ?? ''}
                            onChange={(event) =>
                                setSeriesId(Number(event.target.value))
                            }
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
                                <LocaleLink href={`/podcast/series/${selectedSeries.id}`}>
                                    Sendung veröffentlichen
                                </LocaleLink>
                                , damit der Feed erscheint.
                            </p>
                        ) : null}
                    </label>
                )}
                {episodeId !== undefined && selectedSeries?.status === 'DRAFT' ? (
                    <p className="text-xs text-muted-foreground">
                        Die Sendung ist noch nicht veröffentlicht.{' '}
                        <LocaleLink href={`/podcast/series/${selectedSeries.id}`}>
                            Sendung veröffentlichen
                        </LocaleLink>
                        , damit der öffentliche Feed die Folge aufnehmen kann.
                    </p>
                ) : null}
            </>
        ) : null

    return {
        descriptor,
        isLoading,
        gate: seriesGate,
        aboveEditor,
        wrapInPageStack: true,
        publication: episode,
        publicationId: episodeId,
        title,
        slug,
        body,
        accessPolicy,
        requiredLevelSortOrder,
        onRequiredLevelChange: (value) => {
            setRequiredLevelSortOrder(value)
            markDirty()
        },
        notifySubscribers,
        onNotifyChange: setNotifySubscribers,
        scheduledAt,
        onScheduledAtChange: setScheduledAt,
        publishedAt,
        onPublishedAtChange: setPublishedAt,
        publishValidationError,
        scheduleValidationError,
        validatePublishedAt,
        parseScheduledAt,
        setPublishValidationError,
        setScheduleValidationError,
        isSaving,
        errorMessage,
        setErrorMessage,
        saveHint,
        isDirty,
        busy,
        save,
        runWorkflow,
        desk,
        publishBlockedReason,
        showNotify,
        notifyAudienceHint,
        previewImageUrl: coverPreviewUrl,
        previewUrl: episodePageUrl,
        publishedLinks,
        publishedLinksHint:
            'Direkt nach dem Veröffentlichen kann der Feed noch 404 liefern, bis der Snapshot geschrieben ist. Danach leitet Directwerk mit 302 zur Datei weiter.',
        slugTaken,
        onAuthRequired: handleAuthRequired,
        onTitleChange: (value) => {
            setTitle(value)
            markDirty()
            if (episodeId === undefined && slug.trim().length === 0) {
                setSlug(suggestSlug(value))
            }
        },
        onBodyChange: (value) => {
            setBody(value)
            markDirty()
        },
        onAccessPolicyChange: (value) => {
            setAccessPolicy(value)
            markDirty()
        },
        onSlugChange: (value) => {
            setSlug(value)
            markDirty()
        },
        sidebarExtra: (
            <EpisodeEditorSidebar
                title={title}
                hasAudio={hasAudio}
                audioAssetId={audioAssetId}
                audioFilename={audioFilename}
                audioPreviewUrl={audioPreviewUrl}
                audioPreviewError={audioPreviewError}
                audioReady={audioReady}
                audioStatusKnown={audioStatusKnown}
                isUploading={isUploading}
                uploadProgress={uploadProgress}
                coverAssetId={coverAssetId}
                coverPreviewUrl={coverPreviewUrl}
                coverUploadProgress={coverUpload.uploadProgress}
                episodeNumber={episodeNumber}
                enclosureEnabled={episode?.enclosureEnabled !== false}
                showEnclosure={episode !== null}
                showClassification={episode !== null}
                availableFormats={availableFormats}
                availableCategories={availableCategories}
                selectedFormatIds={selectedFormatIds}
                selectedCategoryIds={selectedCategoryIds}
                controlsDisabled={controlsDisabled}
                isEnclosureSaving={isEnclosureSaving}
                showLibraryPicker={hasDigitalContent}
                onAuthRequired={handleAuthRequired}
                onAudioUpload={handleAudioUpload}
                onAudioFromLibrary={handleAudioFromLibrary}
                onCoverUpload={handleCoverUpload}
                onCoverSelect={(assetId) => {
                    setCoverAssetId(assetId)
                    markDirty()
                }}
                onCoverClear={() => {
                    setCoverAssetId(null)
                    markDirty()
                }}
                onEpisodeNumberChange={(value) => {
                    setEpisodeNumber(value)
                    markDirty()
                }}
                onEnclosureChange={(enabled) => {
                    void handleEnclosureChange(enabled)
                }}
                onFormatChange={(ids) => {
                    setSelectedFormatIds(ids)
                    markDirty()
                }}
                onCategoryChange={(ids) => {
                    setSelectedCategoryIds(ids)
                    markDirty()
                }}
            />
        ),
        onDeleted: () => router.replace(localize(descriptor.paths.list)),
    }
}
