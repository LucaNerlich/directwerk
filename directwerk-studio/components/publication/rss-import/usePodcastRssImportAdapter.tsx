'use client'

import {useEffect, useLayoutEffect, useRef, useState} from 'react'

import {Button} from '@directwerk/ui/components/button'
import {Input} from '@directwerk/ui/components/input'
import {Textarea} from '@directwerk/ui/components/textarea'
import SectionHeader from '@directwerk/ui/components/section-header'

import SelectControl from '@/components/studio/SelectControl'
import {createFormat, listFormats} from '@/lib/api/catalogApi'
import {createSeries, listSeries} from '@/lib/api/podcastApi'
import {bulkImportRss, importRssEpisode, previewRssFeed} from '@/lib/api/podcastImportApi'
import {ingestRemoteAssetWithProgress} from '@/lib/media/remoteIngest'
import {filenameFromImportUrl} from '@/lib/media/importFilename'
import {formatBytes} from '@directwerk/api/format/bytes'
import {deleteMedia} from '@/lib/api/mediaApi'
import {isTenantAdminRole, suggestSlug} from '@/lib/api/studioHelpers'
import {parseOptionalInt} from '@/lib/publication/parsePositiveInt'
import {useOptionalMe} from '@/lib/auth/MeProvider'
import {HTML_SLUG_PATTERN} from '@directwerk/api/constants'
import {formatDuration} from '@directwerk/api/format/duration'
import {getClientTenantHost} from '@directwerk/api/tenant'
import {useAuthRequired} from '@directwerk/api/auth/useAuthRequired'
import type {
    FormatSummary,
    RssImportEpisodePreview,
    RssImportPreview,
    SeriesSummary,
} from '@directwerk/api/types'
import type {Dictionary} from '@/lib/i18n/dictionary'

import {
    AccessPolicyFields,
    BulkImportPanel,
    IdCheckboxList,
    OptionalCreateNameField,
} from './RssImportSharedUi'
import type {RssImportContentAdapter, RssImportSharedChrome} from './types'

const STEPS = [
    {id: 'url', label: '1. Feed'},
    {id: 'series', label: '2. Sendung'},
    {id: 'formats', label: '3. Formate'},
    {id: 'episode', label: '4. Folgen'},
    {id: 'done', label: '5. Fertig'},
] as const

function podcastLabels(dict: Dictionary) {
    return {
        eyebrow: dict.nav.podcast.label,
        title: dict.common.rssImport,
        description: dict.podcast.bestehendenFeedSchrittSchrittUebernehmenZue,
        urlTitle: dict.podcast.feedAdresse,
        urlDescription: dict.podcast.oeffentlicheRssUrlDeinesBisherigenHosters,
        urlPlaceholder: 'https://example.com/podcast.xml',
        urlSubmit: 'Feed laden',
        urlSubmitBusy: 'Feed wird gelesen…',
        prerequisitesLoading: 'Sendungen und Formate werden geladen…',
        prerequisitesReload: 'Erneut laden',
        itemImportLabel: 'Diese Folge importieren',
        itemImportBusy: 'Wird nach S3 gestreamt…',
        itemBackLabel: 'Zurück zu Formaten',
        doneListHref: '/podcast/episodes',
        doneListLabel: 'Zur Folgenliste',
        bulkImportStartedTitle: dict.write.bulkImportStarted,
        importFinishedTitle: dict.write.importFinished,
        serverSideTransfer: dict.write.serverSideTransfer,
        accessFree: dict.common.access.free,
        accessPaid: dict.common.access.paid,
        allFree: dict.write.allFree,
        allPaid: dict.write.allPaid,
        previewErrorFallback: 'Der Feed konnte nicht gelesen werden.',
        importErrorFallback: 'Folge konnte nicht importiert werden.',
    }
}

