'use client'

import {Button} from '@directwerk/ui/components/button'
import {Input} from '@directwerk/ui/components/input'
import {Card, CardContent} from '@directwerk/ui/components/card'
import SectionHeader from '@directwerk/ui/components/section-header'
import {suggestSlug} from '@/lib/api/studioHelpers'

import {useRouter} from 'next/navigation'
import {useCallback, useEffect, useMemo, useRef, useState} from 'react'

import MediaLibraryPicker from '@/components/media/MediaLibraryPicker'
import UploadProgress from '@/components/media/UploadProgress'
import FormatCategoryPicker from '@/components/publication/FormatCategoryPicker'
import PublicationDangerZone from '@/components/publication/PublicationDangerZone'
import PublishedLinksPanel from '@/components/publication/PublishedLinksPanel'
import PublicationEditorLayout from '@/components/publication/PublicationEditorLayout'
import {listCategories, replaceArticleCategories} from '@/lib/api/catalogApi'
import {getMediaPreviewUrl} from '@/lib/api/mediaApi'
import {getMyEffectiveRights} from '@/lib/api/tenantSettingsApi'
import {useOptionalMe} from '@/lib/auth/MeProvider'
import {deskAccess} from '@/lib/rbac/access'
import {
    archiveArticle,
    cancelScheduleArticle,
    createArticle,
    deleteArticle,
    getArticle,
    listArticles,
    publishArticle,
    scheduleArticle,
    unarchiveArticle,
    unpublishArticle,
    updateArticle,
} from '@/lib/api/writeApi'
import type {ArticleDetail, CategorySummary, EffectiveRights} from '@directwerk/api/types'
import {mediaLimitLabel} from '@/lib/media/limits'
import {uploadMediaFile} from '@/lib/media/upload'
import {usePublicationEditorFields} from '@/lib/publication/usePublicationEditorFields'
import {usePublicationEditorWorkflow} from '@/lib/publication/usePublicationEditorWorkflow'
import {isSlugTaken} from '@/lib/publication/slugAvailability'
import {useNotifyAudienceHint} from '@/lib/studio/useNotifyAudienceHint'
import {useDefaultNotifySubscribers} from '@/lib/publication/useDefaultNotifySubscribers'
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
    const [myRights, setMyRights] = useState<EffectiveRights | null>(null)
    const me = useOptionalMe()
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
        scheduleValidationError,
        publishedAt,
        setPublishedAt,
        applyPublicationPublishedAt,
        validatePublishedAt,
        setPublishValidationError,
        publishValidationError,
    } = usePublicationEditorFields()
    useDefaultNotifySubscribers(showNotify, setNotifySubscribers)
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

            const updated = await updateArticle(host, articleId, {
                ...payload,
                clearHeroAsset: heroAssetId === null,
            })
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
        isDirty,
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
            applyPublicationPublishedAt(next.publishedAt)
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
                const [categoryList, loaded, loadedRights] = await Promise.all([
                    listCategories(host),
                    getArticle(host, resolvedArticleId),
                    getMyEffectiveRights(host).catch(() => null),
                ])
                if (!active) {
                    return
                }
                setMyRights(loadedRights)
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
                applyPublicationPublishedAt(loaded.publishedAt)
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
    /** Saving and hero uploads share one busy flag so a manual save cannot
     * persist the article while the hero image is still uploading. */
    const busy = isSaving || isUploadingHero
    // RBAC desk adaptation (issue #148): new rows count as own (creation is
    // governed by the CREATE check on save); the backend enforces per row.
    const desk = deskAccess({
        effective: myRights?.effective ?? null,
        entity: 'ARTICLE',
        ownerUserId: articleId === undefined ? (me?.userId ?? null) : (article?.createdBy ?? null),
        myUserId: me?.userId ?? null,
        kind: 'Beitrag',
    })
    const readOnly = !desk.canEdit

    const publishBlockedReason = articlePublishBlockReason({title, body})
    const publishedUrl = useMemo(() => {
        if (article?.status !== 'PUBLISHED') {
            return null
        }
        return publicArticlePageUrl(config.publicSiteUrl, article.slug)
    }, [article, config.publicSiteUrl])

    if (isLoading) {
        return (
            <p className="text-sm text-muted-foreground" role="status">
                Beitrag wird geladen…
            </p>
        )
    }

    return (
        <>
            <PublicationEditorLayout
                kind="article"
                status={article?.status ?? 'DRAFT'}
            title={title}
            body={body}
            accessPolicy={accessPolicy}
            slug={slug}
            excerpt={excerpt}
            seoDescription={seoDescription}
            requiredLevelSortOrder={requiredLevelSortOrder}
            onRequiredLevelChange={(value) => {
                setRequiredLevelSortOrder(value)
                markDirty()
            }}
            isDirty={isDirty}
            previewImageUrl={heroPreviewUrl}
            previewImageAlt={title.trim().length > 0 ? `Titelbild: ${title}` : 'Titelbild'}
            previewExcerpt={excerpt}
            previewUrl={publishedUrl ?? publicArticlePageUrl(config.publicSiteUrl, slug.trim() || suggestSlug(title) || 'beitrag')}
            previewUrlHint={
                publishedUrl !== null
                    ? 'Live-URL des Beitrags:'
                    : 'So lautet die URL nach dem Veröffentlichen:'
            }
            onAuthRequired={handleAuthRequired}
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
            isSaving={busy}
            saveHint={saveHint}
            errorMessage={errorMessage}
            canPublish={publishBlockedReason === null && desk.canPublish}
            publishBlockedReason={desk.publishBlockedReason ?? publishBlockedReason}
            readOnlyReason={readOnly ? desk.editBlockedReason : null}
            showNotify={showNotify}
            notifySubscribers={notifySubscribers}
            onNotifyChange={setNotifySubscribers}
            notifyAudienceHint={notifyAudienceHint}
            scheduledAt={scheduledAt}
            onScheduledAtChange={setScheduledAt}
            publishedAt={publishedAt}
            onPublishedAtChange={setPublishedAt}
            publishValidationError={publishValidationError}
            scheduleValidationError={scheduleValidationError}
            onSave={() => {
                void save()
            }}
            onPublish={() => {
                const validation = validatePublishedAt()
                if (!validation.valid) {
                    setPublishValidationError(validation.message)
                    setWorkflowError(validation.message)
                    return
                }
                setPublishValidationError(null)
                void runWorkflow(
                    (saved) =>
                        publishArticle(getClientTenantHost(), saved.id, {
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
                    <Card>
                        <CardContent className="flex flex-col gap-3 pt-(--card-spacing)">
                            <SectionHeader
                                as="h3"
                                description="Aufmacher für Karten und Beitragsseite."
                                title="Titelbild"
                            />
                        {heroPreviewUrl !== null ? (
                            <img
                                alt={title.trim().length > 0 ? `Titelbild: ${title}` : 'Titelbild'}
                                className="aspect-video w-full rounded-lg object-cover"
                                src={heroPreviewUrl}
                            />
                        ) : null}
                        <label className="grid gap-2 text-sm font-medium">
                            <span>{heroAssetId === null ? 'Bild hochladen' : 'Bild ersetzen'}</span>
                            <Input
                                accept="image/png,image/jpeg,image/webp"
                                disabled={isSaving || isUploadingHero || readOnly}
                                onChange={(event) => {
                                    const file = event.target.files?.[0] ?? null
                                    void handleHeroUpload(file)
                                    event.target.value = ''
                                }}
                                type="file"
                            />
                            <span className="text-xs font-normal text-muted-foreground">
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
                            disabled={isSaving || isUploadingHero || readOnly}
                            label="Titelbild aus Mediathek"
                            onAuthRequired={handleAuthRequired}
                            onSelect={(asset) => {
                                setHeroAssetId(asset.id)
                                markDirty()
                            }}
                            selectedId={heroAssetId}
                        />
                        {heroAssetId !== null ? (
                            <Button
                                disabled={isSaving || isUploadingHero || readOnly}
                                onClick={() => {
                                    setHeroAssetId(null)
                                    markDirty()
                                }}
                                size="sm"
                                type="button"
                                variant="outline"
                            >
                                Titelbild entfernen
                            </Button>
                        ) : null}
                        </CardContent>
                    </Card>
                    {article !== null ? (
                        <Card>
                            <CardContent className="flex flex-col gap-4 pt-(--card-spacing)">
                                <SectionHeader
                                    as="h3"
                                    description="Kategorien strukturieren Website und Feeds."
                                    title="Einordnung"
                                />
                        <FormatCategoryPicker
                            categories={availableCategories}
                            disabled={busy || readOnly}
                            onCategoryChange={(ids) => {
                                setSelectedCategoryIds(ids)
                                markDirty()
                            }}
                            selectedCategoryIds={selectedCategoryIds}
                            selectedFormatIds={new Set()}
                        />
                            </CardContent>
                        </Card>
                    ) : null}
                </>
            }
            />
            {articleId !== undefined && article !== null && desk.canDelete ? (
                <div className="mt-6">
                    <PublicationDangerZone
                        contentLabel="Beitrag"
                        deleteErrorMessage="Beitrag konnte nicht gelöscht werden."
                        item={article}
                        onDelete={(id) => deleteArticle(getClientTenantHost(), id)}
                        onDeleted={() => router.replace('/write/articles')}
                    />
                </div>
            ) : null}
        </>
    )
}
