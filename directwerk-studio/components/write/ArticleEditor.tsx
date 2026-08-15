'use client'

import {Button} from '@directwerk/ui/components/button'
import {Input} from '@directwerk/ui/components/input'

import {useRouter} from 'next/navigation'
import {useCallback, useEffect, useRef, useState} from 'react'

import MediaLibraryPicker from '@/components/media/MediaLibraryPicker'
import UploadProgress from '@/components/media/UploadProgress'
import PublicationEditorLayout from '@/components/publication/PublicationEditorLayout'
import LevelSelect from '@/components/studio/LevelSelect'
import {AUTH_REQUIRED} from '@/lib/api/errors'
import {
    archiveArticle,
    cancelScheduleArticle,
    createArticle,
    getArticle,
    getMediaPreviewUrl,
    listCategories,
    publishArticle,
    replaceArticleCategories,
    scheduleArticle,
    suggestSlug,
    unarchiveArticle,
    unpublishArticle,
    updateArticle,
} from '@/lib/api/tenantApi'
import type {AccessPolicy, ArticleDetail, CategorySummary} from '@/lib/api/types'
import {fromDatetimeLocalValue, toDatetimeLocalValue} from '@/lib/datetime'
import {useDraftAutosave} from '@/lib/editor/useDraftAutosave'
import {uploadMediaFile} from '@/lib/media/upload'
import {useSiteConfig} from '@/lib/site/SiteConfigProvider'
import {getClientTenantHost} from '@/lib/tenant/getClientTenantHost'

/**
 * Edits an article and manages its publication workflow and category assignments.
 *
 * @param articleId - The ID of the article to edit; omit to create a new article.
 */