export function usePodcastRssImportAdapter(): RssImportContentAdapter {
    const authRedirect = useAuthRequired()
    const authRedirectRef = useRef(authRedirect)
    useLayoutEffect(() => {
        authRedirectRef.current = authRedirect
    }, [authRedirect])
    const me = useOptionalMe()
    const canCreateFormats = me !== null && isTenantAdminRole(me.roles)

    const [preview, setPreview] = useState<RssImportPreview | null>(null)
    const [series, setSeries] = useState<SeriesSummary[]>([])
    const [formats, setFormats] = useState<FormatSummary[]>([])
    const [seriesMode, setSeriesMode] = useState<'existing' | 'new'>('new')
    const [selectedSeriesId, setSelectedSeriesId] = useState<number | null>(null)
    const [seriesTitle, setSeriesTitle] = useState('')
    const [seriesSlug, setSeriesSlug] = useState('')
    const [seriesSlugDirty, setSeriesSlugDirty] = useState(false)
    const [seriesDescription, setSeriesDescription] = useState('')
    const [seriesLanguage, setSeriesLanguage] = useState('de')
    const [seriesItunesCategory, setSeriesItunesCategory] = useState('')
    const [importSeriesCover, setImportSeriesCover] = useState(true)
    const [resolvedSeriesId, setResolvedSeriesId] = useState<number | null>(null)
    const [defaultFormatIds, setDefaultFormatIds] = useState<Set<number>>(new Set())
    const [episodeFormatIds, setEpisodeFormatIds] = useState<Set<number>>(new Set())
    const [newFormatName, setNewFormatName] = useState('')
    const [episodeIndex, setEpisodeIndex] = useState(0)
    const [episodeTitle, setEpisodeTitle] = useState('')
    const [episodeSlug, setEpisodeSlug] = useState('')
    const [episodeDescription, setEpisodeDescription] = useState('')
    const [episodeNumber, setEpisodeNumber] = useState('')
    const [importAudio, setImportAudio] = useState(true)
    const [importImage, setImportImage] = useState(true)
    const [prerequisitesStatus, setPrerequisitesStatus] = useState<
        'loading' | 'ready' | 'error'
    >('loading')
    const [prerequisitesError, setPrerequisitesError] = useState<string | null>(null)
    const [prerequisitesReload, setPrerequisitesReload] = useState(0)

    useEffect(() => {
        let active = true
        setPrerequisitesStatus('loading')
        setPrerequisitesError(null)
        Promise.all([listSeries(), listFormats()])
            .then(([loadedSeries, loadedFormats]) => {
                if (!active) {
                    return
                }
                setSeries(loadedSeries)
                setFormats(loadedFormats)
                if (loadedSeries.length > 0) {
                    setSeriesMode('existing')
                    setSelectedSeriesId(loadedSeries[0].id)
                }
                setPrerequisitesStatus('ready')
            })
            .catch((error: unknown) => {
                if (authRedirectRef.current(error)) {
                    return
                }
                setPrerequisitesError(
                    error instanceof Error
                        ? error.message
                        : 'Sendungen konnten nicht geladen werden.',
                )
                setPrerequisitesStatus('error')
            })
        return () => {
            active = false
        }
    }, [prerequisitesReload])

    function applyEpisode(
        item: RssImportEpisodePreview,
        formatIds: Set<number> = defaultFormatIds,
    ): void {
        setEpisodeTitle(item.title)
        setEpisodeSlug(item.suggestedSlug)
        setEpisodeDescription(item.description ?? '')
        setEpisodeNumber(item.episodeNumber != null ? String(item.episodeNumber) : '')
        setImportAudio(item.audioUrl != null)
        setImportImage(item.imageUrl != null)
        setEpisodeFormatIds(new Set(formatIds))
    }

    async function ensureDefaultFormatIds(): Promise<Set<number>> {
        const nextDefaultFormatIds = new Set(defaultFormatIds)
        const name = canCreateFormats ? newFormatName.trim() : ''
        if (name.length > 0) {
            const created = await createFormat({
                slug: suggestSlug(name) || 'format',
                name,
            })
            setFormats((current) => [...current, created])
            nextDefaultFormatIds.add(created.id)
            setDefaultFormatIds(nextDefaultFormatIds)
            setNewFormatName('')
        }
        return nextDefaultFormatIds
    }

    const currentEpisode = preview?.episodes[episodeIndex] ?? null
    const bulkAlreadyImportedCount =
        preview?.episodes.filter((episode) => episode.alreadyImportedEpisodeId !== null)
            .length ?? 0
    const bulkPendingCount = (preview?.episodes.length ?? 0) - bulkAlreadyImportedCount

    return {
        steps: STEPS,
        afterPreviewStepId: 'series',
        itemStepId: 'episode',
        itemBackStepId: 'formats',
        prerequisitesMode: 'inline',
        resetAccessOnItemNavigate: true,
        urlInputMaxLength: 2048,
        showStepAnnouncement: true,
        labels: podcastLabels,
        prerequisitesStatus,
        prerequisitesError,
        reloadPrerequisites: () => setPrerequisitesReload((value) => value + 1),
        previewFeed: async (feedUrl) => {
            try {
                const loaded = await previewRssFeed(feedUrl)
                setPreview(loaded)
                setSeriesTitle(loaded.channel.title)
                setSeriesSlug(loaded.channel.suggestedSlug)
                setSeriesSlugDirty(false)
                setSeriesDescription(loaded.channel.description ?? '')
                setSeriesLanguage(loaded.channel.language ?? 'de')
                setSeriesItunesCategory(loaded.channel.itunesCategory ?? '')
                setImportSeriesCover(loaded.channel.imageUrl != null)
                if (loaded.episodes.length > 0) {
                    applyEpisode(loaded.episodes[0])
                }
            } catch (error) {
                throw error instanceof Error
                    ? error
                    : new Error('Der Feed konnte nicht gelesen werden.')
            }
        },
        itemIndex: episodeIndex,
        itemCount: preview?.episodes.length ?? 0,
        currentAlreadyImportedId: currentEpisode?.alreadyImportedEpisodeId ?? null,
        currentOpenHref:
            currentEpisode?.alreadyImportedEpisodeId != null
                ? `/podcast/episodes/${currentEpisode.alreadyImportedEpisodeId}`
                : null,
        bulkPendingCount,
        bulkAlreadyImportedCount,
        itemHeading: (index, total) => `Folge ${index + 1} von ${total}`,
        itemDescription: (remaining) =>
            `${remaining} noch offen. Jede Folge wird einzeln nach S3 gestreamt — nicht über den Browser hochgeladen.`,
        alreadyImportedMessage: 'Diese Folge wurde bereits importiert.',
        announceStep: (step, itemIndex) =>
            step === 'url'
                ? 'Feed'
                : step === 'series'
                  ? 'Sendung'
                  : step === 'formats'
                    ? 'Formate'
                    : step === 'episode'
                      ? `Folge ${itemIndex + 1}`
                      : 'Fertig',
        formatManualDoneDescription: (imported, alreadyImported, skipped) =>
            `${imported} Folgen importiert, ${alreadyImported} bereits vorhanden, ${skipped} übersprungen. Entwürfe kannst du jetzt prüfen und veröffentlichen.`,
        formatBulkDoneDescription: (result) =>
            `${result.queuedCount} Folgen sind in der Warteschlange (${result.alreadyImported} bereits vorhanden). Du erhältst eine E-Mail an ${result.notifyEmail}, sobald der Import fertig ist. Entwürfe kannst du danach prüfen und veröffentlichen.`,
        goToItem: (nextIndex) => {
            if (preview == null || nextIndex >= preview.episodes.length) {
                return 'done'
            }
            applyEpisode(preview.episodes[nextIndex])
            setEpisodeIndex(nextIndex)
            return 'item'
        },
        noteSkip: () => {
            const item = preview?.episodes[episodeIndex]
            return item?.alreadyImportedEpisodeId != null ? 'already' : 'skipped'
        },
        importCurrentItem: async (chrome) => {
            if (preview == null || resolvedSeriesId == null || currentEpisode == null) {
                throw new Error('Folge konnte nicht importiert werden.')
            }
            const item = currentEpisode
            let audioAssetId: number | undefined
            let coverAssetId: number | undefined
            try {
                if (importAudio && item.audioUrl != null) {
                    const audio = await ingestRemoteAssetWithProgress(
                        {
                            sourceUrl: item.audioUrl,
                            assetType: 'AUDIO',
                            visibility: 'PRIVATE',
                            filename: filenameFromImportUrl(
                                item.audioUrl,
                                'episode.mp3',
                                suggestSlug(episodeTitle.trim() || item.title) || undefined,
                            ),
                        },
                        (progress, asset) => {
                            const estimatedProgress =
                                progress ??
                                (item.audioSizeBytes != null && item.audioSizeBytes > 0
                                    ? Math.min(
                                          99,
                                          Math.round(
                                              ((asset.bytesTransferred ?? 0) /
                                                  item.audioSizeBytes) *
                                                  100,
                                          ),
                                      )
                                    : null)
                            chrome.setStreamProgress({
                                label: 'Audio (MP3)',
                                progress: estimatedProgress,
                            })
                        },
                    )
                    audioAssetId = audio.id
                }
                if (importImage && item.imageUrl != null) {
                    const cover = await ingestRemoteAssetWithProgress(
                        {
                            sourceUrl: item.imageUrl,
                            assetType: 'IMAGE',
                            visibility: 'PUBLIC',
                            filename: filenameFromImportUrl(
                                item.imageUrl,
                                'cover.jpg',
                                suggestSlug(episodeTitle.trim() || item.title) || undefined,
                            ),
                        },
                        (progress) => {
                            chrome.setStreamProgress({label: 'Cover', progress})
                        },
                    )
                    coverAssetId = cover.id
                }

                chrome.setStreamProgress({label: 'Folge wird angelegt…', progress: 100})
                const parsedNumber = parseOptionalInt(episodeNumber, 1)
                const result = await importRssEpisode({
                    seriesId: resolvedSeriesId,
                    feedUrl: preview.feedUrl,
                    guid: item.guid,
                    slug: episodeSlug.trim() || item.suggestedSlug,
                    title: episodeTitle.trim() || item.title,
                    description: episodeDescription,
                    episodeNumber: parsedNumber,
                    durationSeconds: item.durationSeconds ?? undefined,
                    accessPolicy: chrome.accessPolicy,
                    requiredLevelSortOrder:
                        chrome.accessPolicy === 'PAID'
                            ? (chrome.requiredLevelSortOrder ?? undefined)
                            : undefined,
                    formatIds: Array.from(episodeFormatIds),
                    audioAssetId,
                    coverAssetId,
                    publishedAt: item.publishedAt ?? undefined,
                })
                return result.alreadyImported ? 'already' : 'imported'
            } catch (error) {
                // Best-effort cleanup: already-streamed assets would otherwise
                // linger unreferenced in the media library.
                const orphaned = [audioAssetId, coverAssetId].filter(
                    (id): id is number => id !== undefined,
                )
                if (orphaned.length > 0) {
                    await Promise.allSettled(orphaned.map((id) => deleteMedia(id)))
                }
                throw error instanceof Error
                    ? error
                    : new Error('Folge konnte nicht importiert werden.')
            }
        },
        resetTypeState: () => {
            setPreview(null)
            setSeriesMode(series.length > 0 ? 'existing' : 'new')
            setSelectedSeriesId(series[0]?.id ?? null)
            setSeriesTitle('')
            setSeriesSlug('')
            setSeriesSlugDirty(false)
            setSeriesDescription('')
            setSeriesLanguage('de')
            setSeriesItunesCategory('')
            setImportSeriesCover(true)
            setResolvedSeriesId(null)
            setDefaultFormatIds(new Set())
            setEpisodeFormatIds(new Set())
            setNewFormatName('')
            setEpisodeIndex(0)
            setEpisodeTitle('')
            setEpisodeSlug('')
            setEpisodeDescription('')
            setEpisodeNumber('')
            setImportAudio(true)
            setImportImage(true)
        },
        renderContextSteps: (chrome) => (
            <>
                {chrome.step === 'series' && preview !== null ? (
                    <SeriesStep
                        preview={preview}
                        series={series}
                        setSeries={setSeries}
                        seriesMode={seriesMode}
                        setSeriesMode={setSeriesMode}
                        selectedSeriesId={selectedSeriesId}
                        setSelectedSeriesId={setSelectedSeriesId}
                        seriesTitle={seriesTitle}
                        setSeriesTitle={setSeriesTitle}
                        seriesSlug={seriesSlug}
                        setSeriesSlug={setSeriesSlug}
                        seriesSlugDirty={seriesSlugDirty}
                        setSeriesSlugDirty={setSeriesSlugDirty}
                        seriesDescription={seriesDescription}
                        setSeriesDescription={setSeriesDescription}
                        seriesLanguage={seriesLanguage}
                        setSeriesLanguage={setSeriesLanguage}
                        seriesItunesCategory={seriesItunesCategory}
                        setSeriesItunesCategory={setSeriesItunesCategory}
                        importSeriesCover={importSeriesCover}
                        setImportSeriesCover={setImportSeriesCover}
                        setResolvedSeriesId={setResolvedSeriesId}
                        chrome={chrome}
                    />
                ) : null}
                {chrome.step === 'formats' ? (
                    <FormatsStep
                        preview={preview}
                        formats={formats}
                        defaultFormatIds={defaultFormatIds}
                        setDefaultFormatIds={setDefaultFormatIds}
                        newFormatName={newFormatName}
                        setNewFormatName={setNewFormatName}
                        canCreateFormats={canCreateFormats}
                        resolvedSeriesId={resolvedSeriesId}
                        bulkPendingCount={bulkPendingCount}
                        bulkAlreadyImportedCount={bulkAlreadyImportedCount}
                        importAudio={importAudio}
                        setImportAudio={setImportAudio}
                        importImage={importImage}
                        setImportImage={setImportImage}
                        chrome={chrome}
                        ensureDefaultFormatIds={ensureDefaultFormatIds}
                        applyEpisode={applyEpisode}
                        setEpisodeIndex={setEpisodeIndex}
                    />
                ) : null}
            </>
        ),
        renderItemFields: (chrome) => {
            if (currentEpisode == null) {
                return null
            }
            return (
                <EpisodeItemFields
                    chrome={chrome}
                    currentEpisode={currentEpisode}
                    episodeTitle={episodeTitle}
                    setEpisodeTitle={setEpisodeTitle}
                    episodeSlug={episodeSlug}
                    setEpisodeSlug={setEpisodeSlug}
                    episodeDescription={episodeDescription}
                    setEpisodeDescription={setEpisodeDescription}
                    episodeNumber={episodeNumber}
                    setEpisodeNumber={setEpisodeNumber}
                    importAudio={importAudio}
                    setImportAudio={setImportAudio}
                    importImage={importImage}
                    setImportImage={setImportImage}
                    formats={formats}
                    episodeFormatIds={episodeFormatIds}
                    setEpisodeFormatIds={setEpisodeFormatIds}
                />
            )
        },
    }
}

