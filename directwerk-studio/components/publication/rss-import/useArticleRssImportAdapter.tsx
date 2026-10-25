'use client'

import {useEffect, useLayoutEffect, useRef, useState} from 'react'

import {Button} from '@directwerk/ui/components/button'
import {Input} from '@directwerk/ui/components/input'
import {Textarea} from '@directwerk/ui/components/textarea'
import SectionHeader from '@directwerk/ui/components/section-header'

import {createCategory, listCategories} from '@/lib/api/catalogApi'
import {
    bulkImportArticleRss,
    importRssArticle,
    previewArticleRssFeed,
} from '@/lib/api/articleImportApi'
import {isTenantAdminRole, suggestSlug} from '@/lib/api/studioHelpers'
import {useOptionalMe} from '@/lib/auth/MeProvider'
import {HTML_SLUG_PATTERN} from '@directwerk/api/constants'
import {useAuthRequired} from '@directwerk/api/auth/useAuthRequired'
import type {
    ArticleRssImportItemPreview,
    ArticleRssImportPreview,
    CategorySummary,
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
    {id: 'categories', label: '2. Kategorien'},
    {id: 'article', label: '3. Beiträge'},
    {id: 'done', label: '4. Fertig'},
] as const

function articleLabels(dict: Dictionary) {
    return {
        eyebrow: dict.shell.home.writeDesk,
        title: dict.common.rssImport,
        description: dict.write.importFeedIntro,
        urlTitle: dict.write.feedAdresse,
        urlDescription: dict.write.publicRssUrlHint,
        urlPlaceholder: 'https://beispiel.de/rss.xml',
        urlSubmit: 'Feed prüfen',
        urlSubmitBusy: 'Wird gelesen…',
        prerequisitesLoading: 'Import wird vorbereitet…',
        prerequisitesReload: 'Erneut versuchen',
        itemImportLabel: 'Diesen Beitrag importieren',
        itemImportBusy: 'Wird importiert…',
        itemBackLabel: 'Zurück zu Kategorien',
        doneListHref: '/write/articles',
        doneListLabel: 'Zur Beitragsliste',
        bulkImportStartedTitle: dict.write.bulkImportStarted,
        importFinishedTitle: dict.write.importFinished,
        serverSideTransfer: dict.write.serverSideTransfer,
        accessFree: dict.common.access.free,
        accessPaid: dict.common.access.paid,
        allFree: dict.write.allFree,
        allPaid: dict.write.allPaid,
        previewErrorFallback: 'Feed konnte nicht gelesen werden.',
        importErrorFallback: 'Beitrag konnte nicht importiert werden.',
    }
}

