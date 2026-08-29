'use client'

import {Input} from '@directwerk/ui/components/input'
import {suggestSlug} from '@/lib/api/studioHelpers'

import {useRouter} from 'next/navigation'
import {useCallback, useEffect, useMemo, useRef, useState} from 'react'

import MediaLibraryPicker from '@/components/media/MediaLibraryPicker'
import UploadProgress from '@/components/media/UploadProgress'
import FormatCategoryPicker from '@/components/publication/FormatCategoryPicker'
import PublishedLinksPanel from '@/components/publication/PublishedLinksPanel'
import PublicationEditorLayout from '@/components/publication/PublicationEditorLayout'
import LevelSelect from '@/components/studio/LevelSelect'
import {listCategories, replaceArticleCategories} from '@/lib/api/catalogApi'
import {getMediaPreviewUrl} from '@/lib/api/mediaApi'
import {
    archiveArticle,
    cancelScheduleArticle,
    createArticle,
    getArticle,
    listArticles,
    publishArticle,
    scheduleArticle,
    unarchiveArticle,
    unpublishArticle,
    updateArticle,
} from '@/lib/api/writeApi'
import type {ArticleDetail, CategorySummary} from '@directwerk/api/types'
import {mediaLimitLabel} from '@/lib/media/limits'
import {uploadMediaFile} from '@/lib/media/upload'
import {usePublicationEditorFields} from '@/lib/publication/usePublicationEditorFields'
import {usePublicationEditorWorkflow} from '@/lib/publication/usePublicationEditorWorkflow'
import {isSlugTaken} from '@/lib/publication/slugAvailability'
import {useNotifyAudienceHint} from '@/lib/studio/useNotifyAudienceHint'
import {useSiteConfig} from '@/lib/site/SiteConfigProvider'
import {getClientTenantHost} from '@directwerk/api/tenant'
import {articlePublishBlockReason} from '@/lib/write/articlePreflight'
import {publicArticlePageUrl} from '@directwerk/api/urls/publicContentUrls'
import {useAuthRequired} from '@directwerk/api/auth/useAuthRequired'