function SeriesStep({
    preview,
    series,
    setSeries,
    seriesMode,
    setSeriesMode,
    selectedSeriesId,
    setSelectedSeriesId,
    seriesTitle,
    setSeriesTitle,
    seriesSlug,
    setSeriesSlug,
    seriesSlugDirty,
    setSeriesSlugDirty,
    seriesDescription,
    setSeriesDescription,
    seriesLanguage,
    setSeriesLanguage,
    seriesItunesCategory,
    setSeriesItunesCategory,
    importSeriesCover,
    setImportSeriesCover,
    setResolvedSeriesId,
    chrome,
}: {
    preview: RssImportPreview
    series: SeriesSummary[]
    setSeries: React.Dispatch<React.SetStateAction<SeriesSummary[]>>
    seriesMode: 'existing' | 'new'
    setSeriesMode: (mode: 'existing' | 'new') => void
    selectedSeriesId: number | null
    setSelectedSeriesId: (id: number | null) => void
    seriesTitle: string
    setSeriesTitle: (value: string) => void
    seriesSlug: string
    setSeriesSlug: (value: string) => void
    seriesSlugDirty: boolean
    setSeriesSlugDirty: (value: boolean) => void
    seriesDescription: string
    setSeriesDescription: (value: string) => void
    seriesLanguage: string
    setSeriesLanguage: (value: string) => void
    seriesItunesCategory: string
    setSeriesItunesCategory: (value: string) => void
    importSeriesCover: boolean
    setImportSeriesCover: (value: boolean) => void
    setResolvedSeriesId: (id: number | null) => void
    chrome: RssImportSharedChrome & {
        setStep: (step: string) => void
    }
}): React.JSX.Element {
    const {dict, busy, setBusy, setErrorMessage, setStreamProgress, authRedirect} = chrome

    async function handleSeriesContinue(): Promise<void> {
        setErrorMessage(null)
        setBusy(true)
        let unreferencedCoverAssetId: number | null = null
        let host: string | null = null
        try {
            if (seriesMode === 'existing') {
                if (selectedSeriesId == null) {
                    setErrorMessage('Bitte eine bestehende Sendung wählen.')
                    return
                }
                setResolvedSeriesId(selectedSeriesId)
                chrome.setStep('formats')
                return
            }
            host = getClientTenantHost()
            let coverAssetId: number | undefined
            if (importSeriesCover && preview.channel.imageUrl) {
                const cover = await ingestRemoteAssetWithProgress(
                    {
                        sourceUrl: preview.channel.imageUrl,
                        assetType: 'IMAGE',
                        visibility: 'PUBLIC',
                        filename: filenameFromImportUrl(
                            preview.channel.imageUrl,
                            'series-cover.jpg',
                            seriesSlug.trim() || suggestSlug(seriesTitle) || undefined,
                        ),
                    },
                    (progress) => {
                        setStreamProgress({label: 'Sendungs-Cover', progress})
                    },
                )
                coverAssetId = cover.id
                unreferencedCoverAssetId = cover.id
            }
            const created = await createSeries({
                slug: seriesSlug.trim() || suggestSlug(seriesTitle) || 'sendung',
                title: seriesTitle.trim() || 'Neue Sendung',
                description: seriesDescription,
                language: seriesLanguage.trim() || 'de',
                itunesCategory: seriesItunesCategory.trim() || undefined,
                coverAssetId,
            })
            setResolvedSeriesId(created.id)
            setSeries((current) => [...current, created])
            setSeriesMode('existing')
            setSelectedSeriesId(created.id)
            unreferencedCoverAssetId = null
            chrome.setStep('formats')
        } catch (error) {
            if (unreferencedCoverAssetId !== null && host !== null) {
                try {
                    await deleteMedia(unreferencedCoverAssetId)
                } catch {
                    // Keep the original series error. The asset remains visible
                    // in the media library so it can be reused or removed.
                }
            }
            if (authRedirect(error)) {
                return
            }
            setErrorMessage(
                error instanceof Error ? error.message : 'Sendung konnte nicht angelegt werden.',
            )
        } finally {
            setStreamProgress(null)
            setBusy(false)
        }
    }

    return (
        <section className="flex max-w-2xl flex-col gap-4">
            <SectionHeader
                title={dict.podcast.sendungFestlegen}
                description={`${preview.episodes.length} Folgen gefunden${preview.truncated ? ' (Liste gekürzt)' : ''}. Lege eine neue Sendung an oder hänge den Import an eine bestehende an.`}
            />
            <SelectControl
                aria-label="Sendungszuordnung"
                disabled={busy}
                onChange={(event) =>
                    setSeriesMode(event.target.value === 'existing' ? 'existing' : 'new')
                }
                value={seriesMode}
            >
                <option value="new">{dict.podcast.neueSendungAnlegen}</option>
                <option value="existing" disabled={series.length === 0}>
                    Bestehende Sendung verwenden
                </option>
            </SelectControl>
            {seriesMode === 'existing' ? (
                <SelectControl
                    aria-label="Bestehende Sendung"
                    disabled={busy}
                    onChange={(event) =>
                        setSelectedSeriesId(Number.parseInt(event.target.value, 10))
                    }
                    value={selectedSeriesId ?? ''}
                >
                    {series.map((item) => (
                        <option key={item.id} value={item.id}>
                            {item.title}
                        </option>
                    ))}
                </SelectControl>
            ) : (
                <div className="grid gap-3">
                    <label className="grid gap-1.5">
                        <span className="text-sm font-medium">Titel</span>
                        <Input
                            disabled={busy}
                            maxLength={255}
                            onChange={(event) => {
                                setSeriesTitle(event.target.value)
                                if (!seriesSlugDirty) {
                                    setSeriesSlug(suggestSlug(event.target.value))
                                }
                            }}
                            value={seriesTitle}
                        />
                    </label>
                    <label className="grid gap-1.5">
                        <span className="text-sm font-medium">Slug</span>
                        <Input
                            disabled={busy}
                            maxLength={64}
                            onChange={(event) => {
                                setSeriesSlug(event.target.value)
                                setSeriesSlugDirty(true)
                            }}
                            pattern={HTML_SLUG_PATTERN}
                            value={seriesSlug}
                        />
                    </label>
                    <label className="grid gap-1.5">
                        <span className="text-sm font-medium">Beschreibung</span>
                        <Textarea
                            disabled={busy}
                            onChange={(event) => setSeriesDescription(event.target.value)}
                            rows={4}
                            value={seriesDescription}
                        />
                    </label>
                    <label className="grid gap-1.5">
                        <span className="text-sm font-medium">Sprache</span>
                        <Input
                            disabled={busy}
                            maxLength={8}
                            onChange={(event) => setSeriesLanguage(event.target.value)}
                            value={seriesLanguage}
                        />
                    </label>
                    <label className="grid gap-1.5">
                        <span className="text-sm font-medium">iTunes-Kategorie</span>
                        <Input
                            disabled={busy}
                            maxLength={128}
                            onChange={(event) => setSeriesItunesCategory(event.target.value)}
                            value={seriesItunesCategory}
                        />
                    </label>
                    {preview.channel.imageUrl !== null ? (
                        <label className="flex items-center gap-2 text-sm">
                            <input
                                checked={importSeriesCover}
                                disabled={busy}
                                onChange={(event) => setImportSeriesCover(event.target.checked)}
                                type="checkbox"
                            />
                            Cover aus dem Feed nach S3 streamen
                        </label>
                    ) : null}
                </div>
            )}
            <div className="flex gap-2">
                <Button
                    disabled={busy}
                    onClick={() => {
                        setErrorMessage(null)
                        chrome.setStep('url')
                    }}
                    type="button"
                    variant="outline"
                >
                    Zurück
                </Button>
                <Button disabled={busy} onClick={() => void handleSeriesContinue()}>
                    {busy ? 'Wird gespeichert…' : 'Weiter zu Formaten'}
                </Button>
            </div>
        </section>
    )
}