export function useArticleRssImportAdapter(): RssImportContentAdapter {
    const authRedirect = useAuthRequired()
    const authRedirectRef = useRef(authRedirect)
    useLayoutEffect(() => {
        authRedirectRef.current = authRedirect
    }, [authRedirect])
    const me = useOptionalMe()
    const canCreateCategories = me !== null && isTenantAdminRole(me.roles)

    const [preview, setPreview] = useState<ArticleRssImportPreview | null>(null)
    const [categories, setCategories] = useState<CategorySummary[]>([])
    const [defaultCategoryIds, setDefaultCategoryIds] = useState<Set<number>>(new Set())
    const [articleCategoryIds, setArticleCategoryIds] = useState<Set<number>>(new Set())
    const [newCategoryName, setNewCategoryName] = useState('')
    const [articleIndex, setArticleIndex] = useState(0)
    const [articleTitle, setArticleTitle] = useState('')
    const [articleSlug, setArticleSlug] = useState('')
    const [articleBody, setArticleBody] = useState('')
    const [articleExcerpt, setArticleExcerpt] = useState('')
    const [importHero, setImportHero] = useState(true)
    const [importInlineImages, setImportInlineImages] = useState(true)
    const [prerequisitesStatus, setPrerequisitesStatus] = useState<
        'loading' | 'ready' | 'error'
    >('loading')
    const [prerequisitesError, setPrerequisitesError] = useState<string | null>(null)
    const [prerequisitesReload, setPrerequisitesReload] = useState(0)

    useEffect(() => {
        let active = true
        setPrerequisitesStatus('loading')
        setPrerequisitesError(null)
        listCategories()
            .then((loaded) => {
                if (!active) {
                    return
                }
                setCategories(loaded.filter((item) => item.active))
                setPrerequisitesStatus('ready')
            })
            .catch((error: unknown) => {
                if (!active) {
                    return
                }
                if (authRedirectRef.current(error)) {
                    return
                }
                setPrerequisitesStatus('error')
                setPrerequisitesError(
                    error instanceof Error
                        ? error.message
                        : 'Kategorien konnten nicht geladen werden.',
                )
            })
        return () => {
            active = false
        }
    }, [prerequisitesReload])

    function applyArticle(
        item: ArticleRssImportItemPreview,
        categoryIds = defaultCategoryIds,
    ): void {
        setArticleTitle(item.title)
        setArticleSlug(item.suggestedSlug)
        setArticleBody(item.body ?? '')
        setArticleExcerpt(item.excerpt ?? '')
        setArticleCategoryIds(new Set(categoryIds))
        setImportHero(item.imageUrl != null)
    }

    async function ensureDefaultCategoryIds(): Promise<Set<number>> {
        const next = new Set(defaultCategoryIds)
        const name = canCreateCategories ? newCategoryName.trim() : ''
        if (name.length > 0) {
            const created = await createCategory({
                slug: suggestSlug(name) || 'kategorie',
                name,
            })
            setCategories((current) => [...current, created])
            next.add(created.id)
            setDefaultCategoryIds(next)
            setNewCategoryName('')
        }
        return next
    }

    const currentArticle = preview?.articles[articleIndex] ?? null
    const bulkAlreadyImportedCount =
        preview?.articles.filter((article) => article.alreadyImportedArticleId !== null).length ??
        0
    const bulkPendingCount = (preview?.articles.length ?? 0) - bulkAlreadyImportedCount

    return {
        steps: STEPS,
        afterPreviewStepId: 'categories',
        itemStepId: 'article',
        itemBackStepId: 'categories',
        prerequisitesMode: 'gate',
        labels: articleLabels,
        prerequisitesStatus,
        prerequisitesError,
        reloadPrerequisites: () => setPrerequisitesReload((n) => n + 1),
        previewFeed: async (feedUrl) => {
            const next = await previewArticleRssFeed(feedUrl)
            setPreview(next)
        },
        itemIndex: articleIndex,
        itemCount: preview?.articles.length ?? 0,
        currentAlreadyImportedId: currentArticle?.alreadyImportedArticleId ?? null,
        currentOpenHref:
            currentArticle?.alreadyImportedArticleId != null
                ? `/write/articles/${currentArticle.alreadyImportedArticleId}`
                : null,
        bulkPendingCount,
        bulkAlreadyImportedCount,
        itemHeading: (index, total) => `Beitrag ${index + 1} von ${total}`,
        itemDescription: (remaining) =>
            `${remaining} noch offen. Titelbilder werden einzeln nach S3 gestreamt; Bilder im Text übernimmt der Server.`,
        alreadyImportedMessage: 'Dieser Beitrag wurde bereits importiert.',
        announceStep: undefined,
        formatManualDoneDescription: (imported, alreadyImported, skipped) =>
            `${imported} Beiträge importiert, ${alreadyImported} bereits vorhanden, ${skipped} übersprungen. Entwürfe kannst du jetzt prüfen und veröffentlichen.`,
        formatBulkDoneDescription: (result) =>
            `${result.queuedCount} Beiträge sind in der Warteschlange (${result.alreadyImported} bereits vorhanden). Du erhältst eine E-Mail an ${result.notifyEmail}, sobald der Import fertig ist. Entwürfe kannst du danach prüfen und veröffentlichen.`,
        goToItem: (nextIndex) => {
            if (preview == null || nextIndex >= preview.articles.length) {
                return 'done'
            }
            applyArticle(preview.articles[nextIndex])
            setArticleIndex(nextIndex)
            return 'item'
        },
        noteSkip: () => {
            const item = preview?.articles[articleIndex]
            return item?.alreadyImportedArticleId != null ? 'already' : 'skipped'
        },
        importCurrentItem: async (chrome) => {
            if (preview == null || currentArticle == null) {
                throw new Error('Beitrag konnte nicht importiert werden.')
            }
            const item = currentArticle
            // Hero ingest stays server-side (same transaction as article create) so a
            // failed / alreadyImported response never leaves client-owned orphan assets.
            chrome.setStreamProgress(
                importHero && item.imageUrl != null
                    ? {label: 'Titelbild + Beitrag…', progress: null}
                    : {label: 'Beitrag wird angelegt…', progress: 100},
            )
            try {
                const result = await importRssArticle({
                    feedUrl: preview.feedUrl,
                    guid: item.guid,
                    slug: articleSlug.trim() || item.suggestedSlug,
                    title: articleTitle.trim() || item.title,
                    body: articleBody,
                    excerpt: articleExcerpt.trim() || undefined,
                    accessPolicy: chrome.accessPolicy,
                    requiredLevelSortOrder:
                        chrome.accessPolicy === 'PAID'
                            ? (chrome.requiredLevelSortOrder ?? undefined)
                            : undefined,
                    categoryIds: Array.from(articleCategoryIds),
                    imageUrl: importHero ? (item.imageUrl ?? undefined) : undefined,
                    importHero,
                    importInlineImages,
                    publishedAt: item.publishedAt ?? undefined,
                })
                return result.alreadyImported ? 'already' : 'imported'
            } catch (error) {
                throw error instanceof Error
                    ? error
                    : new Error('Beitrag konnte nicht importiert werden.')
            }
        },
        resetTypeState: () => {
            setPreview(null)
            setDefaultCategoryIds(new Set())
            setArticleCategoryIds(new Set())
            setNewCategoryName('')
            setArticleIndex(0)
            setArticleTitle('')
            setArticleSlug('')
            setArticleBody('')
            setArticleExcerpt('')
            setImportHero(true)
            setImportInlineImages(true)
        },
        renderContextSteps: (chrome) => {
            if (chrome.step !== 'categories' || preview === null) {
                return null
            }
            return (
                <CategoriesStep
                    preview={preview}
                    categories={categories}
                    defaultCategoryIds={defaultCategoryIds}
                    setDefaultCategoryIds={setDefaultCategoryIds}
                    newCategoryName={newCategoryName}
                    setNewCategoryName={setNewCategoryName}
                    canCreateCategories={canCreateCategories}
                    bulkPendingCount={bulkPendingCount}
                    bulkAlreadyImportedCount={bulkAlreadyImportedCount}
                    importHero={importHero}
                    setImportHero={setImportHero}
                    importInlineImages={importInlineImages}
                    setImportInlineImages={setImportInlineImages}
                    chrome={chrome}
                    ensureDefaultCategoryIds={ensureDefaultCategoryIds}
                    applyArticle={applyArticle}
                    setArticleIndex={setArticleIndex}
                />
            )
        },
        renderItemFields: (chrome) => {
            if (currentArticle == null) {
                return null
            }
            return (
                <ArticleItemFields
                    chrome={chrome}
                    articleTitle={articleTitle}
                    setArticleTitle={setArticleTitle}
                    articleSlug={articleSlug}
                    setArticleSlug={setArticleSlug}
                    articleExcerpt={articleExcerpt}
                    setArticleExcerpt={setArticleExcerpt}
                    articleBody={articleBody}
                    setArticleBody={setArticleBody}
                    importHero={importHero}
                    setImportHero={setImportHero}
                    importInlineImages={importInlineImages}
                    setImportInlineImages={setImportInlineImages}
                    currentArticle={currentArticle}
                    categories={categories}
                    articleCategoryIds={articleCategoryIds}
                    setArticleCategoryIds={setArticleCategoryIds}
                />
            )
        },
    }
}

