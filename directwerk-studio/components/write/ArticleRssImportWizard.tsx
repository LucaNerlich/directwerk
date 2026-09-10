'use client'

import Link from 'next/link'
import {useEffect, useRef, useState} from 'react'

import {Button} from '@directwerk/ui/components/button'
import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Input} from '@directwerk/ui/components/input'
import {Textarea} from '@directwerk/ui/components/textarea'
import PageHeader from '@directwerk/ui/components/page-header'
import PageStack from '@directwerk/ui/components/page-stack'
import SectionHeader from '@directwerk/ui/components/section-header'

import SelectControl from '@/components/studio/SelectControl'
import LevelSelect from '@/components/studio/LevelSelect'
import StreamProgress from '@/components/media/StreamProgress'
import {createCategory, listCategories} from '@/lib/api/catalogApi'
import {
    bulkImportArticleRss,
    importRssArticle,
    previewArticleRssFeed,
} from '@/lib/api/articleImportApi'
import {ingestRemoteAssetWithProgress} from '@/lib/media/remoteIngest'
import {filenameFromImportUrl} from '@/lib/media/importFilename'
import {deleteMedia} from '@/lib/api/mediaApi'
import {isTenantAdminRole, suggestSlug} from '@/lib/api/studioHelpers'
import {useOptionalMe} from '@/lib/auth/MeProvider'
import {HTML_SLUG_PATTERN} from '@directwerk/api/constants'
import type {
    AccessPolicy,
    ArticleBulkImportQueuedResult,
    ArticleRssImportItemPreview,
    ArticleRssImportPreview,
    CategorySummary,
} from '@directwerk/api/types'
import {getClientTenantHost} from '@directwerk/api/tenant'
import {useAuthRequired} from '@directwerk/api/auth/useAuthRequired'

type WizardStep = 'url' | 'categories' | 'article' | 'done'

