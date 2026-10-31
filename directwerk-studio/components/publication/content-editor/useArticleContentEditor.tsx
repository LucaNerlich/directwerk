'use client'

import {suggestSlug} from '@/lib/api/studioHelpers'
import {useRouter} from 'next/navigation'
import {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react'

import ArticleEditorSidebar from '@/components/publication/content-editor/ArticleEditorSidebar'
import {articleContentEditorDescriptor} from '@/components/publication/content-editor/articleDescriptor'
import type {ContentEditorModel} from '@/components/publication/content-editor/types'
import {useDictionary} from '@/components/i18n/LocaleProvider'
import {useLocalizedPath} from '@/components/i18n/useLocalizedPath'
import {
    listCategories,
    replaceArticleCategories,
    replaceArticleNewsletterLists,
} from '@/lib/api/catalogApi'
import {listNewsletterLists} from '@/lib/api/newsletterListsApi'
import {getMediaPreviewUrl} from '@/lib/api/mediaApi'
import {useDeskAccess} from '@/lib/rbac/useDeskAccess'
import {listAllArticles} from '@/lib/api/listAllArticles'
import {
    createArticle,
    getArticle,
    updateArticle,
} from '@/lib/api/writeApi'
import type {ArticleDetail, CategorySummary, NewsletterListSummary} from '@directwerk/api/types'
import {useCoverImageUpload} from '@/lib/media/useCoverImageUpload'
import {usePublicationEditorFields} from '@/lib/publication/usePublicationEditorFields'
import {usePublicationEditorWorkflow} from '@/lib/publication/usePublicationEditorWorkflow'
import {isSlugTaken, toSlugEntries, type SlugEntry} from '@/lib/publication/slugAvailability'
import {useContentNotifyPreview} from '@/lib/publication/useContentNotifyPreview'
import {useDefaultNotifySubscribers} from '@/lib/publication/useDefaultNotifySubscribers'
import {useSiteConfig} from '@/lib/site/SiteConfigProvider'
import {articlePublishBlockReason} from '@/lib/write/articlePreflight'
import {publicArticlePageUrl} from '@directwerk/api/urls/publicContentUrls'
import {useAuthRequired} from '@directwerk/api/auth/useAuthRequired'

/**
 * Article content-type session for {@link PublicationContentEditor}.
 * Owns article load/save, hero upload, categories/newsletter, and preflight.
 */
export function useArticleContentEditor(
    articleId?: number,
): ContentEditorModel<ArticleDetail> {
    const descriptor = articleContentEditorDescriptor
    const dict = useDictionary()
    const router = useRouter()
    const localize = useLocalizedPath()
    const authRedirect = useAuthRequired()
    const routerRef = useRef(router)
    // Issue #417: writing a ref during render violates the Rules of React and makes the React
    // Compiler bail out of optimising this component.
    useLayoutEffect(() => {
        routerRef.current = router
    }, [router])
    const config = useSiteConfig()
    const showNotify = config.emailNotifyAvailable === true
    const [article, setArticle] = useState<ArticleDetail | null>(null)
    const [slugIndex, setSlugIndex] = useState<SlugEntry[]>([])
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
    // RBAC desk adaptation (issue #148); hook call stays above all early
    // returns. New rows count as own; the backend enforces per row.
    const desk = useDeskAccess({
        entity: descriptor.deskEntity,
        ownerUserId: articleId === undefined ? undefined : (article?.createdBy ?? null),
        kind: descriptor.labels.contentLabel,
    })
    const [heroAssetId, setHeroAssetId] = useState<number | null>(null)
    const [heroPreviewUrl, setHeroPreviewUrl] = useState<string | null>(null)
    const mountedRef = useRef(true)
    const [isLoading, setIsLoading] = useState(articleId !== undefined)
    const [loadError, setLoadError] = useState(false)
    const [availableCategories, setAvailableCategories] = useState<CategorySummary[]>([])
    const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<number>>(new Set())
    const [availableNewsletterLists, setAvailableNewsletterLists] = useState<
        NewsletterListSummary[]
    >([])
    const [selectedNewsletterListIds, setSelectedNewsletterListIds] = useState<Set<number>>(
        new Set(),
    )

    const {
        preview: notifyPreview,
        refresh: refreshNotifyPreview,
        retry: retryNotify,
        isRetrying: isRetryingNotify,
    } = useContentNotifyPreview(
        'article',
        article?.id ?? articleId ?? null,
        showNotify,
        `${article?.status ?? ''}:${article?.emailNotifiedAt ?? ''}:${Array.from(selectedNewsletterListIds).sort().join(',')}`,
    )

    const notifyAudienceHint = useMemo(() => {
        if (notifyPreview !== null) {
            return dict.publication.notifyAudienceCount.replace(
                '${count}',
                String(notifyPreview.estimatedRecipients),
            )
        }
        if (!showNotify || selectedNewsletterListIds.size === 0) {
            return null
        }
        const recipients = availableNewsletterLists
            .filter((list) => selectedNewsletterListIds.has(list.id))
            .reduce((sum, list) => sum + list.activeCount, 0)
        const listLabel =
            selectedNewsletterListIds.size === 1
                ? '1 Liste'
                : `${selectedNewsletterListIds.size} Listen`
        return dict.write.approxRecipients
            .replace('${listLabel}', listLabel)
            .replace('${recipients}', String(recipients))
    }, [
        availableNewsletterLists,
        dict.publication.notifyAudienceCount,
        dict.write.approxRecipients,
        notifyPreview,
        selectedNewsletterListIds,
        showNotify,
    ])

    const persistTags = useCallback(
        async (current: ArticleDetail): Promise<ArticleDetail> => {
            let updated = await replaceArticleCategories(
                current.id,
                Array.from(selectedCategoryIds),
            )
            if (showNotify) {
                updated = await replaceArticleNewsletterLists(
                    current.id,
                    Array.from(selectedNewsletterListIds),
                )
            }
            setArticle(updated)
            setSelectedCategoryIds(new Set(updated.categories.map((tag) => tag.id)))
            setSelectedNewsletterListIds(
                new Set(updated.newsletterLists.map((tag) => tag.id)),
            )
            return updated
        },
        [selectedCategoryIds, selectedNewsletterListIds, showNotify],
    )

    const saveImpl = useCallback(async (): Promise<ArticleDetail | null> => {
        const resolvedSlug = slug.trim() || suggestSlug(title) || 'beitrag'
        const payload = {
            title: title.trim() || 'Ohne Titel',
            slug: resolvedSlug,
            body,
            excerpt: excerpt.trim(),
            seoDescription: seoDescription.trim(),
            accessPolicy,
            heroAssetId: heroAssetId ?? undefined,
            // #530: 0 clears the stored floor; omitting the field would keep it.
            requiredLevelSortOrder:
                accessPolicy === 'PAID' ? (requiredLevelSortOrder ?? 0) : 0,
        }

        if (articleId === undefined) {
            const created = await createArticle(payload)
            setArticle(created)
            setSlugIndex((current) => [
                ...current,
                {id: created.id, slug: created.slug},
            ])
            routerRef.current.replace(localize(descriptor.paths.editor(created.id)))
            return created
        }

        const updated = await updateArticle(articleId, {
            ...payload,
            clearHeroAsset: heroAssetId === null,
        })
        const withTags = await persistTags(updated)
        setArticle(withTags)
        setSlugIndex((current) =>
            current.map((item) =>
                item.id === withTags.id
                    ? {id: withTags.id, slug: withTags.slug}
                    : item,
            ),
        )
        return withTags
    }, [
        accessPolicy,
        articleId,
        body,
        descriptor.paths,
        excerpt,
        heroAssetId,
        localize,
        persistTags,
        requiredLevelSortOrder,
        seoDescription,
        slug,
        title,
    ])

    const heroUpload = useCoverImageUpload({
        onUploaded: (assetId) => {
            setHeroAssetId(assetId)
            markDirty()
        },
        onError: (error) => {
            if (authRedirect(error)) return
            setWorkflowError(
                error instanceof Error ? error.message : 'Upload fehlgeschlagen.',
            )
        },
    })

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
            // Rehydrate form fields so discard-draft / over-publish don't leave
            // stale local draft text that would re-stage on the next save.
            setArticle(next)
            setTitle(next.title)
            setSlug(next.slug)
            setBody(next.body ?? '')
            setExcerpt(next.excerpt ?? '')
            setSeoDescription(next.seoDescription ?? '')
            setAccessPolicy(next.accessPolicy)
            setHeroAssetId(next.heroAssetId)
            setRequiredLevelSortOrder(next.requiredLevelSortOrder)
            applyPublicationSchedule(next.scheduledAt)
            applyPublicationPublishedAt(next.publishedAt)
            setSelectedCategoryIds(new Set(next.categories.map((tag) => tag.id)))
            setSelectedNewsletterListIds(
                new Set(next.newsletterLists.map((tag) => tag.id)),
            )
        },
        autosaveBlocked: heroUpload.isUploading,
        authRedirect,
    })

    useEffect(() => {
        mountedRef.current = true
        let active = true
        let idleHandle: number | undefined
        let timeoutHandle: ReturnType<typeof setTimeout> | undefined

        // Slug uniqueness only needs {id,slug}. Defer after first paint so
        // TipTap / media chrome are not contended by the full list download.
        const loadSlugIndex = (): void => {
            void listAllArticles()
                .then((loaded) => {
                    if (active) {
                        setSlugIndex(toSlugEntries(loaded))
                    }
                })
                .catch((error: unknown) => {
                    if (!active) {
                        return
                    }
                    authRedirect(error)
                })
        }

        if (typeof requestIdleCallback === 'function') {
            idleHandle = requestIdleCallback(() => loadSlugIndex(), {timeout: 1500})
        } else {
            timeoutHandle = setTimeout(loadSlugIndex, 0)
        }

        if (articleId === undefined) {
            Promise.all([
                listCategories(),
                showNotify
                    ? listNewsletterLists()
                    : Promise.resolve([] as NewsletterListSummary[]),
            ])
                .then(([categoryList, newsletterLists]) => {
                    if (active) {
                        setAvailableCategories(categoryList.filter((item) => item.active))
                        setAvailableNewsletterLists(
                            newsletterLists.filter((item) => item.status === 'ACTIVE'),
                        )
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
                if (idleHandle !== undefined && typeof cancelIdleCallback === 'function') {
                    cancelIdleCallback(idleHandle)
                }
                if (timeoutHandle !== undefined) {
                    clearTimeout(timeoutHandle)
                }
            }
        }

        const resolvedArticleId = articleId

        async function load(): Promise<void> {
            try {
                const [categoryList, newsletterLists, loaded] = await Promise.all([
                    listCategories(),
                    showNotify
                        ? listNewsletterLists()
                        : Promise.resolve([] as NewsletterListSummary[]),
                    getArticle(resolvedArticleId),
                ])
                if (!active) {
                    return
                }
                setAvailableCategories(categoryList.filter((item) => item.active))
                setAvailableNewsletterLists(
                    newsletterLists.filter((item) => item.status === 'ACTIVE'),
                )
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
                setSelectedNewsletterListIds(
                    new Set(loaded.newsletterLists.map((tag) => tag.id)),
                )
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
            if (idleHandle !== undefined && typeof cancelIdleCallback === 'function') {
                cancelIdleCallback(idleHandle)
            }
            if (timeoutHandle !== undefined) {
                clearTimeout(timeoutHandle)
            }
        }
    }, [articleId, authRedirect, setWorkflowError, showNotify])

    useEffect(() => {
        let active = true

        if (heroAssetId === null) {
            setHeroPreviewUrl(null)
            return
        }

        getMediaPreviewUrl(heroAssetId)
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
        routerRef.current.replace(localize('/login'))
    }, [localize])

    const handleHeroUpload = useCallback(
        (file: File | null): Promise<void> => {
            setWorkflowError(null)
            return heroUpload.upload(file)
        },
        [heroUpload, setWorkflowError],
    )

    const slugTaken = useCallback(
        (candidate: string) => isSlugTaken(slugIndex, candidate, articleId),
        [slugIndex, articleId],
    )
    /** Saving and hero uploads share one busy flag so a manual save cannot
     * persist the article while the hero image is still uploading. */
    const busy = isSaving || heroUpload.isUploading
    const readOnly = !desk.canEdit

    const publishBlockedReason = articlePublishBlockReason({title, body})
    const publishedUrl = useMemo(() => {
        if (article?.status !== 'PUBLISHED') {
            return null
        }
        return publicArticlePageUrl(config.publicSiteUrl, article.slug)
    }, [article, config.publicSiteUrl])

    const markDirtyAnd = useCallback(
        (apply: () => void) => {
            apply()
            markDirty()
        },
        [markDirty],
    )

    return {
        descriptor,
        isLoading,
        gate: null,
        aboveEditor: null,
        wrapInPageStack: false,
        publication: article,
        publicationId: articleId,
        title,
        slug,
        body,
        excerpt,
        seoDescription,
        accessPolicy,
        requiredLevelSortOrder,
        onRequiredLevelChange: (value) => {
            markDirtyAnd(() => setRequiredLevelSortOrder(value))
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
        setErrorMessage: setWorkflowError,
        saveHint,
        isDirty,
        busy,
        save,
        runWorkflow,
        desk,
        publishBlockedReason,
        showNotify,
        notifyAudienceHint,
        notifyPreview,
        onRetryNotify: () => {
            void retryNotify()
                .then(() => refreshNotifyPreview())
                .catch(() => undefined)
        },
        isRetryingNotify,
        previewImageUrl: heroPreviewUrl,
        previewExcerpt: excerpt,
        previewUrl:
            publishedUrl ??
            publicArticlePageUrl(
                config.publicSiteUrl,
                slug.trim() || suggestSlug(title) || 'beitrag',
            ),
        publishedLinks:
            publishedUrl !== null
                ? [{label: 'Beitragsseite', url: publishedUrl}]
                : null,
        slugTaken,
        onAuthRequired: handleAuthRequired,
        onTitleChange: (value) => {
            setTitle(value)
            markDirty()
            if (articleId === undefined && slug.trim().length === 0) {
                setSlug(suggestSlug(value))
            }
        },
        onBodyChange: (value) => {
            markDirtyAnd(() => setBody(value))
        },
        onAccessPolicyChange: (value) => {
            markDirtyAnd(() => setAccessPolicy(value))
        },
        onSlugChange: (value) => {
            markDirtyAnd(() => setSlug(value))
        },
        onExcerptChange: (value) => {
            markDirtyAnd(() => setExcerpt(value))
        },
        onSeoDescriptionChange: (value) => {
            markDirtyAnd(() => setSeoDescription(value))
        },
        sidebarExtra: (
            <ArticleEditorSidebar
                title={title}
                heroAssetId={heroAssetId}
                heroPreviewUrl={heroPreviewUrl}
                busy={busy}
                readOnly={readOnly}
                isSaving={isSaving}
                isHeroUploading={heroUpload.isUploading}
                heroUploadProgress={heroUpload.uploadProgress}
                showNotify={showNotify}
                notifySubscribers={notifySubscribers}
                availableCategories={availableCategories}
                selectedCategoryIds={selectedCategoryIds}
                availableNewsletterLists={availableNewsletterLists}
                selectedNewsletterListIds={selectedNewsletterListIds}
                showClassification={article !== null}
                onAuthRequired={handleAuthRequired}
                onHeroUpload={handleHeroUpload}
                onHeroSelect={(assetId) => {
                    markDirtyAnd(() => setHeroAssetId(assetId))
                }}
                onHeroClear={() => {
                    markDirtyAnd(() => setHeroAssetId(null))
                }}
                onCategoryChange={(ids) => {
                    markDirtyAnd(() => setSelectedCategoryIds(ids))
                }}
                onNewsletterChange={(ids) => {
                    markDirtyAnd(() => setSelectedNewsletterListIds(ids))
                }}
            />
        ),
        onDeleted: () => router.replace(localize(descriptor.paths.list)),
    }
}