function CategoriesStep({
    preview,
    categories,
    defaultCategoryIds,
    setDefaultCategoryIds,
    newCategoryName,
    setNewCategoryName,
    canCreateCategories,
    bulkPendingCount,
    bulkAlreadyImportedCount,
    importHero,
    setImportHero,
    importInlineImages,
    setImportInlineImages,
    chrome,
    ensureDefaultCategoryIds,
    applyArticle,
    setArticleIndex,
}: {
    preview: ArticleRssImportPreview
    categories: CategorySummary[]
    defaultCategoryIds: Set<number>
    setDefaultCategoryIds: (ids: Set<number>) => void
    newCategoryName: string
    setNewCategoryName: (value: string) => void
    canCreateCategories: boolean
    bulkPendingCount: number
    bulkAlreadyImportedCount: number
    importHero: boolean
    setImportHero: (value: boolean) => void
    importInlineImages: boolean
    setImportInlineImages: (value: boolean) => void
    chrome: RssImportSharedChrome & {
        step: string
        setStep: (step: string) => void
        onBulkQueued: (result: {
            queuedCount: number
            alreadyImported: number
            notifyEmail: string
        }) => void
        finishWizard: () => void
    }
    ensureDefaultCategoryIds: () => Promise<Set<number>>
    applyArticle: (item: ArticleRssImportItemPreview, categoryIds?: Set<number>) => void
    setArticleIndex: (index: number) => void
}): React.JSX.Element {
    const {dict, busy, setBusy, setErrorMessage, authRedirect} = chrome

    async function handleCategoriesContinue(): Promise<void> {
        setErrorMessage(null)
        setBusy(true)
        try {
            const nextDefaults = await ensureDefaultCategoryIds()
            if (preview.articles.length > 0) {
                applyArticle(preview.articles[0], nextDefaults)
                setArticleIndex(0)
                chrome.setStep('article')
            } else {
                chrome.finishWizard()
            }
        } catch (error) {
            if (authRedirect(error)) {
                return
            }
            setErrorMessage(
                error instanceof Error ? error.message : 'Kategorie konnte nicht angelegt werden.',
            )
        } finally {
            setBusy(false)
        }
    }

    async function handleBulkImport(): Promise<void> {
        setErrorMessage(null)
        setBusy(true)
        try {
            const nextDefaults = await ensureDefaultCategoryIds()
            const queued = await bulkImportArticleRss({
                feedUrl: preview.feedUrl,
                categoryIds: Array.from(nextDefaults),
                accessPolicy: chrome.accessPolicy,
                requiredLevelSortOrder:
                    chrome.accessPolicy === 'PAID'
                        ? (chrome.requiredLevelSortOrder ?? undefined)
                        : undefined,
                importHero,
                importInlineImages,
            })
            chrome.onBulkQueued({
                queuedCount: queued.totalArticles - queued.alreadyImported,
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
                title={preview.channel.title}
                description={`${preview.articles.length} Beiträge gefunden. Optional Kategorien zuweisen — oder direkt weiter.`}
            />
            {categories.length > 0 ? (
                <IdCheckboxList
                    items={categories}
                    selectedIds={defaultCategoryIds}
                    onChange={setDefaultCategoryIds}
                    disabled={busy}
                />
            ) : (
                <p className="text-sm text-muted-foreground">Noch keine Kategorien vorhanden.</p>
            )}
            <OptionalCreateNameField
                canCreate={canCreateCategories}
                label="Neue Kategorie anlegen (optional)"
                placeholder={dict.write.zBKolumne}
                value={newCategoryName}
                onChange={setNewCategoryName}
                disabled={busy}
            />
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
                <Button disabled={busy} onClick={() => void handleCategoriesContinue()}>
                    {busy ? 'Wird gespeichert…' : 'Weiter zu den Beiträgen'}
                </Button>
            </div>
            {preview.articles.length > 0 ? (
                <BulkImportPanel
                    pendingCount={bulkPendingCount}
                    alreadyImportedCount={bulkAlreadyImportedCount}
                    itemNounPlural="Beiträge"
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
                        ariaLabel={dict.write.accessForAllArticles}
                        freeLabel={dict.write.allFree}
                        paidLabel={dict.write.allPaid}
                        levelLabel="Mindest-Stufe für alle"
                    />
                    <label className="flex items-center gap-2 text-sm">
                        <input
                            checked={importHero}
                            disabled={busy}
                            onChange={(event) => setImportHero(event.target.checked)}
                            type="checkbox"
                        />
                        Titelbilder nach S3 streamen
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                        <input
                            checked={importInlineImages}
                            disabled={busy}
                            onChange={(event) => setImportInlineImages(event.target.checked)}
                            type="checkbox"
                        />
                        Bilder im Text nach S3 streamen
                    </label>
                </BulkImportPanel>
            ) : null}
        </section>
    )
}

function ArticleItemFields({
    chrome,
    articleTitle,
    setArticleTitle,
    articleSlug,
    setArticleSlug,
    articleExcerpt,
    setArticleExcerpt,
    articleBody,
    setArticleBody,
    importHero,
    setImportHero,
    importInlineImages,
    setImportInlineImages,
    currentArticle,
    categories,
    articleCategoryIds,
    setArticleCategoryIds,
}: {
    chrome: RssImportSharedChrome
    articleTitle: string
    setArticleTitle: (value: string) => void
    articleSlug: string
    setArticleSlug: (value: string) => void
    articleExcerpt: string
    setArticleExcerpt: (value: string) => void
    articleBody: string
    setArticleBody: (value: string) => void
    importHero: boolean
    setImportHero: (value: boolean) => void
    importInlineImages: boolean
    setImportInlineImages: (value: boolean) => void
    currentArticle: ArticleRssImportItemPreview
    categories: CategorySummary[]
    articleCategoryIds: Set<number>
    setArticleCategoryIds: (ids: Set<number>) => void
}): React.JSX.Element {
    const {busy, dict} = chrome
    return (
        <>
            <label className="grid gap-1.5">
                <span className="text-sm font-medium">Titel</span>
                <Input
                    disabled={busy}
                    maxLength={255}
                    onChange={(event) => setArticleTitle(event.target.value)}
                    value={articleTitle}
                />
            </label>
            <label className="grid gap-1.5">
                <span className="text-sm font-medium">Slug</span>
                <Input
                    disabled={busy}
                    maxLength={64}
                    onChange={(event) => setArticleSlug(event.target.value)}
                    pattern={HTML_SLUG_PATTERN}
                    value={articleSlug}
                />
            </label>
            <label className="grid gap-1.5">
                <span className="text-sm font-medium">Teaser</span>
                <Textarea
                    disabled={busy}
                    onChange={(event) => setArticleExcerpt(event.target.value)}
                    rows={3}
                    value={articleExcerpt}
                />
            </label>
            <label className="grid gap-1.5">
                <span className="text-sm font-medium">Text</span>
                <Textarea
                    disabled={busy}
                    onChange={(event) => setArticleBody(event.target.value)}
                    rows={8}
                    value={articleBody}
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
            />
            <label className="flex items-center gap-2 text-sm">
                <input
                    checked={importHero}
                    disabled={busy || currentArticle.imageUrl == null}
                    onChange={(event) => setImportHero(event.target.checked)}
                    type="checkbox"
                />
                Titelbild nach S3 streamen
            </label>
            <label className="flex items-center gap-2 text-sm">
                <input
                    checked={importInlineImages}
                    disabled={busy}
                    onChange={(event) => setImportInlineImages(event.target.checked)}
                    type="checkbox"
                />
                Bilder im Text nach S3 streamen
            </label>
            {categories.length > 0 ? (
                <IdCheckboxList
                    items={categories}
                    selectedIds={articleCategoryIds}
                    onChange={setArticleCategoryIds}
                    disabled={busy}
                />
            ) : null}
        </>
    )
}
