'use client'

import {HTML_SLUG_PATTERN} from '@directwerk/api/constants'
import SelectControl from '@/components/studio/SelectControl'
import {suggestSlug} from '@/lib/api/studioHelpers'
import LevelSelect from '@/components/studio/LevelSelect'

import {Button} from '@directwerk/ui/components/button'
import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Textarea} from '@directwerk/ui/components/textarea'
import {Input} from '@directwerk/ui/components/input'
import PageHeader from '@directwerk/ui/components/page-header'
import PageStack from '@directwerk/ui/components/page-stack'
import SectionHeader from '@directwerk/ui/components/section-header'

import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {useCallback, useEffect, useRef, useState} from 'react'

import MediaLibraryPicker from '@/components/media/MediaLibraryPicker'
import UploadProgress from '@/components/media/UploadProgress'
import PublicationStatusBadge from '@/components/publication/PublicationStatusBadge'
import PublishedLinksPanel from '@/components/publication/PublishedLinksPanel'
import {getMediaPreviewUrl} from '@/lib/api/mediaApi'
import {createSeries, getSeries, updateSeries} from '@/lib/api/podcastApi'
import type {
    CreateSeriesInput,
    SeriesDetail,
    SeriesStatus,
    UpdateSeriesInput,
} from '@directwerk/api/types'
import {mediaLimitLabel} from '@/lib/media/limits'
import {useCoverImageUpload} from '@/lib/media/useCoverImageUpload'
import {getClientTenantHost} from '@directwerk/api/tenant'
import {useAuthRequired} from '@directwerk/api/auth/useAuthRequired'
import {useResourceEditor} from '@/lib/hooks/useResourceEditor'

interface SeriesEditorProps {
    seriesId?: number
}

interface SeriesFormValues {
    title: string
    slug: string
    description: string
    language: string
    itunesCategory: string
    itunesExplicit: boolean
    status: SeriesStatus
    coverAssetId: number | null
    defaultRequiredLevelSortOrder: number | null
    rssUrl: string | null
    publishOnCreate: boolean
}

const INITIAL_VALUES: SeriesFormValues = {
    title: '',
    slug: '',
    description: '',
    language: 'de',
    itunesCategory: '',
    itunesExplicit: false,
    status: 'DRAFT',
    coverAssetId: null,
    defaultRequiredLevelSortOrder: null,
    rssUrl: null,
    publishOnCreate: false,
}

function toSeriesValues(series: SeriesDetail): SeriesFormValues {
    return {
        title: series.title,
        slug: series.slug,
        description: series.description ?? '',
        language: series.language ?? 'de',
        itunesCategory: series.itunesCategory ?? '',
        itunesExplicit: series.itunesExplicit,
        status: series.status,
        coverAssetId: series.coverAssetId,
        defaultRequiredLevelSortOrder: series.defaultRequiredLevelSortOrder,
        rssUrl: series.rssUrl,
        publishOnCreate: false,
    }
}

function seriesUpdatePayload(
    values: SeriesFormValues,
    status: SeriesStatus,
): UpdateSeriesInput {
    const resolvedSlug = values.slug.trim() || suggestSlug(values.title) || 'sendung'
    return {
        title: values.title.trim() || 'Ohne Titel',
        slug: resolvedSlug,
        description: values.description.trim() || undefined,
        language: values.language.trim() || 'de',
        itunesCategory: values.itunesCategory.trim() || undefined,
        itunesExplicit: values.itunesExplicit,
        coverAssetId: values.coverAssetId ?? undefined,
        defaultRequiredLevelSortOrder: values.defaultRequiredLevelSortOrder ?? undefined,
        status,
    }
}

function seriesCreatePayload(values: SeriesFormValues): CreateSeriesInput {
    const resolvedSlug = values.slug.trim() || suggestSlug(values.title) || 'sendung'
    return {
        title: values.title.trim() || 'Ohne Titel',
        slug: resolvedSlug,
        description: values.description.trim() || undefined,
        language: values.language.trim() || 'de',
        itunesCategory: values.itunesCategory.trim() || undefined,
        itunesExplicit: values.itunesExplicit,
        coverAssetId: values.coverAssetId ?? undefined,
        defaultRequiredLevelSortOrder: values.defaultRequiredLevelSortOrder ?? undefined,
    }
}

