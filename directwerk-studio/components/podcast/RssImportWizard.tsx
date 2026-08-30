'use client'

import Link from 'next/link'
import {useEffect, useRef, useState} from 'react'

import {Button} from '@directwerk/ui/components/button'
import {Input} from '@directwerk/ui/components/input'
import {Textarea} from '@directwerk/ui/components/textarea'
import PageHeader from '@directwerk/ui/components/page-header'
import SectionHeader from '@directwerk/ui/components/section-header'

import SelectControl from '@/components/studio/SelectControl'
import LevelSelect from '@/components/studio/LevelSelect'
import {createFormat, listFormats} from '@/lib/api/catalogApi'
import {createSeries, listSeries} from '@/lib/api/podcastApi'
import {ingestRemoteAsset, importRssEpisode, previewRssFeed} from '@/lib/api/podcastImportApi'
import {deleteMedia} from '@/lib/api/mediaApi'
import {isTenantAdminRole, suggestSlug} from '@/lib/api/studioHelpers'
import {useOptionalMe} from '@/lib/auth/MeProvider'
import {HTML_SLUG_PATTERN} from '@directwerk/api/constants'
import type {
    AccessPolicy,
    FormatSummary,
    RssImportEpisodePreview,
    RssImportPreview,
    SeriesSummary,
} from '@directwerk/api/types'
import {getClientTenantHost} from '@directwerk/api/tenant'
import {useAuthRequired} from '@directwerk/api/auth/useAuthRequired'

type WizardStep = 'url' | 'series' | 'formats' | 'episode' | 'done'

/**
 * Formats a duration in seconds as a human-readable time string.
 *
 * @param seconds - The duration in seconds.
 * @returns The duration formatted as `M:SS` or `H:MM:SS`, or `unbekannt` when the duration is unavailable or not positive.
 */
