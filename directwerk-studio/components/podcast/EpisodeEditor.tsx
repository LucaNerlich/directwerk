'use client'

import SelectControl from '@/components/studio/SelectControl'
import LevelSelect from '@/components/studio/LevelSelect'

import {Button} from '@directwerk/ui/components/button'
import {Input} from '@directwerk/ui/components/input'

import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {useCallback, useEffect, useEffectEvent, useRef, useState} from 'react'

import MediaLibraryPicker from '@/components/media/MediaLibraryPicker'
import UploadProgress from '@/components/media/UploadProgress'
import PublicationEditorLayout from '@/components/publication/PublicationEditorLayout'
import PublishedLinksPanel from '@/components/publication/PublishedLinksPanel'
import {hasModule} from '@/lib/api/client'
import {
    archiveEpisode,
    attachEpisodeAudio,
    cancelScheduleEpisode,
    createEpisode,
    getEpisode,
    getMedia,
    getMediaPreviewUrl,
    listCategories,
    listFormats,
    listSeries,
    publishEpisode,
    replaceEpisodeCategories,
    replaceEpisodeFormats,
    scheduleEpisode,
    setEpisodeEnclosureEnabled,
    suggestSlug,
    unarchiveEpisode,
    unpublishEpisode,
    updateEpisode,
} from '@/lib/api/tenantApi'
import type {AccessPolicy, CategorySummary, EpisodeDetail, FormatSummary, SeriesSummary} from '@directwerk/api/types'
import {fromDatetimeLocalValue, toDatetimeLocalValue} from '@/lib/datetime'
import {mediaLimitLabel} from '@/lib/media/limits'
import {uploadMediaFile} from '@/lib/media/upload'
import {episodePublishBlockReason} from '@/lib/podcast/episodePreflight'
import {publicEpisodePageUrl} from '@/lib/podcast/publicUrls'
import {useSiteConfig} from '@/lib/site/SiteConfigProvider'
import {useDraftAutosave} from '@/lib/editor/useDraftAutosave'
import {getClientTenantHost} from '@/lib/tenant/getClientTenantHost'
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

/**
 * Provides an editor for creating or managing a podcast episode, including metadata, publication workflow, audio, and tags.
 *
 * @param episodeId - The ID of the episode to edit; omit to create a new episode.
 * @returns The episode editor interface.
 */