function FormatsStep({
    preview,
    formats,
    defaultFormatIds,
    setDefaultFormatIds,
    newFormatName,
    setNewFormatName,
    canCreateFormats,
    resolvedSeriesId,
    bulkPendingCount,
    bulkAlreadyImportedCount,
    importAudio,
    setImportAudio,
    importImage,
    setImportImage,
    chrome,
    ensureDefaultFormatIds,
    applyEpisode,
    setEpisodeIndex,
}: {
    preview: RssImportPreview | null
    formats: FormatSummary[]
    defaultFormatIds: Set<number>
    setDefaultFormatIds: (ids: Set<number>) => void
    newFormatName: string
    setNewFormatName: (value: string) => void
    canCreateFormats: boolean
    resolvedSeriesId: number | null
    bulkPendingCount: number
    bulkAlreadyImportedCount: number
    importAudio: boolean
    setImportAudio: (value: boolean) => void
    importImage: boolean
    setImportImage: (value: boolean) => void
    chrome: RssImportSharedChrome & {
        setStep: (step: string) => void
        onBulkQueued: (result: {
            queuedCount: number
            alreadyImported: number
            notifyEmail: string
        }) => void
        finishWizard: () => void
    }
    ensureDefaultFormatIds: () => Promise<Set<number>>
    applyEpisode: (item: RssImportEpisodePreview, formatIds?: Set<number>) => void
    setEpisodeIndex: (index: number) => void
}): React.JSX.Element {
    const {dict, busy, setBusy, setErrorMessage, authRedirect} = chrome

    async function handleFormatsContinue(): Promise<void> {
        setErrorMessage(null)
        setBusy(true)
        try {
            const nextDefaultFormatIds = await ensureDefaultFormatIds()
            if (preview != null && preview.episodes.length > 0) {
                applyEpisode(preview.episodes[0], nextDefaultFormatIds)
                setEpisodeIndex(0)
                chrome.setAccessPolicy('FREE')
                chrome.setRequiredLevelSortOrder(null)
                chrome.setStep('episode')
            } else {
                chrome.finishWizard()
            }
        } catch (error) {
            if (authRedirect(error)) {
                return
            }
            setErrorMessage(
                error instanceof Error ? error.message : 'Format konnte nicht angelegt werden.',
            )
        } finally {
            setBusy(false)
        }
    }

    async function handleBulkImport(): Promise<void> {
        if (preview == null || resolvedSeriesId == null) {
            return
        }
        setErrorMessage(null)
        setBusy(true)
        try {
            const nextDefaultFormatIds = await ensureDefaultFormatIds()
            const queued = await bulkImportRss({
                feedUrl: preview.feedUrl,
                seriesId: resolvedSeriesId,
                formatIds: Array.from(nextDefaultFormatIds),
                accessPolicy: chrome.accessPolicy,
                requiredLevelSortOrder:
                    chrome.accessPolicy === 'PAID'
                        ? (chrome.requiredLevelSortOrder ?? undefined)
                        : undefined,
                importAudio,
                importImage,
            })
            chrome.onBulkQueued({
                queuedCount: queued.totalEpisodes - queued.alreadyImported,
                alreadyImported: queued.alreadyImported,
                notifyEmail: queued.notifyEmail,
            })
        } catch (error) {
            if (authRedirect(error)) {
                return
            }
            setErrorMessage(
                error instanceof Error
                    ? error.message
                    : 'Stapelimport konnte nicht gestartet werden.',
            )
        } finally {
            setBusy(false)
        }
    }

    return (
        <section className="flex max-w-2xl flex-col gap-4">
            <SectionHeader
                title={dict.podcast.formateZuordnen}
                description={dict.podcast.formateJederImportiertenFolgeAngehaengtKann}
            />
            {formats.length === 0 ? (
                <p className="text-sm text-muted-foreground">Noch keine Formate vorhanden.</p>
            ) : (
                <IdCheckboxList
                    items={formats}
                    selectedIds={defaultFormatIds}
                    onChange={setDefaultFormatIds}
                    disabled={busy}
                />
            )}
            <OptionalCreateNameField
                canCreate={canCreateFormats}
                label="Neues Format anlegen (optional)"
                placeholder={dict.podcast.zBHauptfolge}
                value={newFormatName}
                onChange={setNewFormatName}
                disabled={busy}
                adminOnlyHint="Neue Formate kann nur ein Tenant-Admin anlegen. Wähle vorhandene oder überspringe diesen Schritt."
            />
            <div className="flex gap-2">
                <Button
                    disabled={busy}
                    onClick={() => {
                        setErrorMessage(null)
                        chrome.setStep('series')
                    }}
                    type="button"
                    variant="outline"
                >
                    Zurück
                </Button>
                <Button disabled={busy} onClick={() => void handleFormatsContinue()}>
                    {busy ? 'Wird gespeichert…' : 'Weiter zu den Folgen'}
                </Button>
            </div>
            {preview !== null && resolvedSeriesId !== null && preview.episodes.length > 0 ? (
                <BulkImportPanel
                    pendingCount={bulkPendingCount}
                    alreadyImportedCount={bulkAlreadyImportedCount}
                    itemNounPlural="Folgen"
                    busy={busy}
                    disabled={false}
                    onBulkImport={() => void handleBulkImport()}
                >
                    <AccessPolicyFields
                        accessPolicy={chrome.accessPolicy}
                        onAccessPolicyChange={chrome.setAccessPolicy}
                        requiredLevelSortOrder={chrome.requiredLevelSortOrder}
                        onRequiredLevelChange={chrome.setRequiredLevelSortOrder}
                        disabled={busy}
                        ariaLabel={dict.podcast.zugriffAlleFolgen}
                        freeLabel={dict.write.allFree}
                        paidLabel={dict.write.allPaid}
                        levelLabel="Mindest-Stufe für alle"
                    />
                    <label className="flex items-center gap-2 text-sm">
                        <input
                            checked={importAudio}
                            disabled={busy}
                            onChange={(event) => setImportAudio(event.target.checked)}
                            type="checkbox"
                        />
                        MP3s nach S3 streamen
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                        <input
                            checked={importImage}
                            disabled={busy}
                            onChange={(event) => setImportImage(event.target.checked)}
                            type="checkbox"
                        />
                        Cover nach S3 streamen
                    </label>
                </BulkImportPanel>
            ) : null}
        </section>
    )
}

