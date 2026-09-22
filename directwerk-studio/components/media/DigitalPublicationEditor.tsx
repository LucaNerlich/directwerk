'use client'

import {HTML_SLUG_PATTERN} from '@directwerk/api/constants'
import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Button} from '@directwerk/ui/components/button'
import EmptyState from '@directwerk/ui/components/empty-state'
import {Input} from '@directwerk/ui/components/input'
import {Label} from '@directwerk/ui/components/label'
import PageHeader from '@directwerk/ui/components/page-header'
import PageStack from '@directwerk/ui/components/page-stack'
import SectionHeader from '@directwerk/ui/components/section-header'
import {Skeleton} from '@directwerk/ui/components/skeleton'
import {Textarea} from '@directwerk/ui/components/textarea'
import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {useEffect, useState} from 'react'

import MediaLibraryPicker from '@/components/media/MediaLibraryPicker'
import PublicationStatusBadge from '@/components/publication/PublicationStatusBadge'
import LevelSelect from '@/components/studio/LevelSelect'
import SelectControl from '@/components/studio/SelectControl'
import {
    archiveDigitalPublication,
    createDigitalPublication,
    deleteDigitalPublication,
    getDigitalPublication,
    publishDigitalPublication,
    unarchiveDigitalPublication,
    unpublishDigitalPublication,
    updateDigitalPublication,
} from '@/lib/api/digitalPublicationsApi'
import {hasModule} from '@/lib/api/client'
import {suggestSlug} from '@/lib/api/studioHelpers'
import {useDeskAccess} from '@/lib/rbac/useDeskAccess'
import {useSiteConfig} from '@/lib/site/SiteConfigProvider'
import type {
    AccessPolicy,
    CreateDigitalPublicationInput,
    DigitalPublication,
    UpdateDigitalPublicationInput,
} from '@directwerk/api/types'
import {getClientTenantHost} from '@directwerk/api/tenant'
import {useAuthRequired} from '@directwerk/api/auth/useAuthRequired'

interface DigitalPublicationEditorProps {
    publicationId?: number
}