export default function EpisodeEditor({episodeId}: {episodeId?: number}): React.JSX.Element {
    const router = useRouter()
    const authRedirect = useAuthRequired()
    const config = useSiteConfig()
    const showNotify = config.emailNotifyAvailable === true
    const [episode, setEpisode] = useState<EpisodeDetail | null>(null)
    const [series, setSeries] = useState<SeriesSummary[]>([])
    const [seriesId, setSeriesId] = useState<number | null>(null)
    const [title, setTitle] = useState('')
    const [slug, setSlug] = useState('')
    const [body, setBody] = useState('')
    const [accessPolicy, setAccessPolicy] = useState<AccessPolicy>('FREE')
    const [episodeNumber, setEpisodeNumber] = useState('')
    const [requiredLevelSortOrder, setRequiredLevelSortOrder] = useState<number | null>(null)
    const [notifySubscribers, setNotifySubscribers] = useState(false)
    const [scheduledAt, setScheduledAt] = useState('')
    const [isSaving, setIsSaving] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState<{file: File; progress: number} | null>(
        null,
    )
    const [isLoading, setIsLoading] = useState(true)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const mountedRef = useRef(true)
    const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null)
    const [audioPreviewError, setAudioPreviewError] = useState<string | null>(null)
    const [audioReady, setAudioReady] = useState(false)
    const [audioStatusKnown, setAudioStatusKnown] = useState(true)
    const [availableFormats, setAvailableFormats] = useState<FormatSummary[]>([])
    const [availableCategories, setAvailableCategories] = useState<CategorySummary[]>([])
    const [selectedFormatIds, setSelectedFormatIds] = useState<Set<number>>(new Set())
    const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<number>>(new Set())
    const [isTagsSaving, setIsTagsSaving] = useState(false)
    const [tagsStatusMessage, setTagsStatusMessage] = useState<string | null>(null)
    const [isDirty, setIsDirty] = useState(false)
    const [dirtyRevision, setDirtyRevision] = useState(0)
    const [saveHint, setSaveHint] = useState<string | null>(null)
    const audioAssetId = episode?.audioAssetId ?? null
    const hasDigitalContent = hasModule(config, 'DIGITAL_CONTENT')

    const redirectToLogin = useEffectEvent(() => {
        router.replace('/login')
    })

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
        mountedRef.current = true
        let active = true

        async function load(): Promise<void> {
            try {
                const host = getClientTenantHost()
                const [seriesList, formatList, categoryList, loadedEpisode] = await Promise.all([
                    listSeries(host),
                    listFormats(host),
                    listCategories(host),
                    episodeId === undefined ? null : getEpisode(host, episodeId),
                ])

                if (!active) {
                    return
                }

                setSeries(seriesList)
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
                    setScheduledAt(toDatetimeLocalValue(loadedEpisode.scheduledAt))
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
    }, [episodeId, router])

    const handleAuthError = useCallback(
        (error: unknown) => {
            if (authRedirect(error)) return
            setErrorMessage(
                error instanceof Error ? error.message : 'Aktion fehlgeschlagen.',
            )
        },
        [router],
    )

    const handleAuthRequired = useCallback(() => {
        router.replace('/login')
    }, [router])

    const episodeFields = useCallback(() => {
        const resolvedSlug = slug.trim() || suggestSlug(title) || 'folge'
        return {
            title: title.trim() || 'Ohne Titel',
            slug: resolvedSlug,
            description: body,
            accessPolicy,
            episodeNumber: optionalMinInt(episodeNumber, 1),
            requiredLevelSortOrder: requiredLevelSortOrder ?? undefined,
        }
    }, [accessPolicy, body, episodeNumber, requiredLevelSortOrder, slug, title])

    const markDirty = useCallback(() => {
        setIsDirty(true)
        setDirtyRevision((current) => current + 1)
        setSaveHint('Ungespeicherte Änderungen')
    }, [])

    const save = useCallback(async (options?: {autosave?: boolean}): Promise<EpisodeDetail | null> => {
        if (seriesId === null) {
            setErrorMessage('Bitte zuerst eine Sendung anlegen.')
            return null
        }

        setIsSaving(true)
        setErrorMessage(null)

        try {
            const host = getClientTenantHost()
            const payload = episodeFields()
            const hint = options?.autosave === true ? 'Automatisch gespeichert' : 'Gespeichert'

            if (episodeId === undefined) {
                const created = await createEpisode(host, {
                    ...payload,
                    seriesId,
                })
                setEpisode(created)
                setIsDirty(false)
                setSaveHint(hint)
                router.replace(`/podcast/episodes/${created.id}`)
                return created
            }

            const updated = await updateEpisode(host, episodeId, payload)
            setEpisode(updated)
            setIsDirty(false)
            setSaveHint(hint)
            return updated
        } catch (error) {
            authRedirect(error)
            return null
        } finally {
            setIsSaving(false)
        }
    }, [episodeFields, episodeId, handleAuthError, router, seriesId])

    useDraftAutosave({
        enabled: (episode?.status ?? 'DRAFT') === 'DRAFT' && episodeId !== undefined,
        isDirty,
        isSaving: isSaving || isUploading || isTagsSaving,
        onSave: () => save({autosave: true}),
        revision: dirtyRevision,
    })

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

    const runWorkflow = useCallback(
        async (
            action: (current: EpisodeDetail) => Promise<EpisodeDetail>,
            options?: {persistTags?: boolean},
        ) => {
            const status = episode?.status ?? 'DRAFT'
            let current: EpisodeDetail | null
            if (episodeId === undefined || status === 'DRAFT') {
                current = await save()
            } else {
                current = episode
            }
            if (current === null) {
                return
            }

            setIsSaving(true)
            setErrorMessage(null)
            try {
                if (options?.persistTags === true) {
                    current = await persistTags(current)
                }
                const next = await action(current)
                setEpisode(next)
                setScheduledAt(toDatetimeLocalValue(next.scheduledAt))
                if (next.episodeNumber !== null) {
                    setEpisodeNumber(String(next.episodeNumber))
                }
                setRequiredLevelSortOrder(next.requiredLevelSortOrder)
            } catch (error) {
                authRedirect(error)
            } finally {
                setIsSaving(false)
            }
        },
        [episode, episodeId, handleAuthError, persistTags, save],
    )

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
                authRedirect(error)
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
                authRedirect(error)
            } finally {
                setIsUploading(false)
            }
        },
        [handleAuthError, save],
    )

    const handleSaveTags = useCallback(async (): Promise<void> => {
        if (episode === null) {
            return
        }

        setIsTagsSaving(true)
        setTagsStatusMessage(null)
        try {
            await persistTags(episode)
            setTagsStatusMessage('Formate & Kategorien gespeichert.')
        } catch (error) {
            authRedirect(error)
        } finally {
            setIsTagsSaving(false)
        }
    }, [episode, handleAuthError, persistTags])

    const handleEnclosureChange = useCallback(
        async (enabled: boolean) => {
            if (episode === null) {
                return
            }

            setIsSaving(true)
            setErrorMessage(null)
            try {
                const updated = await setEpisodeEnclosureEnabled(
                    getClientTenantHost(),
                    episode.id,
                    enabled,
                )
                setEpisode(updated)
            } catch (error) {
                authRedirect(error)
            } finally {
                setIsSaving(false)
            }
        },
        [episode, handleAuthError],
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

    const busy = isSaving || isUploading
    const hasAudio = audioAssetId !== null
    const selectedSeries = series.find((item) => item.id === seriesId) ?? null
    const publishBlockedReason = episodePublishBlockReason({
        seriesStatus: selectedSeries?.status ?? null,
        hasAudioAsset: hasAudio,
        audioReady,
        audioStatusKnown,
        showNotes: body,
        formatRequired: availableFormats.length > 0,
        formatSelected: selectedFormatIds.size > 0,
    })
    const episodePageUrl = publicEpisodePageUrl(config.publicRssUrl, slug)
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
                scheduledAt={scheduledAt}
                onScheduledAtChange={setScheduledAt}
                onSave={() => {
                    void save()
                }}
                onPublish={() => {
                    void runWorkflow(
                        (saved) =>
                            publishEpisode(getClientTenantHost(), saved.id, {
                                notifySubscribers,
                            }),
                        {persistTags: true},
                    )
                }}
                onSchedule={() => {
                    const iso = fromDatetimeLocalValue(scheduledAt)
                    if (iso === null) {
                        setErrorMessage('Bitte einen gültigen Zeitpunkt wählen.')
                        return
                    }
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
                            <label className="grid gap-2 text-sm font-medium" style={{display: 'block'}}>
                                <Input
                                    checked={episode.enclosureEnabled !== false}
                                    onChange={(event) => {
                                        void handleEnclosureChange(event.target.checked)
                                    }}
                                    className="size-4 shrink-0" type="checkbox"
                                />{' '}
                                Audio im Feed (Enclosure)
                            </label>
                        ) : null}
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
                            <div className="grid gap-2">
                                <p className="text-sm font-semibold">Formate</p>
                                {availableFormats.length === 0 ? (
                                    <p className="text-xs text-muted-foreground">
                                        Keine Formate angelegt.{' '}
                                        <Link href="/podcast/formats/new">
                                            Formate einrichten
                                        </Link>
                                    </p>
                                ) : (
                                    availableFormats.map((format) => (
                                        <label key={format.id} className="grid gap-2 text-sm font-medium" style={{display: 'block'}}>
                                            <Input
                                                checked={selectedFormatIds.has(format.id)}
                                                onChange={(event) => {
                                                    setSelectedFormatIds((current) => {
                                                        const next = new Set(current)
                                                        if (event.target.checked) {
                                                            next.add(format.id)
                                                        } else {
                                                            next.delete(format.id)
                                                        }
                                                        return next
                                                    })
                                                }}
                                                className="size-4 shrink-0" type="checkbox"
                                            />{' '}
                                            {format.name}
                                        </label>
                                    ))
                                )}
                                <p className="text-sm font-semibold">Kategorien</p>
                                {availableCategories.length === 0 ? (
                                    <p className="text-xs text-muted-foreground">Keine Kategorien angelegt.</p>
                                ) : (
                                    availableCategories.map((category) => (
                                        <label key={category.id} className="grid gap-2 text-sm font-medium" style={{display: 'block'}}>
                                            <Input
                                                checked={selectedCategoryIds.has(category.id)}
                                                onChange={(event) => {
                                                    setSelectedCategoryIds((current) => {
                                                        const next = new Set(current)
                                                        if (event.target.checked) {
                                                            next.add(category.id)
                                                        } else {
                                                            next.delete(category.id)
                                                        }
                                                        return next
                                                    })
                                                }}
                                                className="size-4 shrink-0" type="checkbox"
                                            />{' '}
                                            {category.name}
                                        </label>
                                    ))
                                )}
                                {tagsStatusMessage !== null ? (
                                    <p className="text-xs text-muted-foreground" role="status">
                                        {tagsStatusMessage}
                                    </p>
                                ) : null}
                                <Button
                                    disabled={isTagsSaving}
                                    onClick={() => void handleSaveTags()}
                                    type="button"
                                >
                                    {isTagsSaving ? 'Speichert…' : 'Formate & Kategorien speichern'}
                                </Button>
                            </div>
                        ) : null}
                    </>
                }
            />
        </div>
    )
}
