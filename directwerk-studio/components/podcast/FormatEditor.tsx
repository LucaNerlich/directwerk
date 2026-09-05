'use client'

import {HTML_SLUG_PATTERN} from '@directwerk/api/constants'
import {Button} from '@directwerk/ui/components/button'
import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {suggestSlug} from '@/lib/api/studioHelpers'
import {Textarea} from '@directwerk/ui/components/textarea'
import {Input} from '@directwerk/ui/components/input'
import PageHeader from '@directwerk/ui/components/page-header'
import PageStack from '@directwerk/ui/components/page-stack'
import SectionHeader from '@directwerk/ui/components/section-header'

import LevelSelect from '@/components/studio/LevelSelect'

import Link from 'next/link'
import Form from 'next/form'
import {useRouter} from 'next/navigation'
import {useActionState, useCallback, useEffect, useState} from 'react'

import MediaLibraryPicker from '@/components/media/MediaLibraryPicker'
import UploadProgress from '@/components/media/UploadProgress'
import {getMediaPreviewUrl} from '@/lib/api/mediaApi'
import {mediaLimitLabel} from '@/lib/media/limits'
import {useCoverImageUpload} from '@/lib/media/useCoverImageUpload'

import {createFormat, deactivateFormat, listFormats, updateFormat} from '@/lib/api/catalogApi'
import type {FormatSummary} from '@directwerk/api/types'
import {getClientTenantHost} from '@directwerk/api/tenant'
import {useAuthRequired} from '@directwerk/api/auth/useAuthRequired'

interface FormatEditorProps {
    formatId?: number
}

interface FormatFormState {
    error: string | null
    success: string | null
}

const INITIAL_STATE: FormatFormState = {error: null, success: null}

function parseOptionalInt(value: FormDataEntryValue | null): number | undefined {
    const text = String(value ?? '').trim()
    if (text.length === 0) {
        return undefined
    }
    const parsed = Number.parseInt(text, 10)
    return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : undefined
}

/**
 * Provides a form for creating a podcast format or editing an existing one.
 *
 * @param formatId - The identifier of the format to edit, or `undefined` to create a new format
 * @returns The format editor interface
 */