export default function DigitalPublicationEditor({
    publicationId,
}: DigitalPublicationEditorProps): React.JSX.Element {
    const router = useRouter()
    const authRedirect = useAuthRequired()
    const config = useSiteConfig()
    const hasBonusContent = hasModule(config, 'BONUS_CONTENT')
    const isNew = publicationId === undefined
    const [publication, setPublication] = useState<DigitalPublication | null>(null)
    const [title, setTitle] = useState('')
    const [slug, setSlug] = useState('')
    const [description, setDescription] = useState('')
    const [assetId, setAssetId] = useState<number | null>(null)
    const [accessPolicy, setAccessPolicy] = useState<AccessPolicy>('FREE')
    const [requiredLevelSortOrder, setRequiredLevelSortOrder] = useState<number | null>(null)
    const [isLoading, setIsLoading] = useState(!isNew)
    const [isSaving, setIsSaving] = useState(false)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [statusMessage, setStatusMessage] = useState<string | null>(null)
    // RBAC desk adaptation (issue #148): bonus files reference the media
    // library, so editing adapts to the MEDIA_ASSET rights. Hook call stays
    // above all early returns; new rows count as own.
    const desk = useDeskAccess({
        entity: 'MEDIA_ASSET',
        ownerUserId: publicationId === undefined ? undefined : (publication?.createdBy ?? null),
        kind: 'Bonusdatei',
    })

    useEffect(() => {
        if (!hasBonusContent || isNew || publicationId === undefined) {
            return
        }
        let active = true
        setIsLoading(true)
        getDigitalPublication(getClientTenantHost(), publicationId)
            .then((loaded) => {
                if (!active) {
                    return
                }
                setPublication(loaded)
                setTitle(loaded.title)
                setSlug(loaded.slug)
                setDescription(loaded.description ?? '')
                setAssetId(loaded.assetId)
                setAccessPolicy(loaded.accessPolicy)
                setRequiredLevelSortOrder(loaded.requiredLevelSortOrder)
                setIsLoading(false)
            })
            .catch((error: unknown) => {
                if (!active) {
                    return
                }
                if (authRedirect(error)) return
                setErrorMessage(
                    error instanceof Error
                        ? error.message
                        : 'Bonusdatei konnte nicht geladen werden.',
                )
                setIsLoading(false)
            })
        return () => {
            active = false
        }
    }, [authRedirect, hasBonusContent, isNew, publicationId])

    const canModify = isNew ? desk.canCreate : desk.canEdit
    const modifyBlockedReason = isNew ? desk.createBlockedReason : desk.editBlockedReason
    const readOnly = publication?.status === 'PUBLISHED' || !canModify

    async function runAction(action: () => Promise<DigitalPublication>, success: string): Promise<void> {
        setIsSaving(true)
        setErrorMessage(null)
        setStatusMessage(null)
        try {
            const saved = await action()
            setPublication(saved)
            setTitle(saved.title)
            setSlug(saved.slug)
            setDescription(saved.description ?? '')
            setAssetId(saved.assetId)
            setAccessPolicy(saved.accessPolicy)
            setRequiredLevelSortOrder(saved.requiredLevelSortOrder)
            setStatusMessage(success)
        } catch (error: unknown) {
            if (authRedirect(error)) return
            setErrorMessage(error instanceof Error ? error.message : 'Aktion fehlgeschlagen.')
        } finally {
            setIsSaving(false)
        }
    }

    async function handleSave(): Promise<void> {
        if (assetId === null) {
            setErrorMessage('Bitte ein Dokument aus der Mediathek wählen.')
            return
        }
        const createInput: CreateDigitalPublicationInput = {
            slug: slug.trim(),
            title: title.trim(),
            description: description.trim() || undefined,
            assetId,
            accessPolicy,
            requiredLevelSortOrder:
                accessPolicy === 'PAID' ? (requiredLevelSortOrder ?? 0) : undefined,
        }
        if (isNew) {
            setIsSaving(true)
            setErrorMessage(null)
            try {
                const created = await createDigitalPublication(getClientTenantHost(), createInput)
                router.replace(`/bonus/${created.id}`)
            } catch (error: unknown) {
                if (authRedirect(error)) return
                setErrorMessage(
                    error instanceof Error ? error.message : 'Bonusdatei konnte nicht angelegt werden.',
                )
                setIsSaving(false)
            }
            return
        }
        if (publicationId === undefined) {
            return
        }
        const updateInput: UpdateDigitalPublicationInput = {
            slug: slug.trim(),
            title: title.trim(),
            description: description.trim(),
            assetId,
            accessPolicy,
            requiredLevelSortOrder:
                accessPolicy === 'PAID' ? (requiredLevelSortOrder ?? 0) : undefined,
        }
        await runAction(
            () => updateDigitalPublication(getClientTenantHost(), publicationId, updateInput),
            'Gespeichert.',
        )
    }

    if (!hasBonusContent) {
        return (
            <PageStack>
                <PageHeader
                    eyebrow="Medien"
                    title="Bonusdatei"
                    description="Dokument aus der Mediathek mit Titel, Zugang und Veröffentlichung."
                />
                <div role="status">
                    <EmptyState
                        title="Bonusdateien nicht verfügbar"
                        description={
                            <>
                                Das Modul <code>BONUS_CONTENT</code> ist für diesen Tenant
                                nicht aktiv. Bonusdateien sind daher nicht verfügbar.
                            </>
                        }
                    />
                </div>
            </PageStack>
        )
    }

    if (isLoading) {
        return (
            <PageStack>
                <PageHeader eyebrow="Medien" title="Bonusdatei" description="Wird geladen…" />
                <Skeleton className="h-40 w-full" />
            </PageStack>
        )
    }

    return (
        <PageStack>
            <PageHeader
                eyebrow="Medien"
                title={isNew ? 'Neue Bonusdatei' : title || 'Bonusdatei'}
                description="Dokument aus der Mediathek mit Titel, Zugang und Veröffentlichung."
                actions={
                    publication !== null ? (
                        <PublicationStatusBadge
                            status={
                                publication.status === 'DRAFT'
                                    ? 'DRAFT'
                                    : publication.status === 'PUBLISHED'
                                      ? 'PUBLISHED'
                                      : 'ARCHIVED'
                            }
                        />
                    ) : undefined
                }
            />
            {errorMessage !== null ? (
                <Alert variant="destructive">
                    <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
            ) : null}
            {statusMessage !== null ? (
                <Alert role="status">
                    <AlertDescription>{statusMessage}</AlertDescription>
                </Alert>
            ) : null}
            {!canModify && modifyBlockedReason !== null ? (
                <Alert>
                    <AlertDescription>{modifyBlockedReason}</AlertDescription>
                </Alert>
            ) : null}

            <section className="flex flex-col gap-4">
                <SectionHeader title="Inhalt" description="Titel und Dokument." />
                <div className="grid gap-2">
                    <Label htmlFor="bonus-title">Titel</Label>
                    <Input
                        disabled={isSaving || readOnly}
                        id="bonus-title"
                        onChange={(event) => {
                            const next = event.target.value
                            setTitle(next)
                            if (isNew || publication?.status === 'DRAFT') {
                                setSlug(suggestSlug(next))
                            }
                        }}
                        value={title}
                    />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="bonus-slug">Slug</Label>
                    <Input
                        disabled={isSaving || readOnly}
                        id="bonus-slug"
                        pattern={HTML_SLUG_PATTERN}
                        value={slug}
                        onChange={(event) => setSlug(event.target.value)}
                    />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="bonus-description">Beschreibung</Label>
                    <Textarea
                        disabled={isSaving || readOnly}
                        id="bonus-description"
                        rows={4}
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                    />
                </div>
                <MediaLibraryPicker
                    assetType="DOCUMENT"
                    disabled={isSaving || readOnly}
                    label="Dokument aus Mediathek"
                    onAuthRequired={() => {}}
                    onSelect={(asset) => setAssetId(asset.id)}
                    selectedId={assetId}
                />
            </section>

            <section className="flex flex-col gap-4">
                <SectionHeader title="Zugang" description="Frei für alle Mitglieder oder bezahlt." />
                <label className="grid gap-1.5 text-sm">
                    <span>Zugangsrichtlinie</span>
                    <SelectControl
                        disabled={isSaving || readOnly}
                        id="bonus-access"
                        onChange={(event) => setAccessPolicy(event.target.value as AccessPolicy)}
                        value={accessPolicy}
                    >
                        <option value="FREE">Frei</option>
                        <option value="PAID">Bezahlt</option>
                    </SelectControl>
                </label>
                {accessPolicy === 'PAID' ? (
                    <LevelSelect
                        disabled={isSaving || readOnly}
                        onChange={setRequiredLevelSortOrder}
                        value={requiredLevelSortOrder}
                    />
                ) : null}
            </section>

            <div className="flex flex-wrap gap-2">
                <Button disabled={isSaving || readOnly} onClick={() => void handleSave()} type="button">
                    {isNew ? 'Anlegen' : 'Speichern'}
                </Button>
                {!isNew && publication?.status === 'DRAFT' ? (
                    <Button
                        disabled={isSaving || readOnly || !desk.canPublish}
                        onClick={() =>
                            void runAction(
                                () => publishDigitalPublication(getClientTenantHost(), publication.id),
                                'Veröffentlicht.',
                            )
                        }
                        type="button"
                        variant="outline"
                    >
                        Veröffentlichen
                    </Button>
                ) : null}
                {!isNew && publication?.status === 'PUBLISHED' ? (
                    <>
                        <Button
                            disabled={isSaving || !desk.canEdit}
                            onClick={() =>
                                void runAction(
                                    () => unpublishDigitalPublication(getClientTenantHost(), publication.id),
                                    'Zurückgezogen.',
                                )
                            }
                            type="button"
                            variant="outline"
                        >
                            Zurückziehen
                        </Button>
                        <Button
                            disabled={isSaving || !desk.canEdit}
                            onClick={() =>
                                void runAction(
                                    () => archiveDigitalPublication(getClientTenantHost(), publication.id),
                                    'Archiviert.',
                                )
                            }
                            type="button"
                            variant="outline"
                        >
                            Archivieren
                        </Button>
                    </>
                ) : null}
                {!isNew && publication?.status === 'ARCHIVED' ? (
                    <Button
                        disabled={isSaving || !desk.canEdit}
                        onClick={() =>
                            void runAction(
                                () => unarchiveDigitalPublication(getClientTenantHost(), publication.id),
                                'Wiederhergestellt.',
                            )
                        }
                        type="button"
                        variant="outline"
                    >
                        Wiederherstellen
                    </Button>
                ) : null}
                {!isNew &&
                publication !== null &&
                publication.status !== 'PUBLISHED' &&
                desk.canDelete ? (
                    <Button
                        disabled={isSaving}
                        onClick={() => {
                            void (async () => {
                                setIsSaving(true)
                                try {
                                    await deleteDigitalPublication(getClientTenantHost(), publication.id)
                                    router.replace('/bonus')
                                } catch (error: unknown) {
                                    if (authRedirect(error)) return
                                    setErrorMessage(
                                        error instanceof Error
                                            ? error.message
                                            : 'Löschen fehlgeschlagen.',
                                    )
                                    setIsSaving(false)
                                }
                            })()
                        }}
                        type="button"
                        variant="destructive"
                    >
                        Löschen
                    </Button>
                ) : null}
                <Button nativeButton={false} render={<Link href="/bonus" />} type="button" variant="ghost">
                    Zurück zur Liste
                </Button>
            </div>
        </PageStack>
    )
}