function EpisodeItemFields({
    chrome,
    currentEpisode,
    episodeTitle,
    setEpisodeTitle,
    episodeSlug,
    setEpisodeSlug,
    episodeDescription,
    setEpisodeDescription,
    episodeNumber,
    setEpisodeNumber,
    importAudio,
    setImportAudio,
    importImage,
    setImportImage,
    formats,
    episodeFormatIds,
    setEpisodeFormatIds,
}: {
    chrome: RssImportSharedChrome
    currentEpisode: RssImportEpisodePreview
    episodeTitle: string
    setEpisodeTitle: (value: string) => void
    episodeSlug: string
    setEpisodeSlug: (value: string) => void
    episodeDescription: string
    setEpisodeDescription: (value: string) => void
    episodeNumber: string
    setEpisodeNumber: (value: string) => void
    importAudio: boolean
    setImportAudio: (value: boolean) => void
    importImage: boolean
    setImportImage: (value: boolean) => void
    formats: FormatSummary[]
    episodeFormatIds: Set<number>
    setEpisodeFormatIds: (ids: Set<number>) => void
}): React.JSX.Element {
    const {busy, dict} = chrome
    return (
        <>
            {currentEpisode.imageUrl !== null ? (
                <p className="rounded-xl border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
                    Cover im Feed erkannt. Es wird beim Import serverseitig direkt nach S3
                    gestreamt.
                </p>
            ) : null}
            <label className="grid gap-1.5">
                <span className="text-sm font-medium">Titel</span>
                <Input
                    disabled={busy}
                    maxLength={255}
                    onChange={(event) => setEpisodeTitle(event.target.value)}
                    value={episodeTitle}
                />
            </label>
            <label className="grid gap-1.5">
                <span className="text-sm font-medium">Slug</span>
                <Input
                    disabled={busy}
                    maxLength={64}
                    onChange={(event) => setEpisodeSlug(event.target.value)}
                    pattern={HTML_SLUG_PATTERN}
                    value={episodeSlug}
                />
            </label>
            <label className="grid gap-1.5">
                <span className="text-sm font-medium">Shownotes</span>
                <Textarea
                    disabled={busy}
                    onChange={(event) => setEpisodeDescription(event.target.value)}
                    rows={6}
                    value={episodeDescription}
                />
            </label>
            <label className="grid gap-1.5">
                <span className="text-sm font-medium">Folgennummer</span>
                <Input
                    disabled={busy}
                    min={1}
                    onChange={(event) => setEpisodeNumber(event.target.value)}
                    step={1}
                    type="number"
                    value={episodeNumber}
                />
            </label>
            <AccessPolicyFields
                accessPolicy={chrome.accessPolicy}
                onAccessPolicyChange={chrome.setAccessPolicy}
                requiredLevelSortOrder={chrome.requiredLevelSortOrder}
                onRequiredLevelChange={chrome.setRequiredLevelSortOrder}
                disabled={busy}
                ariaLabel="Zugriff"
                freeLabel={dict.common.access.free}
                paidLabel={dict.common.access.paid}
                levelLabel="Mindest-Stufe"
                levelHint="Ohne Auswahl gilt die Standard-Stufe der Sendung."
            />
            <p className="text-sm text-muted-foreground">
                Audio: {currentEpisode.audioMimeType ?? 'unbekannt'},{' '}
                {formatBytes(currentEpisode.audioSizeBytes) ?? '—'},{' '}
                {formatDuration(currentEpisode.durationSeconds) ?? 'unbekannt'}
            </p>
            <label className="flex items-center gap-2 text-sm">
                <input
                    checked={importAudio}
                    disabled={busy || currentEpisode.audioUrl == null}
                    onChange={(event) => setImportAudio(event.target.checked)}
                    type="checkbox"
                />
                MP3 nach S3 streamen
            </label>
            <label className="flex items-center gap-2 text-sm">
                <input
                    checked={importImage}
                    disabled={busy || currentEpisode.imageUrl == null}
                    onChange={(event) => setImportImage(event.target.checked)}
                    type="checkbox"
                />
                Cover nach S3 streamen
            </label>
            {formats.length > 0 ? (
                <IdCheckboxList
                    items={formats}
                    selectedIds={episodeFormatIds}
                    onChange={setEpisodeFormatIds}
                    disabled={busy}
                />
            ) : null}
        </>
    )
}