export default function FormatEditor({formatId}: FormatEditorProps): React.JSX.Element {
    const router = useRouter()
    const authRedirect = useAuthRequired()
    const isNew = formatId === undefined
    const [format, setFormat] = useState<FormatSummary | null>(null)
    const [requiredLevelSortOrder, setRequiredLevelSortOrder] = useState<number | null>(null)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(!isNew)
    const [isDeactivating, setIsDeactivating] = useState(false)
    const [deactivateError, setDeactivateError] = useState<string | null>(null)
    const [reloadToken, setReloadToken] = useState(0)
    const [coverAssetId, setCoverAssetId] = useState<number | null>(null)
    const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null)
    const [coverUploadError, setCoverUploadError] = useState<string | null>(null)

    useEffect(() => {
        if (formatId === undefined) {
            setIsLoading(false)
            return
        }
        setIsLoading(true)
        setLoadError(null)

        const resolvedId = formatId
        let active = true

        listFormats(getClientTenantHost())
            .then((formats) => {
                if (!active) {
                    return
                }
                const found = formats.find((item) => item.id === resolvedId)
                if (!found) {
                    setLoadError('Format wurde nicht gefunden.')
                    setIsLoading(false)
                    return
                }
                setFormat(found)
                setRequiredLevelSortOrder(found.requiredLevelSortOrder)
                setCoverAssetId(found.coverAssetId)
                setIsLoading(false)
            })
            .catch((error: unknown) => {
                if (!active) {
                    return
                }
                if (authRedirect(error)) return
                setLoadError(
                    error instanceof Error ? error.message : 'Format konnte nicht geladen werden.',
                )
                setIsLoading(false)
            })

        return () => {
            active = false
        }
    }, [formatId, reloadToken, router])

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
            .catch(() => {
                if (active) {
                    setCoverPreviewUrl(null)
                }
            })

        return () => {
            active = false
        }
    }, [coverAssetId])

    const coverUpload = useCoverImageUpload({
        onUploaded: setCoverAssetId,
        onError: (error) => {
            if (authRedirect(error)) return
            setCoverUploadError(
                error instanceof Error ? error.message : 'Cover-Upload fehlgeschlagen.',
            )
        },
    })

    const handleCoverUpload = useCallback(
        (file: File | null): Promise<void> => {
            setCoverUploadError(null)
            return coverUpload.upload(file)
        },
        [coverUpload],
    )

    async function saveAction(
        _previous: FormatFormState,
        formData: FormData,
    ): Promise<FormatFormState> {
        const name = String(formData.get('name') ?? '').trim()
        const slugInput = String(formData.get('slug') ?? '').trim()
        const description = String(formData.get('description') ?? '').trim()
        const requiredLevelSortOrder = parseOptionalInt(formData.get('requiredLevelSortOrder'))
        const sortOrder = parseOptionalInt(formData.get('sortOrder'))

        if (name.length === 0) {
            return {error: 'Name ist erforderlich.', success: null}
        }

        const host = getClientTenantHost()

        try {
            if (isNew) {
                const resolvedSlug = slugInput || suggestSlug(name) || 'format'
                const created = await createFormat(host, {
                    slug: resolvedSlug,
                    name,
                    description: description.length > 0 ? description : undefined,
                    requiredLevelSortOrder,
                    sortOrder,
                    coverAssetId: coverAssetId ?? undefined,
                })
                router.replace(`/podcast/formats/${created.id}`)
                return {error: null, success: `Format "${created.name}" angelegt.`}
            }

            const updated = await updateFormat(host, formatId, {
                name,
                description: description.length > 0 ? description : undefined,
                requiredLevelSortOrder,
                sortOrder,
                coverAssetId: coverAssetId ?? undefined,
            })
            setFormat(updated)
            setCoverAssetId(updated.coverAssetId)
            return {error: null, success: 'Format gespeichert.'}
        } catch (error) {
            if (authRedirect(error)) return INITIAL_STATE
            return {
                error: error instanceof Error ? error.message : 'Aktion fehlgeschlagen.',
                success: null,
            }
        }
    }

    const [state, formAction, pending] = useActionState(saveAction, INITIAL_STATE)

    async function handleDeactivate(): Promise<void> {
        if (formatId === undefined) {
            return
        }
        setIsDeactivating(true)
        setDeactivateError(null)
        try {
            const updated = await deactivateFormat(getClientTenantHost(), formatId)
            setFormat(updated)
        } catch (error) {
            if (authRedirect(error)) return
            setDeactivateError(
                error instanceof Error ? error.message : 'Deaktivierung fehlgeschlagen.',
            )
        } finally {
            setIsDeactivating(false)
        }
    }

    if (isLoading) {
        return <p>Laden…</p>
    }

    if (loadError) {
        return (
            <PageStack className="gap-6">
                <Alert variant="destructive">
                    <AlertDescription>{loadError}</AlertDescription>
                    <Button
                        className="mt-3"
                        onClick={() => setReloadToken((value) => value + 1)}
                        type="button"
                        variant="outline"
                    >
                        Erneut versuchen
                    </Button>
                </Alert>
                <p className="text-sm text-muted-foreground">
                    <Link href="/podcast/formats">Zurück zur Liste</Link>
                </p>
            </PageStack>
        )
    }

    return (
        <PageStack className="gap-6">
            <PageHeader
                actions={
                    <Button nativeButton={false} render={<Link href="/podcast/formats" />} variant="outline">
                        Zurück zur Liste
                    </Button>
                }
                description="Formate erscheinen beim Erstellen einer Folge als Auswahl. Das Titelbild wird als RSS-Fallback für Folgen dieses Formats genutzt."
                eyebrow="Podcast · Einrichtung"
                title={isNew ? 'Neues Format' : 'Format bearbeiten'}
            />

            {state.error ? (
                <Alert variant="destructive">
                    <AlertDescription>{state.error}</AlertDescription>
                </Alert>
            ) : null}
            {deactivateError ? (
                <Alert variant="destructive">
                    <AlertDescription>{deactivateError}</AlertDescription>
                </Alert>
            ) : null}
            {state.success ? (
                <p className="text-sm text-muted-foreground" role="status">{state.success}</p>
            ) : null}

            <Form action={formAction} className="grid w-full max-w-2xl gap-6">
                <section aria-labelledby="format-basics-heading" className="grid gap-4">
                    <SectionHeader
                        description="Name und URL-Kennung. Der Slug kann nach dem Anlegen nicht mehr geändert werden."
                        id="format-basics-heading"
                        title="Grundlagen"
                    />
                    <div className="grid gap-2">
                        <label className="text-sm font-medium" htmlFor="format-name">Name</label>
                        <Input
                            defaultValue={format?.name ?? ''}
                            id="format-name"
                            maxLength={255}
                            name="name"
                            required
                            type="text"
                        />
                    </div>
                    <div className="grid gap-2">
                        <label className="text-sm font-medium" htmlFor="format-slug">Slug</label>
                        <Input
                            defaultValue={format?.slug ?? ''}
                            disabled={!isNew}
                            id="format-slug"
                            maxLength={64}
                            name="slug"
                            pattern={HTML_SLUG_PATTERN}
                            required={isNew}
                            type="text"
                        />
                        <p className="text-xs text-muted-foreground">
                            Kleinbuchstaben, Zahlen und Bindestriche.
                            {isNew ? '' : ' Nach dem Anlegen gesperrt.'}
                        </p>
                    </div>
                    <div className="grid gap-2">
                        <label className="text-sm font-medium" htmlFor="format-description">Beschreibung</label>
                        <Textarea
                            defaultValue={format?.description ?? ''}
                            id="format-description"
                            name="description"
                            rows={4}
                        />
                        <p className="text-xs text-muted-foreground">
                            Optional. Hilft dir, Formate auseinanderzuhalten.
                        </p>
                    </div>
                </section>
                <section aria-labelledby="format-cover-heading" className="grid gap-2">
                    <SectionHeader
                        description="Fallback, wenn eine Folge kein eigenes Cover hat."
                        id="format-cover-heading"
                        title="Titelbild (RSS-Fallback)"
                    />
                    {coverPreviewUrl !== null ? (
                        <img alt="" className="block max-w-48 rounded-md" src={coverPreviewUrl} />
                    ) : null}
                    <Input
                        accept="image/png,image/jpeg,image/webp"
                        aria-label="Titelbild hochladen"
                        disabled={pending || coverUpload.isUploading}
                        onChange={(event) => {
                            const file = event.target.files?.[0] ?? null
                            void handleCoverUpload(file)
                            event.target.value = ''
                        }}
                        type="file"
                    />
                    <span className="text-xs text-muted-foreground">
                        Max. {mediaLimitLabel('IMAGE')}.
                    </span>
                    <MediaLibraryPicker
                        assetType="IMAGE"
                        disabled={pending || coverUpload.isUploading}
                        label="Titelbild aus Mediathek"
                        onAuthRequired={() => router.replace('/login')}
                        onSelect={(asset) => setCoverAssetId(asset.id)}
                        selectedId={coverAssetId}
                    />
                    {coverUpload.uploadProgress !== null ? (
                        <UploadProgress file={coverUpload.uploadProgress.file} progress={coverUpload.uploadProgress.progress} />
                    ) : null}
                    {coverUploadError !== null ? (
                        <p className="text-sm text-destructive" role="alert">
                            {coverUploadError}
                        </p>
                    ) : null}
                </section>
                <section aria-labelledby="format-access-heading" className="grid gap-4">
                    <SectionHeader
                        description="Wer darf Folgen dieses Formats hören? Kann pro Folge überschrieben werden."
                        id="format-access-heading"
                        title="Zugriff und Reihenfolge"
                    />
                    <div className="grid gap-2">
                        <label className="text-sm font-medium" htmlFor="format-required-level">Mindest-Stufe</label>
                        <LevelSelect
                            id="format-required-level"
                            onChange={setRequiredLevelSortOrder}
                            value={requiredLevelSortOrder}
                        />
                        <input
                            name="requiredLevelSortOrder"
                            type="hidden"
                            value={requiredLevelSortOrder ?? ''}
                        />
                        <span className="mt-1 block text-sm text-muted-foreground">
                            Niedrigste Stufe, die auf Folgen dieses Formats zugreifen darf.
                            Zugriff hat, wessen höchste Stufe ≥ Mindest-Stufe ist. „Öffentlich“ = jede aktive Stufe.
                        </span>
                    </div>
                    <div className="grid gap-2">
                        <label className="text-sm font-medium" htmlFor="format-sort-order">Anzeigereihenfolge in der Formatauswahl</label>
                        <Input
                            defaultValue={format?.sortOrder ?? ''}
                            id="format-sort-order"
                            min={0}
                            name="sortOrder"
                            type="number"
                        />
                        <span className="mt-1 block text-sm text-muted-foreground">
                            Legt fest, an welcher Position dieses Format in der Format-Auswahl beim
                            Erstellen einer Folge erscheint — hat nichts mit Zugriff zu tun.
                        </span>
                    </div>
                </section>
                <div className="flex flex-wrap gap-2">
                    <Button disabled={pending || coverUpload.isUploading} type="submit">
                        {pending ? 'Speichert…' : 'Speichern'}
                    </Button>
                    {!isNew && format?.active ? (
                        <Button
                            disabled={isDeactivating}
                            onClick={() => void handleDeactivate()}
                            type="button"
                            variant="outline"
                        >
                            {isDeactivating ? 'Deaktiviert…' : 'Deaktivieren'}
                        </Button>
                    ) : null}
                </div>
            </Form>
        </PageStack>
    )
}