function formatDuration(seconds: number | null): string {
    if (seconds === null || seconds <= 0) {
        return 'unbekannt'
    }
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const rest = seconds % 60
    if (hours > 0) {
        return `${hours}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
    }
    return `${minutes}:${String(rest).padStart(2, '0')}`
}

/**
 * Formats a positive byte count as kilobytes or megabytes.
 *
 * @param bytes - The byte count to format
 * @returns The formatted size, or `Größe unbekannt` when the value is missing or not positive
 */
function formatBytes(bytes: number | null): string {
    if (bytes === null || bytes <= 0) {
        return 'Größe unbekannt'
    }
    if (bytes < 1024 * 1024) {
        return `${Math.round(bytes / 1024)} KB`
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Guides users through importing a public RSS podcast feed, including series selection, format assignment, and episode metadata and media import.
 */
export default function RssImportWizard(): React.JSX.Element {
    const authRedirect = useAuthRequired()
    const authRedirectRef = useRef(authRedirect)
    authRedirectRef.current = authRedirect
    const me = useOptionalMe()
    const canCreateFormats = me !== null && isTenantAdminRole(me.roles)
    const [step, setStep] = useState<WizardStep>('url')
    const [feedUrl, setFeedUrl] = useState('')
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
    const [accessPolicy, setAccessPolicy] = useState<AccessPolicy>('FREE')
    const [requiredLevelSortOrder, setRequiredLevelSortOrder] = useState<number | null>(null)
    const [importAudio, setImportAudio] = useState(true)
    const [importImage, setImportImage] = useState(true)
    const [importedCount, setImportedCount] = useState(0)
    const [skippedCount, setSkippedCount] = useState(0)
    const [alreadyImportedCount, setAlreadyImportedCount] = useState(0)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [busy, setBusy] = useState(false)
    const [prerequisitesStatus, setPrerequisitesStatus] = useState<
        'loading' | 'ready' | 'error'
    >('loading')
    const [prerequisitesError, setPrerequisitesError] = useState<string | null>(null)
    const [prerequisitesReload, setPrerequisitesReload] = useState(0)

    useEffect(() => {
        let active = true
        setPrerequisitesStatus('loading')
        setPrerequisitesError(null)
        Promise.all([listSeries(getClientTenantHost()), listFormats(getClientTenantHost())])
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
                    error instanceof Error ? error.message : 'Sendungen konnten nicht geladen werden.',
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
        setAccessPolicy('FREE')
        setRequiredLevelSortOrder(null)
        setEpisodeFormatIds(new Set(formatIds))
    }

    async function handlePreview(): Promise<void> {
        setErrorMessage(null)
        setBusy(true)
        try {
            const loaded = await previewRssFeed(getClientTenantHost(), feedUrl.trim())
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
            setStep('series')
        } catch (error) {
            if (authRedirect(error)) {
                return
            }
            setErrorMessage(error instanceof Error ? error.message : 'Der Feed konnte nicht gelesen werden.')
        } finally {
            setBusy(false)
        }
    }

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
                setStep('formats')
                return
            }
            host = getClientTenantHost()
            let coverAssetId: number | undefined
            if (importSeriesCover && preview?.channel.imageUrl) {
                const cover = await ingestRemoteAsset(host, {
                    sourceUrl: preview.channel.imageUrl,
                    assetType: 'IMAGE',
                    visibility: 'PUBLIC',
                    filename: 'series-cover.jpg',
                })
                coverAssetId = cover.id
                unreferencedCoverAssetId = cover.id
            }
            const created = await createSeries(host, {
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
            setStep('formats')
        } catch (error) {
            if (unreferencedCoverAssetId !== null && host !== null) {
                try {
                    await deleteMedia(host, unreferencedCoverAssetId)
                } catch {
                    // Keep the original series error. The asset remains visible
                    // in the media library so it can be reused or removed.
                }
            }
            if (authRedirect(error)) {
                return
            }
            setErrorMessage(error instanceof Error ? error.message : 'Sendung konnte nicht angelegt werden.')
        } finally {
            setBusy(false)
        }
    }

    async function handleFormatsContinue(): Promise<void> {
        setErrorMessage(null)
        setBusy(true)
        try {
            const nextDefaultFormatIds = new Set(defaultFormatIds)
            const name = canCreateFormats ? newFormatName.trim() : ''
            if (name.length > 0) {
                const created = await createFormat(getClientTenantHost(), {
                    slug: suggestSlug(name) || 'format',
                    name,
                })
                setFormats((current) => [...current, created])
                nextDefaultFormatIds.add(created.id)
                setDefaultFormatIds(nextDefaultFormatIds)
                setNewFormatName('')
            }
            if (preview != null && preview.episodes.length > 0) {
                applyEpisode(preview.episodes[0], nextDefaultFormatIds)
                setEpisodeIndex(0)
                setStep('episode')
            } else {
                setStep('done')
            }
        } catch (error) {
            if (authRedirect(error)) {
                return
            }
            setErrorMessage(error instanceof Error ? error.message : 'Format konnte nicht angelegt werden.')
        } finally {
            setBusy(false)
        }
    }

    function goToEpisode(nextIndex: number): void {
        if (preview == null || nextIndex >= preview.episodes.length) {
            setStep('done')
            return
        }
        applyEpisode(preview.episodes[nextIndex])
        setEpisodeIndex(nextIndex)
        setStep('episode')
    }

    async function handleImportEpisode(): Promise<void> {
        if (preview == null || resolvedSeriesId == null) {
            return
        }
        const item = preview.episodes[episodeIndex]
        setErrorMessage(null)
        setBusy(true)
        try {
            const parsedNumber = Number.parseInt(episodeNumber, 10)
            const result = await importRssEpisode(getClientTenantHost(), {
                seriesId: resolvedSeriesId,
                feedUrl: preview.feedUrl,
                guid: item.guid,
                slug: episodeSlug.trim() || item.suggestedSlug,
                title: episodeTitle.trim() || item.title,
                description: episodeDescription,
                episodeNumber: Number.isSafeInteger(parsedNumber) && parsedNumber >= 1 ? parsedNumber : undefined,
                durationSeconds: item.durationSeconds ?? undefined,
                accessPolicy,
                requiredLevelSortOrder:
                    accessPolicy === 'PAID' ? (requiredLevelSortOrder ?? undefined) : undefined,
                formatIds: Array.from(episodeFormatIds),
                audioUrl: importAudio ? (item.audioUrl ?? undefined) : undefined,
                imageUrl: importImage ? (item.imageUrl ?? undefined) : undefined,
            })
            if (result.alreadyImported) {
                setAlreadyImportedCount((count) => count + 1)
            } else {
                setImportedCount((count) => count + 1)
            }
            goToEpisode(episodeIndex + 1)
        } catch (error) {
            if (authRedirect(error)) {
                return
            }
            setErrorMessage(error instanceof Error ? error.message : 'Folge konnte nicht importiert werden.')
        } finally {
            setBusy(false)
        }
    }

    function handleSkipEpisode(): void {
        const item = preview?.episodes[episodeIndex]
        if (item?.alreadyImportedEpisodeId != null) {
            setAlreadyImportedCount((count) => count + 1)
        } else {
            setSkippedCount((count) => count + 1)
        }
        goToEpisode(episodeIndex + 1)
    }

    function resetWizard(): void {
        setStep('url')
        setFeedUrl('')
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
        setAccessPolicy('FREE')
        setRequiredLevelSortOrder(null)
        setImportAudio(true)
        setImportImage(true)
        setImportedCount(0)
        setSkippedCount(0)
        setAlreadyImportedCount(0)
        setErrorMessage(null)
        setBusy(false)
    }

    const currentEpisode = preview?.episodes[episodeIndex] ?? null
    const remaining = preview == null ? 0 : preview.episodes.length - episodeIndex

    return (
        <div className="flex flex-col gap-8">
            <PageHeader
                eyebrow="Podcast"
                title="RSS-Import"
                description="Bestehenden Feed Schritt für Schritt übernehmen: zuerst Sendung und Formate, dann jede Folge einzeln. Audio und Cover werden direkt nach S3 gestreamt."
            />

            <ol className="flex flex-wrap gap-2 text-xs font-medium text-muted-foreground">
                {[
                    ['url', '1. Feed'],
                    ['series', '2. Sendung'],
                    ['formats', '3. Formate'],
                    ['episode', '4. Folgen'],
                    ['done', '5. Fertig'],
                ].map(([id, label]) => (
                    <li
                        aria-current={step === id ? 'step' : undefined}
                        key={id}
                        className={
                            step === id
                                ? 'rounded-full bg-primary px-2.5 py-1 text-primary-foreground'
                                : 'rounded-full bg-muted px-2.5 py-1'
                        }
                    >
                        {label}
                    </li>
                ))}
            </ol>
            <p aria-live="polite" className="sr-only">
                Aktueller Schritt:{' '}
                {step === 'url'
                    ? 'Feed'
                    : step === 'series'
                      ? 'Sendung'
                      : step === 'formats'
                        ? 'Formate'
                        : step === 'episode'
                          ? `Folge ${episodeIndex + 1}`
                          : 'Fertig'}
            </p>

            {errorMessage !== null ? (
                <p className="text-sm text-destructive" role="alert">
                    {errorMessage}
                </p>
            ) : null}

            {step === 'url' ? (
                <section className="flex max-w-2xl flex-col gap-4">
                    <SectionHeader
                        title="Feed-Adresse"
                        description="Öffentliche RSS-URL deines bisherigen Hosters. Wir lesen nur die Metadaten — noch keine MP3s."
                    />
                    <label className="grid gap-1.5">
                        <span className="text-sm font-medium">RSS-URL</span>
                        <Input
                            disabled={busy || prerequisitesStatus !== 'ready'}
                            maxLength={2048}
                            onChange={(event) => setFeedUrl(event.target.value)}
                            placeholder="https://example.com/podcast.xml"
                            type="url"
                            value={feedUrl}
                        />
                    </label>
                    {prerequisitesStatus === 'loading' ? (
                        <p className="text-sm text-muted-foreground" role="status">
                            Sendungen und Formate werden geladen…
                        </p>
                    ) : null}
                    {prerequisitesStatus === 'error' ? (
                        <div className="grid gap-2">
                            <p className="text-sm text-destructive" role="alert">
                                {prerequisitesError}
                            </p>
                            <Button
                                onClick={() => setPrerequisitesReload((value) => value + 1)}
                                type="button"
                                variant="outline"
                            >
                                Erneut laden
                            </Button>
                        </div>
                    ) : null}
                    <Button
                        disabled={
                            busy ||
                            prerequisitesStatus !== 'ready' ||
                            feedUrl.trim().length === 0
                        }
                        onClick={() => void handlePreview()}
                    >
                        {busy ? 'Feed wird gelesen…' : 'Feed laden'}
                    </Button>
                </section>
            ) : null}

            {step === 'series' && preview !== null ? (
                <section className="flex max-w-2xl flex-col gap-4">
                    <SectionHeader
                        title="Sendung festlegen"
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
                        <option value="new">Neue Sendung anlegen</option>
                        <option value="existing" disabled={series.length === 0}>
                            Bestehende Sendung verwenden
                        </option>
                    </SelectControl>
                    {seriesMode === 'existing' ? (
                        <SelectControl
                            aria-label="Bestehende Sendung"
                            disabled={busy}
                            onChange={(event) => setSelectedSeriesId(Number.parseInt(event.target.value, 10))}
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
                        <Button disabled={busy} onClick={() => setStep('url')} type="button" variant="outline">
                            Zurück
                        </Button>
                        <Button disabled={busy} onClick={() => void handleSeriesContinue()}>
                            {busy ? 'Wird gespeichert…' : 'Weiter zu Formaten'}
                        </Button>
                    </div>
                </section>
            ) : null}

            {step === 'formats' ? (
                <section className="flex max-w-2xl flex-col gap-4">
                    <SectionHeader
                        title="Formate zuordnen"
                        description="Diese Formate werden jeder importierten Folge angehängt. Du kannst sie pro Folge noch ändern."
                    />
                    {formats.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Noch keine Formate vorhanden.</p>
                    ) : (
                        <ul className="grid gap-2">
                            {formats.map((format) => (
                                <li key={format.id}>
                                    <label className="flex items-center gap-2 text-sm">
                                        <input
                                            checked={defaultFormatIds.has(format.id)}
                                            disabled={busy}
                                            onChange={(event) => {
                                                const next = new Set(defaultFormatIds)
                                                if (event.target.checked) {
                                                    next.add(format.id)
                                                } else {
                                                    next.delete(format.id)
                                                }
                                                setDefaultFormatIds(next)
                                            }}
                                            type="checkbox"
                                        />
                                        {format.name}
                                    </label>
                                </li>
                            ))}
                        </ul>
                    )}
                    {canCreateFormats ? (
                        <label className="grid gap-1.5">
                            <span className="text-sm font-medium">Neues Format anlegen (optional)</span>
                            <Input
                                disabled={busy}
                                maxLength={255}
                                onChange={(event) => setNewFormatName(event.target.value)}
                                placeholder="z. B. Hauptfolge"
                                value={newFormatName}
                            />
                        </label>
                    ) : (
                        <p className="text-sm text-muted-foreground">
                            Neue Formate kann nur ein Tenant-Admin anlegen. Wähle vorhandene oder überspringe
                            diesen Schritt.
                        </p>
                    )}
                    <div className="flex gap-2">
                        <Button disabled={busy} onClick={() => setStep('series')} type="button" variant="outline">
                            Zurück
                        </Button>
                        <Button disabled={busy} onClick={() => void handleFormatsContinue()}>
                            {busy ? 'Wird gespeichert…' : 'Weiter zu den Folgen'}
                        </Button>
                    </div>
                </section>
            ) : null}

            {step === 'episode' && currentEpisode !== null && preview !== null ? (
                <section className="flex max-w-2xl flex-col gap-4">
                    <SectionHeader
                        title={`Folge ${episodeIndex + 1} von ${preview.episodes.length}`}
                        description={`${remaining} noch offen. Jede Folge wird einzeln nach S3 gestreamt — nicht über den Browser hochgeladen.`}
                    />
                    {currentEpisode.alreadyImportedEpisodeId !== null ? (
                        <p className="rounded-xl border bg-muted/40 px-4 py-3 text-sm">
                            Diese Folge wurde bereits importiert.{' '}
                            <Link href={`/podcast/episodes/${currentEpisode.alreadyImportedEpisodeId}`}>
                                Öffnen
                            </Link>
                        </p>
                    ) : null}
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
                    <SelectControl
                        aria-label="Zugriff"
                        disabled={busy}
                        onChange={(event) =>
                            setAccessPolicy(event.target.value === 'PAID' ? 'PAID' : 'FREE')
                        }
                        value={accessPolicy}
                    >
                        <option value="FREE">Frei</option>
                        <option value="PAID">Bezahlt</option>
                    </SelectControl>
                    {accessPolicy === 'PAID' ? (
                        <label className="grid gap-1.5">
                            <span className="text-sm font-medium">Mindest-Stufe</span>
                            <LevelSelect
                                disabled={busy}
                                onChange={setRequiredLevelSortOrder}
                                value={requiredLevelSortOrder}
                            />
                            <span className="text-xs text-muted-foreground">
                                Ohne Auswahl gilt die Standard-Stufe der Sendung.
                            </span>
                        </label>
                    ) : null}
                    <p className="text-sm text-muted-foreground">
                        Audio: {currentEpisode.audioMimeType ?? 'unbekannt'}, {formatBytes(currentEpisode.audioSizeBytes)},{' '}
                        {formatDuration(currentEpisode.durationSeconds)}
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
                        <ul className="grid gap-2">
                            {formats.map((format) => (
                                <li key={format.id}>
                                    <label className="flex items-center gap-2 text-sm">
                                        <input
                                            checked={episodeFormatIds.has(format.id)}
                                            disabled={busy}
                                            onChange={(event) => {
                                                const next = new Set(episodeFormatIds)
                                                if (event.target.checked) {
                                                    next.add(format.id)
                                                } else {
                                                    next.delete(format.id)
                                                }
                                                setEpisodeFormatIds(next)
                                            }}
                                            type="checkbox"
                                        />
                                        {format.name}
                                    </label>
                                </li>
                            ))}
                        </ul>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                        {episodeIndex === 0 ? (
                            <Button
                                disabled={busy}
                                onClick={() => setStep('formats')}
                                type="button"
                                variant="outline"
                            >
                                Zurück zu Formaten
                            </Button>
                        ) : null}
                        <Button
                            disabled={busy || currentEpisode.alreadyImportedEpisodeId !== null}
                            onClick={() => void handleImportEpisode()}
                        >
                            {busy ? 'Wird nach S3 gestreamt…' : 'Diese Folge importieren'}
                        </Button>
                        <Button disabled={busy} onClick={handleSkipEpisode} type="button" variant="outline">
                            {currentEpisode.alreadyImportedEpisodeId !== null ? 'Weiter' : 'Überspringen'}
                        </Button>
                    </div>
                </section>
            ) : null}

            {step === 'done' ? (
                <section className="flex max-w-2xl flex-col gap-4">
                    <SectionHeader
                        title="Import abgeschlossen"
                        description={`${importedCount} Folgen importiert, ${alreadyImportedCount} bereits vorhanden, ${skippedCount} übersprungen. Entwürfe kannst du jetzt prüfen und veröffentlichen.`}
                    />
                    <div className="flex flex-wrap gap-2">
                        <Button nativeButton={false} render={<Link href="/podcast/episodes" />}>
                            Zur Folgenliste
                        </Button>
                        <Button onClick={resetWizard} type="button" variant="outline">
                            Weiteren Feed importieren
                        </Button>
                    </div>
                </section>
            ) : null}
        </div>
    )
}