export default function ArticleRssImportWizard(): React.JSX.Element {
    const authRedirect = useAuthRequired()
    const authRedirectRef = useRef(authRedirect)
    authRedirectRef.current = authRedirect
    const me = useOptionalMe()
    const canCreateCategories = me !== null && isTenantAdminRole(me.roles)
    const [step, setStep] = useState<WizardStep>('url')
    const [feedUrl, setFeedUrl] = useState('')
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
    const [accessPolicy, setAccessPolicy] = useState<AccessPolicy>('FREE')
    const [requiredLevelSortOrder, setRequiredLevelSortOrder] = useState<number | null>(null)
    const [importHero, setImportHero] = useState(true)
    const [importInlineImages, setImportInlineImages] = useState(true)
    const [importedCount, setImportedCount] = useState(0)
    const [skippedCount, setSkippedCount] = useState(0)
    const [alreadyImportedCount, setAlreadyImportedCount] = useState(0)
    const [bulkResult, setBulkResult] = useState<ArticleBulkImportQueuedResult | null>(null)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [streamProgress, setStreamProgress] = useState<{
        label: string
        progress: number | null
    } | null>(null)
    const [busy, setBusy] = useState(false)
    const [prerequisitesStatus, setPrerequisitesStatus] = useState<'loading' | 'ready' | 'error'>(
        'loading',
    )
    const [prerequisitesError, setPrerequisitesError] = useState<string | null>(null)
    const [prerequisitesReload, setPrerequisitesReload] = useState(0)

    useEffect(() => {
        let active = true
        setPrerequisitesStatus('loading')
        setPrerequisitesError(null)
        listCategories(getClientTenantHost())
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
                    error instanceof Error ? error.message : 'Kategorien konnten nicht geladen werden.',
                )
            })
        return () => {
            active = false
        }
    }, [prerequisitesReload])

    function applyArticle(item: ArticleRssImportItemPreview, categoryIds = defaultCategoryIds): void {
        setArticleTitle(item.title)
        setArticleSlug(item.suggestedSlug)
        setArticleBody(item.body ?? '')
        setArticleExcerpt(item.excerpt ?? '')
        setArticleCategoryIds(new Set(categoryIds))
        setImportHero(item.imageUrl != null)
    }

    async function handlePreview(): Promise<void> {
        setErrorMessage(null)
        setBusy(true)
        try {
            const next = await previewArticleRssFeed(getClientTenantHost(), feedUrl.trim())
            setPreview(next)
            setStep('categories')
        } catch (error) {
            if (authRedirect(error)) {
                return
            }
            setErrorMessage(error instanceof Error ? error.message : 'Feed konnte nicht gelesen werden.')
        } finally {
            setBusy(false)
        }
    }

    async function ensureDefaultCategoryIds(): Promise<Set<number>> {
        const next = new Set(defaultCategoryIds)
        const name = canCreateCategories ? newCategoryName.trim() : ''
        if (name.length > 0) {
            const created = await createCategory(getClientTenantHost(), {
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

    async function handleCategoriesContinue(): Promise<void> {
        setErrorMessage(null)
        setBusy(true)
        try {
            const nextDefaults = await ensureDefaultCategoryIds()
            if (preview != null && preview.articles.length > 0) {
                applyArticle(preview.articles[0], nextDefaults)
                setArticleIndex(0)
                setStep('article')
            } else {
                setStep('done')
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
        if (preview == null) {
            return
        }
        setErrorMessage(null)
        setBusy(true)
        try {
            const nextDefaults = await ensureDefaultCategoryIds()
            const queued = await bulkImportArticleRss(getClientTenantHost(), {
                feedUrl: preview.feedUrl,
                categoryIds: Array.from(nextDefaults),
                accessPolicy,
                requiredLevelSortOrder:
                    accessPolicy === 'PAID' ? (requiredLevelSortOrder ?? undefined) : undefined,
                importHero,
                importInlineImages,
            })
            setBulkResult(queued)
            setStep('done')
        } catch (error) {
            if (authRedirect(error)) {
                return
            }
            setErrorMessage(
                error instanceof Error ? error.message : 'Stapelimport konnte nicht gestartet werden.',
            )
        } finally {
            setBusy(false)
        }
    }

    function goToArticle(nextIndex: number): void {
        setErrorMessage(null)
        if (preview == null || nextIndex >= preview.articles.length) {
            setStep('done')
            return
        }
        applyArticle(preview.articles[nextIndex])
        setArticleIndex(nextIndex)
        setStep('article')
    }

    async function handleImportArticle(): Promise<void> {
        if (preview == null) {
            return
        }
        const item = preview.articles[articleIndex]
        setErrorMessage(null)
        setStreamProgress(null)
        setBusy(true)
        const host = getClientTenantHost()
        let heroAssetId: number | undefined
        try {
            if (importHero && item.imageUrl != null) {
                const hero = await ingestRemoteAssetWithProgress(
                    host,
                    {
                        sourceUrl: item.imageUrl,
                        assetType: 'IMAGE',
                        visibility: 'PUBLIC',
                        filename: filenameFromImportUrl(
                            item.imageUrl,
                            'hero.jpg',
                            suggestSlug(articleTitle.trim() || item.title) || undefined,
                        ),
                    },
                    (progress) => {
                        setStreamProgress({label: 'Titelbild', progress})
                    },
                    {desk: 'articles'},
                )
                heroAssetId = hero.id
            }

            setStreamProgress({label: 'Beitrag wird angelegt…', progress: 100})
            const result = await importRssArticle(host, {
                feedUrl: preview.feedUrl,
                guid: item.guid,
                slug: articleSlug.trim() || item.suggestedSlug,
                title: articleTitle.trim() || item.title,
                body: articleBody,
                excerpt: articleExcerpt.trim() || undefined,
                accessPolicy,
                requiredLevelSortOrder:
                    accessPolicy === 'PAID' ? (requiredLevelSortOrder ?? undefined) : undefined,
                categoryIds: Array.from(articleCategoryIds),
                heroAssetId,
                importHero: false,
                importInlineImages,
                publishedAt: item.publishedAt ?? undefined,
            })
            if (result.alreadyImported) {
                setAlreadyImportedCount((count) => count + 1)
            } else {
                setImportedCount((count) => count + 1)
            }
            goToArticle(articleIndex + 1)
        } catch (error) {
            if (heroAssetId !== undefined) {
                await Promise.allSettled([deleteMedia(host, heroAssetId)])
            }
            if (authRedirect(error)) {
                return
            }
            setErrorMessage(
                error instanceof Error ? error.message : 'Beitrag konnte nicht importiert werden.',
            )
        } finally {
            setStreamProgress(null)
            setBusy(false)
        }
    }

    function handleSkipArticle(): void {
        const item = preview?.articles[articleIndex]
        if (item?.alreadyImportedArticleId != null) {
            setAlreadyImportedCount((count) => count + 1)
        } else {
            setSkippedCount((count) => count + 1)
        }
        goToArticle(articleIndex + 1)
    }

    function resetWizard(): void {
        setStep('url')
        setFeedUrl('')
        setPreview(null)
        setDefaultCategoryIds(new Set())
        setArticleCategoryIds(new Set())
        setNewCategoryName('')
        setArticleIndex(0)
        setArticleTitle('')
        setArticleSlug('')
        setArticleBody('')
        setArticleExcerpt('')
        setAccessPolicy('FREE')
        setRequiredLevelSortOrder(null)
        setImportHero(true)
        setImportInlineImages(true)
        setImportedCount(0)
        setSkippedCount(0)
        setAlreadyImportedCount(0)
        setBulkResult(null)
        setErrorMessage(null)
        setStreamProgress(null)
        setBusy(false)
    }

    const currentArticle = preview?.articles[articleIndex] ?? null
    const remaining = preview == null ? 0 : preview.articles.length - articleIndex
    const bulkAlreadyImportedCount =
        preview?.articles.filter((article) => article.alreadyImportedArticleId !== null).length ?? 0
    const bulkPendingCount = (preview?.articles.length ?? 0) - bulkAlreadyImportedCount

    if (prerequisitesStatus === 'loading') {
        return (
            <p className="text-sm text-muted-foreground" role="status">
                Import wird vorbereitet…
            </p>
        )
    }

    if (prerequisitesStatus === 'error') {
        return (
            <PageStack>
                <Alert variant="destructive">
                    <AlertDescription>{prerequisitesError}</AlertDescription>
                </Alert>
                <Button onClick={() => setPrerequisitesReload((n) => n + 1)} type="button" variant="outline">
                    Erneut versuchen
                </Button>
            </PageStack>
        )
    }

    return (
        <PageStack>
            <PageHeader
                eyebrow="Schreiben"
                title="RSS-Import"
                description="Bestehenden Artikel-Feed übernehmen: optional Kategorien, dann Beiträge einzeln oder als Hintergrund-Job. Bilder werden nach S3 gestreamt."
            />

            <ol className="flex flex-wrap gap-2 text-xs font-medium text-muted-foreground">
                {[
                    ['url', '1. Feed'],
                    ['categories', '2. Kategorien'],
                    ['article', '3. Beiträge'],
                    ['done', '4. Fertig'],
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

            {errorMessage !== null ? (
                <Alert variant="destructive">
                    <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
            ) : null}
            {streamProgress !== null ? (
                <StreamProgress
                    className="max-w-2xl rounded-xl border bg-muted/40 p-4"
                    detail="Serverseitiger Transfer — nicht über den Browser."
                    label={streamProgress.label}
                    progress={streamProgress.progress}
                />
            ) : null}

            {step === 'url' ? (
                <section className="flex max-w-2xl flex-col gap-4">
                    <SectionHeader
                        title="Feed-Adresse"
                        description="Öffentliche RSS-URL deines bisherigen Blogs oder CMS. Wir lesen nur die Metadaten — noch keine Bilder."
                    />
                    <label className="grid gap-1.5">
                        <span className="text-sm font-medium">RSS-URL</span>
                        <Input
                            disabled={busy}
                            onChange={(event) => setFeedUrl(event.target.value)}
                            placeholder="https://beispiel.de/rss.xml"
                            type="url"
                            value={feedUrl}
                        />
                    </label>
                    <Button disabled={busy || feedUrl.trim().length === 0} onClick={() => void handlePreview()}>
                        {busy ? 'Wird gelesen…' : 'Feed prüfen'}
                    </Button>
                </section>
            ) : null}

            {step === 'categories' && preview !== null ? (
                <section className="flex max-w-2xl flex-col gap-4">
                    <SectionHeader
                        title={preview.channel.title}
                        description={`${preview.articles.length} Beiträge gefunden. Optional Kategorien zuweisen — oder direkt weiter.`}
                    />
                    {categories.length > 0 ? (
                        <ul className="grid gap-2">
                            {categories.map((category) => (
                                <li key={category.id}>
                                    <label className="flex items-center gap-2 text-sm">
                                        <input
                                            checked={defaultCategoryIds.has(category.id)}
                                            disabled={busy}
                                            onChange={(event) => {
                                                const next = new Set(defaultCategoryIds)
                                                if (event.target.checked) {
                                                    next.add(category.id)
                                                } else {
                                                    next.delete(category.id)
                                                }
                                                setDefaultCategoryIds(next)
                                            }}
                                            type="checkbox"
                                        />
                                        {category.name}
                                    </label>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-sm text-muted-foreground">Noch keine Kategorien vorhanden.</p>
                    )}
                    {canCreateCategories ? (
                        <label className="grid gap-1.5">
                            <span className="text-sm font-medium">Neue Kategorie anlegen (optional)</span>
                            <Input
                                disabled={busy}
                                maxLength={255}
                                onChange={(event) => setNewCategoryName(event.target.value)}
                                placeholder="z. B. Kolumne"
                                value={newCategoryName}
                            />
                        </label>
                    ) : null}
                    <div className="flex gap-2">
                        <Button
                            disabled={busy}
                            onClick={() => {
                                setErrorMessage(null)
                                setStep('url')
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
                        <div className="grid gap-3 rounded-xl border bg-muted/20 p-4">
                            <div>
                                <p className="text-sm font-medium">Stapelimport im Hintergrund</p>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    {bulkPendingCount} neue Beiträge mit diesen Einstellungen importieren
                                    {bulkAlreadyImportedCount > 0
                                        ? ` (${bulkAlreadyImportedCount} bereits vorhanden werden übersprungen)`
                                        : ''}
                                    . Du erhältst eine E-Mail, sobald der Import fertig ist.
                                </p>
                            </div>
                            <SelectControl
                                aria-label="Zugriff für alle Beiträge"
                                disabled={busy}
                                onChange={(event) =>
                                    setAccessPolicy(event.target.value === 'PAID' ? 'PAID' : 'FREE')
                                }
                                value={accessPolicy}
                            >
                                <option value="FREE">Alle frei</option>
                                <option value="PAID">Alle bezahlt</option>
                            </SelectControl>
                            {accessPolicy === 'PAID' ? (
                                <label className="grid gap-1.5">
                                    <span className="text-sm font-medium">Mindest-Stufe für alle</span>
                                    <LevelSelect
                                        disabled={busy}
                                        onChange={setRequiredLevelSortOrder}
                                        value={requiredLevelSortOrder}
                                    />
                                </label>
                            ) : null}
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
                            <div>
                                <Button
                                    disabled={busy || bulkPendingCount === 0}
                                    onClick={() => void handleBulkImport()}
                                    type="button"
                                    variant="outline"
                                >
                                    {busy
                                        ? 'Wird gestartet…'
                                        : `${bulkPendingCount} Beiträge als Hintergrund-Job importieren`}
                                </Button>
                            </div>
                        </div>
                    ) : null}
                </section>
            ) : null}

            {step === 'article' && currentArticle !== null && preview !== null ? (
                <section className="flex max-w-2xl flex-col gap-4">
                    <SectionHeader
                        title={`Beitrag ${articleIndex + 1} von ${preview.articles.length}`}
                        description={`${remaining} noch offen. Titelbilder werden einzeln nach S3 gestreamt; Bilder im Text übernimmt der Server.`}
                    />
                    {currentArticle.alreadyImportedArticleId !== null ? (
                        <p className="rounded-xl border bg-muted/40 px-4 py-3 text-sm">
                            Dieser Beitrag wurde bereits importiert.{' '}
                            <Link href={`/write/articles/${currentArticle.alreadyImportedArticleId}`}>
                                Öffnen
                            </Link>
                        </p>
                    ) : null}
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
                        </label>
                    ) : null}
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
                        <ul className="grid gap-2">
                            {categories.map((category) => (
                                <li key={category.id}>
                                    <label className="flex items-center gap-2 text-sm">
                                        <input
                                            checked={articleCategoryIds.has(category.id)}
                                            disabled={busy}
                                            onChange={(event) => {
                                                const next = new Set(articleCategoryIds)
                                                if (event.target.checked) {
                                                    next.add(category.id)
                                                } else {
                                                    next.delete(category.id)
                                                }
                                                setArticleCategoryIds(next)
                                            }}
                                            type="checkbox"
                                        />
                                        {category.name}
                                    </label>
                                </li>
                            ))}
                        </ul>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                        {articleIndex === 0 ? (
                            <Button
                                disabled={busy}
                                onClick={() => {
                                    setErrorMessage(null)
                                    setStep('categories')
                                }}
                                type="button"
                                variant="outline"
                            >
                                Zurück zu Kategorien
                            </Button>
                        ) : null}
                        <Button
                            disabled={busy || currentArticle.alreadyImportedArticleId !== null}
                            onClick={() => void handleImportArticle()}
                        >
                            {busy ? 'Wird importiert…' : 'Diesen Beitrag importieren'}
                        </Button>
                        <Button disabled={busy} onClick={handleSkipArticle} type="button" variant="outline">
                            {currentArticle.alreadyImportedArticleId !== null ? 'Weiter' : 'Überspringen'}
                        </Button>
                    </div>
                </section>
            ) : null}

            {step === 'done' ? (
                <section className="flex max-w-2xl flex-col gap-4">
                    {bulkResult !== null ? (
                        <SectionHeader
                            title="Stapelimport gestartet"
                            description={`${bulkResult.totalArticles - bulkResult.alreadyImported} Beiträge sind in der Warteschlange (${bulkResult.alreadyImported} bereits vorhanden). Du erhältst eine E-Mail an ${bulkResult.notifyEmail}, sobald der Import fertig ist. Entwürfe kannst du danach prüfen und veröffentlichen.`}
                        />
                    ) : (
                        <SectionHeader
                            title="Import abgeschlossen"
                            description={`${importedCount} Beiträge importiert, ${alreadyImportedCount} bereits vorhanden, ${skippedCount} übersprungen. Entwürfe kannst du jetzt prüfen und veröffentlichen.`}
                        />
                    )}
                    <div className="flex flex-wrap gap-2">
                        <Button nativeButton={false} render={<Link href="/write/articles" />}>
                            Zur Beitragsliste
                        </Button>
                        <Button onClick={resetWizard} type="button" variant="outline">
                            Weiteren Feed importieren
                        </Button>
                    </div>
                </section>
            ) : null}
        </PageStack>
    )
}
