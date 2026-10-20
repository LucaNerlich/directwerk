'use client'

import LocaleLink from '@/components/i18n/LocaleLink'

import DeskLanding from '@/components/studio/DeskLanding'
import {useDictionary} from '@/components/i18n/LocaleProvider'
import {useRouter} from 'next/navigation'
import {useEffect, useState} from 'react'

import {Button} from '@directwerk/ui/components/button'
import type {EntityListViewItem} from '@directwerk/ui/components/entity-list-view'
import {useListViewMode} from '@directwerk/ui/hooks/use-list-view-mode'

import PublicationStatusBadge from '@/components/publication/PublicationStatusBadge'
import {listCategories} from '@/lib/api/catalogApi'
import {listArticles} from '@/lib/api/writeApi'
import type {SetupStep} from '@/lib/studio/setupStep'
import type {ArticleSummary, CategorySummary} from '@directwerk/api/types'
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
                const [loadedArticles, loadedCategories] = await Promise.all([
                    listArticles(),
                    listCategories(),
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
        <DeskLanding
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
            activatePrimary
            description={w.publishArticleByArticle}
            drafts={{
                title: w.openDrafts,
                items: draftArticleItems,
                viewMode,
                onViewModeChange: setViewMode,
                showAllHref: '/write/articles',
                showAllLabel: w.showAllArticles,
            }}
            emptyState={
                !hasArticles
                    ? {
                          title: w.noArticleYet,
                          description: w.writeFirstDraftLater,
                          actionLabel: nextStep.actionLabel,
                          actionHref: nextStep.href,
                      }
                    : undefined
            }
            errorMessage={errorMessage}
            eyebrow={dict.desks.write}
            flowDescription={w.optionalCategoriesThenWrite}
            flowId="write-flow-heading"
            flowTitle={w.howArticleWorks}
            footer={
                <>
                    <LocaleLink href="/write/articles">{w.toArticleList}</LocaleLink>
                    {' · '}
                    <LocaleLink href="/manage/categories">{dict.nav.verwaltung.categories}</LocaleLink>
                    {' · '}
                    <LocaleLink href="/bonus">{dict.nav.verwaltung.bonus}</LocaleLink>
                </>
            }
            steps={steps}
            title={dict.desks.createContent}
        />
    )
}