export default function ArticleEditor({articleId}: {articleId?: number}) {
    const router = useRouter()
    const authRedirect = useAuthRequired()
    const routerRef = useRef(router)
    routerRef.current = router
    const config = useSiteConfig()
    const showNotify = config.emailNotifyAvailable === true
    const notifyAudienceHint = useNotifyAudienceHint(showNotify)
    const [article, setArticle] = useState<ArticleDetail | null>(null)
    const [allArticles, setAllArticles] = useState<ArticleDetail[]>([])
    const [title, setTitle] = useState('')
    const [slug, setSlug] = useState('')
    const [body, setBody] = useState('')
    const [excerpt, setExcerpt] = useState('')
    const [seoDescription, setSeoDescription] = useState('')
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
    } = usePublicationEditorFields()
    const [heroAssetId, setHeroAssetId] = useState<number | null>(null)
    const [heroPreviewUrl, setHeroPreviewUrl] = useState<string | null>(null)
    const [isUploadingHero, setIsUploadingHero] = useState(false)
    const [uploadProgress, setUploadProgress] = useState<{file: File; progress: number} | null>(
        null,
    )
    const mountedRef = useRef(true)
    const [isLoading, setIsLoading] = useState(articleId !== undefined)
    const [loadError, setLoadError] = useState(false)
    const [availableCategories, setAvailableCategories] = useState<CategorySummary[]>([])
    const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<number>>(new Set())

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

    const saveImpl = useCallback(
        async (): Promise<ArticleDetail | null> => {
            const host = getClientTenantHost()
            const resolvedSlug = slug.trim() || suggestSlug(title) || 'beitrag'
            const payload = {
                title: title.trim() || 'Ohne Titel',
                slug: resolvedSlug,
                body,
                excerpt: excerpt.trim() || undefined,
                seoDescription: seoDescription.trim() || undefined,
                accessPolicy,
                heroAssetId: heroAssetId ?? undefined,
                requiredLevelSortOrder: requiredLevelSortOrder ?? undefined,
            }

            if (articleId === undefined) {
                const created = await createArticle(host, payload)
                setArticle(created)
                setAllArticles((current) => [...current, created])
                routerRef.current.replace(`/write/articles/${created.id}`)
                return created
            }

            const updated = await updateArticle(host, articleId, payload)
            const withTags = await persistTags(updated)
            setArticle(withTags)
            setAllArticles((current) =>
                current.map((item) => (item.id === withTags.id ? withTags : item)),
            )
            return withTags
        },
        [
            accessPolicy,
            articleId,
            body,
            excerpt,
            heroAssetId,
            persistTags,
            requiredLevelSortOrder,
            seoDescription,
            slug,
            title,
        ],
    )

    const {
        isSaving,
        errorMessage,
        setErrorMessage: setWorkflowError,
        saveHint,
        markDirty,
        save,
        runWorkflow,
    } = usePublicationEditorWorkflow({
        publicationId: articleId,
        publication: article,
        loadError,
        persistTags,
        saveImpl,
        onWorkflowComplete: (next) => {
            setArticle(next)
            applyPublicationSchedule(next.scheduledAt)
        },
        autosaveBlocked: isUploadingHero,
        authRedirect,
    })

    useEffect(() => {
        mountedRef.current = true
        let active = true

        async function loadSlugIndex(): Promise<void> {
            const loaded = await listArticles(getClientTenantHost())
            if (active) {
                setAllArticles(loaded)
            }
        }

        void loadSlugIndex().catch((error: unknown) => {
            if (!active) {
                return
            }
            authRedirect(error)
        })

        if (articleId === undefined) {
            listCategories(getClientTenantHost())
                .then((categoryList) => {
                    if (active) {
                        setAvailableCategories(categoryList.filter((item) => item.active))
                    }
                })
                .catch((error: unknown) => {
                    if (!active) {
                        return
                    }
                    if (authRedirect(error)) return
                    setWorkflowError(
                        error instanceof Error
                            ? error.message
                            : 'Kategorien konnten nicht geladen werden.',
                    )
                })
            setIsLoading(false)
            return () => {
                active = false
                mountedRef.current = false
            }
        }

        const resolvedArticleId = articleId

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
                setSeoDescription(loaded.seoDescription ?? '')
                setAccessPolicy(loaded.accessPolicy)
                setHeroAssetId(loaded.heroAssetId)
                setRequiredLevelSortOrder(loaded.requiredLevelSortOrder)
                applyPublicationSchedule(loaded.scheduledAt)
                setSelectedCategoryIds(new Set(loaded.categories.map((tag) => tag.id)))
            } catch (error) {
                if (active) {
                    setLoadError(true)
                    setWorkflowError(
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

        void load()

        return () => {
            active = false
            mountedRef.current = false
        }
    }, [articleId, authRedirect, setWorkflowError])

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
                if (authRedirect(error)) return
                setHeroPreviewUrl(null)
            })

        return () => {
            active = false
        }
    }, [authRedirect, heroAssetId, setWorkflowError])

    const handleAuthRequired = useCallback(() => {
        routerRef.current.replace('/login')
    }, [])

    const handleHeroUpload = useCallback(
        async (file: File | null) => {
            if (file === null) {
                return
            }
            setIsUploadingHero(true)
            setWorkflowError(null)
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
                if (authRedirect(error)) return
                setWorkflowError(
                    error instanceof Error ? error.message : 'Upload fehlgeschlagen.',
                )
            } finally {
                if (mountedRef.current) {
                    setIsUploadingHero(false)
                    setUploadProgress(null)
                }
            }
        },
        [authRedirect, markDirty, setWorkflowError],
    )

    const slugTaken = useCallback(
        (candidate: string) => isSlugTaken(allArticles, candidate, articleId),
        [allArticles, articleId],
    )

    const publishBlockedReason = articlePublishBlockReason({title, body})
    const publishedUrl = useMemo(() => {
        if (article?.status !== 'PUBLISHED') {
            return null
        }
        return publicArticlePageUrl(config.publicSiteUrl, article.slug)
    }, [article, config.publicSiteUrl])

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
            seoDescription={seoDescription}
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
            onSeoDescriptionChange={(value) => {
                setSeoDescription(value)
                markDirty()
            }}
            slugTaken={slugTaken}
            isSaving={isSaving}
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
                const iso = parseScheduledAt()
                if (iso === null) {
                    setScheduleValidationError('Bitte einen gültigen Zeitpunkt wählen.')
                    setWorkflowError('Bitte einen gültigen Zeitpunkt wählen.')
                    return
                }
                setScheduleValidationError(null)
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
                    {publishedUrl !== null ? (
                        <PublishedLinksPanel
                            title="Öffentliche Links"
                            links={[{label: 'Beitragsseite', url: publishedUrl}]}
                        />
                    ) : null}
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
                        <p className="text-sm font-semibold">Titelbild</p>
                        {heroPreviewUrl !== null ? (
                            <img
                                alt=""
                                className="mt-2 max-w-[12rem] rounded-md"
                                src={heroPreviewUrl}
                            />
                        ) : null}
                        <label className="mt-2 grid gap-2 text-sm">
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
                            <span className="text-xs text-muted-foreground">
                                Max. {mediaLimitLabel('IMAGE')}.
                            </span>
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
                        <FormatCategoryPicker
                            categories={availableCategories}
                            disabled={isSaving}
                            onCategoryChange={(ids) => {
                                setSelectedCategoryIds(ids)
                                markDirty()
                            }}
                            selectedCategoryIds={selectedCategoryIds}
                            selectedFormatIds={new Set()}
                        />
                    ) : null}
                </>
            }
        />
    )
}