/**
 * Renders a form for creating or editing a podcast series.
 *
 * @param seriesId - The identifier of the series to edit; omit to create a new series.
 */
export default function SeriesEditor({seriesId}: SeriesEditorProps): React.JSX.Element {
    const router = useRouter()
    const authRedirect = useAuthRequired()
    const authRedirectRef = useRef(authRedirect)
    authRedirectRef.current = authRedirect

    const {
        values,
        setField,
        isNew,
        isLoading,
        loadError,
        reload,
        isSaving,
        errorMessage,
        reportError,
        handleSubmit,
        runAction,
        applyEntity,
        effectiveId,
        setErrorMessage,
    } = useResourceEditor<SeriesDetail, SeriesFormValues, CreateSeriesInput, UpdateSeriesInput>({
        id: seriesId,
        loadOne: getSeries,
        create: createSeries,
        update: updateSeries,
        initialValues: INITIAL_VALUES,
        toValues: toSeriesValues,
        buildCreate: seriesCreatePayload,
        buildUpdate: (current) => seriesUpdatePayload(current, current.status),
        redirectPath: (created) => `/podcast/series/${created.id}`,
        messages: {
            notFound: 'Sendung wurde nicht gefunden.',
            loadFailed: 'Sendung konnte nicht geladen werden.',
            saveFailed: 'Aktion fehlgeschlagen.',
            deactivateFailed: 'Deaktivierung fehlgeschlagen.',
        },
        afterCreate: async ({host, created, values: createdValues}) => {
            if (!createdValues.publishOnCreate) {
                return {ok: true}
            }
            try {
                await updateSeries(host, created.id, {
                    ...seriesUpdatePayload(createdValues, 'PUBLISHED'),
                    slug: created.slug,
                })
                return {ok: true}
            } catch (error) {
                return {
                    ok: false,
                    entity: created,
                    message:
                        error instanceof Error
                            ? error.message
                            : 'Veröffentlichung fehlgeschlagen.',
                }
            }
        },
    })

    const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null)

    useEffect(() => {
        let active = true

        if (values.coverAssetId === null) {
            setCoverPreviewUrl(null)
            return
        }

        getMediaPreviewUrl(getClientTenantHost(), values.coverAssetId)
            .then((url) => {
                if (active) {
                    setCoverPreviewUrl(url)
                }
            })
            .catch((error: unknown) => {
                if (!active) {
                    return
                }
                if (authRedirectRef.current(error)) return
                setCoverPreviewUrl(null)
            })

        return () => {
            active = false
        }
    }, [values.coverAssetId])

    const handleAuthRequired = useCallback(() => {
        router.replace('/login')
    }, [router])

    const handleCoverUploaded = useCallback(
        (assetId: number) => {
            setField('coverAssetId', assetId)
        },
        [setField],
    )

    const handleCoverError = useCallback(
        (error: unknown) => {
            reportError(error, 'Cover-Upload fehlgeschlagen.')
        },
        [reportError],
    )

    const coverUpload = useCoverImageUpload({
        onUploaded: handleCoverUploaded,
        onError: handleCoverError,
    })

    function handleCoverUpload(file: File | null): Promise<void> {
        setErrorMessage(null)
        return coverUpload.upload(file)
    }

    async function handlePublishSeries(): Promise<void> {
        if (effectiveId === undefined) {
            return
        }
        await runAction(
            async () => {
                const updated = await updateSeries(
                    getClientTenantHost(),
                    effectiveId,
                    seriesUpdatePayload(values, 'PUBLISHED'),
                )
                applyEntity(updated)
            },
            {failedMessage: 'Veröffentlichung fehlgeschlagen.'},
        )
    }

    if (isLoading) {
        return <p>Sendung wird geladen…</p>
    }

    if (loadError) {
        return (
            <PageStack className="gap-6">
                <Alert variant="destructive">
                    <AlertDescription>{loadError}</AlertDescription>
                    <Button
                        className="mt-3"
                        onClick={reload}
                        type="button"
                        variant="outline"
                    >
                        Erneut versuchen
                    </Button>
                </Alert>
                <p className="text-sm text-muted-foreground">
                    <Link href="/podcast/series">Zurück zur Übersicht</Link>
                </p>
            </PageStack>
        )
    }

    return (
        <PageStack className="gap-6">
            <PageHeader
                actions={
                    <Button nativeButton={false} render={<Link href="/podcast/series" />} variant="outline">
                        Zur Übersicht
                    </Button>
                }
                description="Titel, Cover und Feed-Metadaten. Einmal einrichten — der laufende Flow nutzt Folgen."
                eyebrow="Podcast · Einrichtung"
                title={isNew ? 'Neue Sendung' : 'Sendung bearbeiten'}
            />
            {!isNew ? (
                <div>
                    <PublicationStatusBadge status={values.status} />
                </div>
            ) : null}

            {errorMessage !== null && (
                <Alert variant="destructive">
                    <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
            )}

            <form className="grid w-full max-w-2xl gap-6" onSubmit={(event) => void handleSubmit(event)}>
                <section aria-labelledby="series-basics-heading" className="grid gap-4">
                    <SectionHeader
                        description="So sehen Hörer deine Sendung in Apps und Verzeichnissen."
                        id="series-basics-heading"
                        title="Grundlagen"
                    />
                    <label className="grid gap-2 text-sm font-medium" htmlFor="series-title">
                        <span>Titel</span>
                    </label>
                    <Input
                        id="series-title"
                        value={values.title}
                        onChange={(event) => {
                            const value = event.target.value
                            setField('title', value)
                            if (isNew && values.slug.trim().length === 0) {
                                setField('slug', suggestSlug(value))
                            }
                        }}
                        required
                        maxLength={255}
                    />
                    <div className="grid gap-2">
                        <label className="grid gap-2 text-sm font-medium" htmlFor="series-slug">
                            <span>Slug</span>
                        </label>
                        <Input
                            id="series-slug"
                            value={values.slug}
                            onChange={(event) => setField('slug', event.target.value)}
                            required
                            pattern={HTML_SLUG_PATTERN}
                            maxLength={63}
                        />
                        <p className="text-xs font-normal text-muted-foreground">
                            Kleinbuchstaben, Zahlen und Bindestriche. Wird in Feed-URL und Links verwendet.
                        </p>
                    </div>
                    <label className="grid gap-2 text-sm font-medium" htmlFor="series-description">
                        <span>Beschreibung</span>
                        <Textarea
                            id="series-description"
                            rows={6}
                            value={values.description}
                            onChange={(event) => setField('description', event.target.value)}
                        />
                        <span className="text-xs font-normal text-muted-foreground">
                            Kurzbeschreibung für Podcast-Apps und Verzeichnisse.
                        </span>
                    </label>
                    <label className="grid gap-2 text-sm font-medium" htmlFor="series-language">
                        <span>Sprache</span>
                        <Input
                            id="series-language"
                            value={values.language}
                            onChange={(event) => setField('language', event.target.value)}
                            maxLength={8}
                            required
                        />
                        <span className="text-xs font-normal text-muted-foreground">
                            ISO-Code, z. B. „de“ oder „en“.
                        </span>
                    </label>
                </section>
                <section aria-labelledby="series-feed-heading" className="grid gap-4">
                    <SectionHeader
                        description="Apple & Co. lesen diese Angaben aus dem RSS-Feed."
                        id="series-feed-heading"
                        title="Feed-Details"
                    />
                    <label className="grid gap-2 text-sm font-medium" htmlFor="series-itunes-category">
                        <span>iTunes-Kategorie</span>
                        <Input
                            id="series-itunes-category"
                            value={values.itunesCategory}
                            onChange={(event) => setField('itunesCategory', event.target.value)}
                            maxLength={128}
                        />
                        <span className="font-normal text-muted-foreground">
                            Apple-Podcast-Kategorie des Feeds (z. B. Comedy, News).
                        </span>
                    </label>
                    <label className="grid gap-2 text-sm font-medium" htmlFor="series-explicit">
                        <span>Explicit-Inhalte</span>
                        <SelectControl
                            id="series-explicit"
                            value={values.itunesExplicit ? 'true' : 'false'}
                            onChange={(event) => setField('itunesExplicit', event.target.value === 'true')}
                        >
                            <option value="false">Nein (clean)</option>
                            <option value="true">Ja (explicit)</option>
                        </SelectControl>
                        <span className="font-normal text-muted-foreground">
                            Apple verlangt diese Angabe im Feed. Nur auf „Ja“ stellen, wenn die
                            Sendung explizite Inhalte enthält.
                        </span>
                    </label>
                </section>
                <section aria-labelledby="series-cover-heading" className="grid gap-2">
                    <SectionHeader
                        description="Quadratisch, mindestens 1400 × 1400 px empfohlen."
                        id="series-cover-heading"
                        title="Titelbild"
                    />
                    {coverPreviewUrl !== null ? (
                        <img
                            alt=""
                            className="block max-w-48 rounded-md"
                            src={coverPreviewUrl}
                        />
                    ) : null}
                    <Input
                        accept="image/png,image/jpeg,image/webp"
                        aria-label="Titelbild hochladen"
                        disabled={coverUpload.isUploading}
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
                    <MediaLibraryPicker
                        assetType="IMAGE"
                        disabled={coverUpload.isUploading || isSaving}
                        label="Titelbild aus Mediathek"
                        onAuthRequired={handleAuthRequired}
                        onSelect={(asset) => {
                            setField('coverAssetId', asset.id)
                        }}
                        selectedId={values.coverAssetId}
                    />
                    {coverUpload.uploadProgress !== null ? (
                        <UploadProgress
                            file={coverUpload.uploadProgress.file}
                            progress={coverUpload.uploadProgress.progress}
                        />
                    ) : null}
                </section>
                <section aria-labelledby="series-access-heading" className="grid gap-2">
                    <SectionHeader
                        description="Standard für neue Folgen dieser Sendung. Kann pro Folge überschrieben werden."
                        id="series-access-heading"
                        title="Zugriff"
                    />
                    <label className="grid gap-2 text-sm font-medium">
                        <span>Mindest-Stufe für Folgen (Standard)</span>
                        <LevelSelect
                            onChange={(value) => setField('defaultRequiredLevelSortOrder', value)}
                            value={values.defaultRequiredLevelSortOrder}
                        />
                        <span className="font-normal text-muted-foreground">
                            Standard-Mindest-Stufe für neue Folgen dieser Sendung. Zugriff hat,
                            wessen höchste Stufe ≥ Mindest-Stufe ist. „Öffentlich“ = jede aktive
                            Stufe.
                        </span>
                    </label>
                </section>
                <section aria-labelledby="series-publish-heading" className="grid gap-3">
                    <SectionHeader
                        description={isNew ? 'Anlegen und optional sofort veröffentlichen.' : 'Speichern, Status wechseln und Feed prüfen.'}
                        id="series-publish-heading"
                        title="Veröffentlichung"
                    />
                    {values.rssUrl !== null ? (
                        <PublishedLinksPanel
                            title="RSS-Feed"
                            links={[{label: 'Sendungs-Feed', url: values.rssUrl}]}
                            hint="Direkt nach dem Veröffentlichen kann der Feed noch 404 liefern, bis der Snapshot geschrieben ist."
                        />
                    ) : values.status === 'DRAFT' ? (
                        <p className="text-sm text-muted-foreground">
                            Der öffentliche Feed erscheint, sobald die Sendung
                            veröffentlicht ist.
                        </p>
                    ) : null}
                    {isNew ? (
                        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                            <Input
                                checked={values.publishOnCreate}
                                className="size-4 shrink-0"
                                onChange={(event) => setField('publishOnCreate', event.target.checked)}
                                type="checkbox"
                            />
                            Sendung sofort veröffentlichen
                        </label>
                    ) : (
                        <>
                            {values.status === 'DRAFT' ? (
                                <div>
                                    <Button
                                        disabled={isSaving}
                                        onClick={() => void handlePublishSeries()}
                                        type="button"
                                    >
                                        {isSaving ? 'Speichert…' : 'Sendung veröffentlichen'}
                                    </Button>
                                </div>
                            ) : null}
                            <label className="grid gap-2 text-sm font-medium">
                                <span>Status</span>
                                <SelectControl
                                    value={values.status}
                                    onChange={(event) =>
                                        setField('status', event.target.value as SeriesStatus)
                                    }
                                >
                                    <option value="DRAFT">Entwurf</option>
                                    <option value="PUBLISHED">Veröffentlicht</option>
                                </SelectControl>
                            </label>
                        </>
                    )}
                    <div>
                        <Button type="submit" disabled={isSaving || coverUpload.isUploading}>
                            {isSaving ? 'Speichert…' : isNew ? 'Sendung anlegen' : 'Speichern'}
                        </Button>
                    </div>
                </section>
            </form>
        </PageStack>
    )
}