export default function ArticleEditor({articleId}: {articleId?: number}) {
    const router = useRouter()
    const routerRef = useRef(router)
    routerRef.current = router
    const config = useSiteConfig()
    const showNotify = config.emailNotifyAvailable === true
    const [article, setArticle] = useState<ArticleDetail | null>(null)
    const [title, setTitle] = useState('')
    const [slug, setSlug] = useState('')
    const [body, setBody] = useState('')
    const [excerpt, setExcerpt] = useState('')
    const [accessPolicy, setAccessPolicy] = useState<AccessPolicy>('FREE')
    const [heroAssetId, setHeroAssetId] = useState<number | null>(null)
    const [requiredLevelSortOrder, setRequiredLevelSortOrder] = useState<number | null>(null)
    const [heroPreviewUrl, setHeroPreviewUrl] = useState<string | null>(null)
    const [isUploadingHero, setIsUploadingHero] = useState(false)
    const [uploadProgress, setUploadProgress] = useState<{file: File; progress: number} | null>(
        null,
    )
    const mountedRef = useRef(true)
    const [notifySubscribers, setNotifySubscribers] = useState(false)
    const [scheduledAt, setScheduledAt] = useState('')
    const [isSaving, setIsSaving] = useState(false)
    const [isLoading, setIsLoading] = useState(articleId !== undefined)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [loadError, setLoadError] = useState(false)
    const [availableCategories, setAvailableCategories] = useState<CategorySummary[]>([])
    const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<number>>(new Set())
    const [isTagsSaving, setIsTagsSaving] = useState(false)
    const [tagsStatusMessage, setTagsStatusMessage] = useState<string | null>(null)
    const [isDirty, setIsDirty] = useState(false)
    const [dirtyRevision, setDirtyRevision] = useState(0)
    const [saveHint, setSaveHint] = useState<string | null>(null)

    useEffect(() => {
        mountedRef.current = true
        if (articleId === undefined) {
            setIsLoading(false)
            return
        }

        const resolvedArticleId = articleId
        let active = true

        async function load(): Promise<void> {
            try {
                const host = getClientTenantHost()
                const [categoryList, loaded] = await Promise.all([
                    listCategories(host),
                    getArticle(host, resolvedArticleId),
                ])
                if (!active) {
                    return
                }
                setAvailableCategories(categoryList.filter((item) => item.active))
                setArticle(loaded)
                setTitle(loaded.title)
                setSlug(loaded.slug)
                setBody(loaded.body ?? '')
                setExcerpt(loaded.excerpt ?? '')
                setAccessPolicy(loaded.accessPolicy)
                setHeroAssetId(loaded.heroAssetId)
                setRequiredLevelSortOrder(loaded.requiredLevelSortOrder)
                setScheduledAt(toDatetimeLocalValue(loaded.scheduledAt))
                setSelectedCategoryIds(new Set(loaded.categories.map((tag) => tag.id)))
            } catch (error) {
                if (active) {
                    setLoadError(true)
                    setErrorMessage(
                        error instanceof Error
                            ? error.message
                            : 'Beitrag konnte nicht geladen werden.',
                    )
                }
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
    }, [articleId])

    useEffect(() => {
        let active = true

        if (heroAssetId === null) {
            setHeroPreviewUrl(null)
            return
        }

        getMediaPreviewUrl(getClientTenantHost(), heroAssetId)
            .then((url) => {
                if (active) {
                    setHeroPreviewUrl(url)
                }
            })
            .catch((error: unknown) => {
                if (!active) {
                    return
                }
                if (error instanceof Error && error.message === AUTH_REQUIRED) {
                    routerRef.current.replace('/login')
                    return
                }
                setHeroPreviewUrl(null)
            })

        return () => {
            active = false
        }
    }, [heroAssetId])

    const handleAuthError = useCallback(
        (error: unknown) => {
            if (error instanceof Error && error.message === AUTH_REQUIRED) {
                routerRef.current.replace('/login')
                return
            }
            setErrorMessage(
                error instanceof Error ? error.message : 'Aktion fehlgeschlagen.',
            )
        },
        [],
    )

    const markDirty = useCallback(() => {
        setIsDirty(true)
        setDirtyRevision((current) => current + 1)
        setSaveHint('Ungespeicherte Änderungen')
    }, [])

    const save = useCallback(async (options?: {autosave?: boolean}): Promise<ArticleDetail | null> => {
        if (loadError) {
            return null
        }

        setIsSaving(true)
        setErrorMessage(null)

        try {
            const host = getClientTenantHost()
            const resolvedSlug = slug.trim() || suggestSlug(title) || 'beitrag'
            const payload = {
                title: title.trim() || 'Ohne Titel',
                slug: resolvedSlug,
                body,
                excerpt: excerpt.trim() || undefined,
                accessPolicy,
                heroAssetId: heroAssetId ?? undefined,
                requiredLevelSortOrder: requiredLevelSortOrder ?? undefined,
            }
            const hint = options?.autosave === true ? 'Automatisch gespeichert' : 'Gespeichert'

            if (articleId === undefined) {
                const created = await createArticle(host, payload)
                setArticle(created)
                setIsDirty(false)
                setSaveHint(hint)
                routerRef.current.replace(`/write/articles/${created.id}`)
                return created
            }

            const updated = await updateArticle(host, articleId, payload)
            setArticle(updated)
            setIsDirty(false)
            setSaveHint(hint)
            return updated
        } catch (error) {
            handleAuthError(error)
            return null
        } finally {
            setIsSaving(false)
        }
    }, [
        accessPolicy,
        articleId,
        body,
        excerpt,
        handleAuthError,
        heroAssetId,
        loadError,
        requiredLevelSortOrder,
        slug,
        title,
    ])

    useDraftAutosave({
        enabled: (article?.status ?? 'DRAFT') === 'DRAFT' && articleId !== undefined,
        isDirty,
        isSaving: isSaving || isUploadingHero || isTagsSaving,
        onSave: () => save({autosave: true}),
        revision: dirtyRevision,
    })

    const handleAuthRequired = useCallback(() => {
        routerRef.current.replace('/login')
    }, [])

    const persistTags = useCallback(
        async (current: ArticleDetail): Promise<ArticleDetail> => {
            const updated = await replaceArticleCategories(
                getClientTenantHost(),
                current.id,
                Array.from(selectedCategoryIds),
            )
            setArticle(updated)
            setSelectedCategoryIds(new Set(updated.categories.map((tag) => tag.id)))
            return updated
        },
        [selectedCategoryIds],
    )

    const runWorkflow = useCallback(
        async (
            action: (current: ArticleDetail) => Promise<ArticleDetail>,
            options?: {persistTags?: boolean},
        ) => {
            // Content updates are only allowed for DRAFT. Workflow verbs on other
            // statuses must not call update first (e.g. unarchive from ARCHIVED).
            const status = article?.status ?? 'DRAFT'
            let current: ArticleDetail | null
            if (articleId === undefined || status === 'DRAFT') {
                current = await save()
            } else {
                current = article
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
                setArticle(next)
                setScheduledAt(toDatetimeLocalValue(next.scheduledAt))
            } catch (error) {
                handleAuthError(error)
            } finally {
                setIsSaving(false)
            }
        },
        [article, articleId, handleAuthError, persistTags, save],
    )

    const handleSaveTags = useCallback(async (): Promise<void> => {
        if (article === null) {
            return
        }

        setIsTagsSaving(true)
        setTagsStatusMessage(null)
        try {
            await persistTags(article)
            setTagsStatusMessage('Kategorien gespeichert.')
        } catch (error) {
            handleAuthError(error)
        } finally {
            setIsTagsSaving(false)
        }
    }, [article, handleAuthError, persistTags])

    const handleHeroUpload = useCallback(
        async (file: File | null) => {
            if (file === null) {
                return
            }
            setIsUploadingHero(true)
            setErrorMessage(null)
            setUploadProgress({file, progress: 0})
            try {
                const asset = await uploadMediaFile(getClientTenantHost(), file, {
                    assetType: 'IMAGE',
                    visibility: 'PUBLIC',
                    onProgress: (percent) => {
                        if (mountedRef.current) {
                            setUploadProgress({file, progress: percent})
                        }
                    },
                })
                setHeroAssetId(asset.id)
                markDirty()
            } catch (error) {
                handleAuthError(error)
            } finally {
                if (mountedRef.current) {
                    setIsUploadingHero(false)
                    setUploadProgress(null)
                }
            }
        },
        [handleAuthError, markDirty],
    )

    if (isLoading) {
        return <p>Beitrag wird geladen…</p>
    }

    return (
        <PublicationEditorLayout
            kind="article"
            status={article?.status ?? 'DRAFT'}
            title={title}
            body={body}
            accessPolicy={accessPolicy}
            slug={slug}
            excerpt={excerpt}
            onTitleChange={(value) => {
                setTitle(value)
                markDirty()
                if (articleId === undefined && slug.trim().length === 0) {
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
            onExcerptChange={(value) => {
                setExcerpt(value)
                markDirty()
            }}
            isSaving={isSaving}
            saveHint={saveHint}
            errorMessage={errorMessage}
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
                        publishArticle(getClientTenantHost(), saved.id, {notifySubscribers}),
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
                        scheduleArticle(getClientTenantHost(), saved.id, {
                            scheduledAt: iso,
                            notifySubscribers,
                        }),
                    {persistTags: true},
                )
            }}
            onCancelSchedule={() => {
                void runWorkflow((saved) =>
                    cancelScheduleArticle(getClientTenantHost(), saved.id),
                )
            }}
            onUnpublish={() => {
                void runWorkflow((saved) =>
                    unpublishArticle(getClientTenantHost(), saved.id),
                )
            }}
            onArchive={() => {
                void runWorkflow((saved) =>
                    archiveArticle(getClientTenantHost(), saved.id),
                )
            }}
            onUnarchive={() => {
                void runWorkflow((saved) =>
                    unarchiveArticle(getClientTenantHost(), saved.id),
                )
            }}
            sidebarExtra={
                <>
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
                            Niedrigste Stufe, die Zugriff erhält. Zugriff hat, wessen höchste
                            Stufe ≥ Mindest-Stufe ist. „Öffentlich“ = jede aktive Stufe reicht.
                            {accessPolicy === 'FREE'
                                ? ' Nur relevant für kostenpflichtige Beiträge.'
                                : ''}
                        </span>
                    </label>
                    <div>
                        <p>Titelbild</p>
                        {heroPreviewUrl !== null ? (
                            <img
                                alt=""
                                src={heroPreviewUrl}
                                style={{maxWidth: '12rem', display: 'block'}}
                            />
                        ) : null}
                        <label>
                            <span>{heroAssetId === null ? 'Bild hochladen' : 'Bild ersetzen'}</span>
                            <Input
                                accept="image/png,image/jpeg,image/webp"
                                disabled={isSaving || isUploadingHero}
                                onChange={(event) => {
                                    const file = event.target.files?.[0] ?? null
                                    void handleHeroUpload(file)
                                    event.target.value = ''
                                }}
                                type="file"
                            />
                        </label>
                        {uploadProgress !== null ? (
                            <UploadProgress
                                file={uploadProgress.file}
                                progress={uploadProgress.progress}
                            />
                        ) : null}
                        <MediaLibraryPicker
                            assetType="IMAGE"
                            disabled={isSaving || isUploadingHero}
                            label="Titelbild aus Mediathek"
                            onAuthRequired={handleAuthRequired}
                            onSelect={(asset) => {
                                setHeroAssetId(asset.id)
                                markDirty()
                            }}
                            selectedId={heroAssetId}
                        />
                    </div>
                    {article !== null ? (
                    <div>
                        <p>Kategorien</p>
                        {availableCategories.length === 0 ? (
                            <p>Keine Kategorien angelegt.</p>
                        ) : (
                            availableCategories.map((category) => (
                                <label key={category.id} style={{display: 'block'}}>
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
                        {tagsStatusMessage !== null ? <p role="status">{tagsStatusMessage}</p> : null}
                        <Button disabled={isTagsSaving} onClick={() => void handleSaveTags()} type="button">
                            {isTagsSaving ? 'Speichert…' : 'Kategorien speichern'}
                        </Button>
                    </div>
                    ) : null}
                </>
            }
        />
    )
}
