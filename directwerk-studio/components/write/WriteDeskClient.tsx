'use client'

import LocaleLink from '@/components/i18n/LocaleLink'
import {useDictionary} from '@/components/i18n/LocaleProvider'
import {useRouter} from 'next/navigation'
import {useEffect, useState} from 'react'

import {Button} from '@directwerk/ui/components/button'
import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Badge} from '@directwerk/ui/components/badge'
import EmptyState from '@directwerk/ui/components/empty-state'
import {EntityListSection} from '@directwerk/ui/components/entity-list-section'
import type {EntityListViewItem} from '@directwerk/ui/components/entity-list-view'
import PageHeader from '@directwerk/ui/components/page-header'
import PageStack from '@directwerk/ui/components/page-stack'
import SectionHeader from '@directwerk/ui/components/section-header'
import {useListViewMode} from '@directwerk/ui/hooks/use-list-view-mode'

import PublicationStatusBadge from '@/components/publication/PublicationStatusBadge'
import {listCategories} from '@/lib/api/catalogApi'
import {listArticles} from '@/lib/api/writeApi'
import type {SetupStep} from '@/lib/studio/setupStep'
import type {ArticleSummary, CategorySummary} from '@directwerk/api/types'
import {getClientTenantHost} from '@directwerk/api/tenant'
import {useAuthRequired} from '@directwerk/api/auth/useAuthRequired'

export default function WriteDeskClient(): React.JSX.Element {
    const router = useRouter()
    const dict = useDictionary()
    const w = dict.write
    const authRedirect = useAuthRequired()
    const [articles, setArticles] = useState<ArticleSummary[]>([])
    const [categories, setCategories] = useState<CategorySummary[]>([])
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const {viewMode, setViewMode} = useListViewMode()

    useEffect(() => {
        let active = true

        async function load(): Promise<void> {
            try {
                const host = getClientTenantHost()
                const [loadedArticles, loadedCategories] = await Promise.all([
                    listArticles(host),
                    listCategories(host),
                ])
                if (!active) {
                    return
                }
                setArticles(loadedArticles)
                setCategories(loadedCategories.filter((item) => item.active))
            } catch (error) {
                if (!active) {
                    return
                }
                if (authRedirect(error)) return
                setErrorMessage(
                    error instanceof Error
                        ? error.message
                        : w.overviewLoadFailed,
                )
            } finally {
                if (active) {
                    setIsLoading(false)
                }
            }
        }

        void load()

        return () => {
            active = false
        }
    }, [authRedirect, router, w.overviewLoadFailed])

    if (isLoading) {
        return (
            <p className="text-sm text-muted-foreground" role="status">
                {w.overviewLoading}
            </p>
        )
    }

    const hasCategories = categories.length > 0
    const hasArticles = articles.length > 0
    const draftArticles = articles.filter(
        (item) => item.status === 'DRAFT' || item.status === 'SCHEDULED',
    )

    const steps: SetupStep[] = [
        {
            id: 'categories',
            title: w.setupStep1Categories,
            description: w.categoriesHelpStructure,
            done: hasCategories,
            href: hasCategories ? '/manage/categories' : '/manage/categories/new',
            actionLabel: hasCategories ? w.viewCategories : w.createCategory,
        },
        {
            id: 'article',
            title: w.setupStep2Write,
            description: w.step2WriteDescription,
            done: hasArticles,
            href: '/write/articles/new',
            actionLabel: dict.shell.home.newArticle,
            primary: true,
        },
        {
            id: 'publish',
            title: w.setupStep3Publish,
            description: w.step3PublishDescription,
            done: articles.some((item) => item.status === 'PUBLISHED'),
            href: '/write/articles',
            actionLabel: w.viewArticles,
        },
    ]

    const nextStep = steps.find((step) => !step.done) ?? steps[steps.length - 1]

    const draftArticleItems: EntityListViewItem[] = draftArticles.slice(0, 5).map((article) => ({
        id: article.id,
        title: article.title,
        href: `/write/articles/${article.id}`,
        trailing: <PublicationStatusBadge status={article.status} />,
    }))

    return (
        <PageStack>
            <PageHeader
                eyebrow={dict.desks.write}
                title={dict.desks.createContent}
                description={w.publishArticleByArticle}
                actions={
                    <div className="flex flex-wrap gap-2">
                        <Button nativeButton={false} render={<LocaleLink href="/write/import" />} size="lg" variant="outline">
                            {w.importRss}
                        </Button>
                        <Button nativeButton={false} render={<LocaleLink href="/write/articles/new" />} size="lg">
                            {dict.shell.home.newArticle}
                        </Button>
                    </div>
                }
            />

            {errorMessage !== null ? (
                <Alert variant="destructive">
                    <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
            ) : null}

            <section aria-labelledby="write-flow-heading" className="flex flex-col gap-4">
                <SectionHeader
                    description={w.optionalCategoriesThenWrite}
                    id="write-flow-heading"
                    title={w.howArticleWorks}
                />
                <ol className="grid gap-3">
                    {steps.map((step) => (
                        <li
                            key={step.id}
                            className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
                        >
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <p className="font-medium">{step.title}</p>
                                    <Badge variant={step.done ? 'secondary' : 'outline'}>
                                        {step.done ? dict.common.done : dict.common.openStep}
                                    </Badge>
                                </div>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    {step.description}
                                </p>
                            </div>
                            <Button
                                nativeButton={false}
                                render={<LocaleLink href={step.href} />}
                                size="sm"
                                variant={step.primary ? 'default' : step.done ? 'outline' : 'secondary'}
                            >
                                {step.actionLabel}
                            </Button>
                        </li>
                    ))}
                </ol>
            </section>

            {!hasArticles ? (
                <EmptyState
                    title={w.noArticleYet}
                    description={w.writeFirstDraftLater}
                    action={
                        <Button nativeButton={false} render={<LocaleLink href={nextStep.href} />}>
                            {nextStep.actionLabel}
                        </Button>
                    }
                />
            ) : null}

            {draftArticles.length > 0 ? (
                <section className="flex flex-col gap-3">
                    <SectionHeader title={w.openDrafts} />
                    <EntityListSection
                        items={draftArticleItems}
                        linkComponent={LocaleLink}
                        onViewModeChange={setViewMode}
                        showSelection={false}
                        viewMode={viewMode}
                    />
                    {draftArticles.length > 5 ? (
                        <p className="text-sm text-muted-foreground">
                            <LocaleLink href="/write/articles">{w.showAllArticles}</LocaleLink>
                        </p>
                    ) : null}
                </section>
            ) : null}

            <p className="text-sm text-muted-foreground">
                <LocaleLink href="/write/articles">{w.toArticleList}</LocaleLink>
                {' · '}
                <LocaleLink href="/manage/categories">{dict.nav.verwaltung.categories}</LocaleLink>
                {' · '}
                <LocaleLink href="/bonus">{dict.nav.verwaltung.bonus}</LocaleLink>
            </p>
        </PageStack>
    )
}
