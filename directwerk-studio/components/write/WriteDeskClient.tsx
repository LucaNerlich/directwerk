'use client'

import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {useEffect, useState} from 'react'

import {Button} from '@directwerk/ui/components/button'
import EmptyState from '@directwerk/ui/components/empty-state'
import {EntityListSection} from '@directwerk/ui/components/entity-list-section'
import type {EntityListViewItem} from '@directwerk/ui/components/entity-list-view'
import PageHeader from '@directwerk/ui/components/page-header'
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
                        : 'Schreib-Übersicht konnte nicht geladen werden.',
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
    }, [router])

    if (isLoading) {
        return <p>Schreib-Übersicht wird geladen…</p>
    }

    const hasCategories = categories.length > 0
    const hasArticles = articles.length > 0
    const draftArticles = articles.filter(
        (item) => item.status === 'DRAFT' || item.status === 'SCHEDULED',
    )

    const steps: SetupStep[] = [
        {
            id: 'categories',
            title: '1. Kategorien festlegen (optional)',
            description:
                'Kategorien helfen bei der Struktur auf der Website — z. B. Politik, Meta, Updates.',
            done: hasCategories,
            href: hasCategories ? '/manage/categories' : '/manage/categories/new',
            actionLabel: hasCategories ? 'Kategorien ansehen' : 'Kategorie anlegen',
        },
        {
            id: 'article',
            title: '2. Beitrag schreiben',
            description:
                'Titel, Text und optional Titelbild — Freigabe und Newsletter-Versand beim Veröffentlichen.',
            done: hasArticles,
            href: '/write/articles/new',
            actionLabel: 'Neuer Beitrag',
            primary: true,
        },
        {
            id: 'publish',
            title: '3. Veröffentlichen',
            description:
                'Beitrag erscheint auf deiner Website; bezahlte Inhalte sind für Abonnenten freigeschaltet.',
            done: articles.some((item) => item.status === 'PUBLISHED'),
            href: '/write/articles',
            actionLabel: 'Beiträge ansehen',
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
        <div className="flex flex-col gap-8">
            <PageHeader
                eyebrow="Schreiben"
                title="Inhalte erstellen"
                description="Beitrag für Beitrag veröffentlichen. Kategorien sind optional — der wöchentliche Weg führt über die Beiträge."
                actions={
                    <Button nativeButton={false} render={<Link href="/write/articles/new" />} size="lg">
                        Neuer Beitrag
                    </Button>
                }
            />

            {errorMessage !== null ? (
                <p className="text-sm text-destructive" role="alert">
                    {errorMessage}
                </p>
            ) : null}

            <section aria-labelledby="write-flow-heading" className="flex flex-col gap-4">
                <SectionHeader
                    description="Optional Kategorien, dann regelmäßig schreiben und veröffentlichen."
                    id="write-flow-heading"
                    title="So entsteht ein Beitrag"
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
                                    <span
                                        className={
                                            step.done
                                                ? 'text-xs font-medium text-emerald-700'
                                                : 'text-xs font-medium text-muted-foreground'
                                        }
                                    >
                                        {step.done ? 'Erledigt' : 'Offen'}
                                    </span>
                                </div>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    {step.description}
                                </p>
                            </div>
                            <Button
                                nativeButton={false}
                                render={<Link href={step.href} />}
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
                    title="Noch kein Beitrag"
                    description="Schreibe den ersten Entwurf. Veröffentlichen kannst du später."
                    action={
                        <Button nativeButton={false} render={<Link href={nextStep.href} />}>
                            {nextStep.actionLabel}
                        </Button>
                    }
                />
            ) : null}

            {draftArticles.length > 0 ? (
                <section className="flex flex-col gap-3">
                    <SectionHeader title="Offene Entwürfe" />
                    <EntityListSection
                        items={draftArticleItems}
                        linkComponent={Link}
                        onViewModeChange={setViewMode}
                        showSelection={false}
                        viewMode={viewMode}
                    />
                    {draftArticles.length > 5 ? (
                        <p className="text-sm text-muted-foreground">
                            <Link href="/write/articles">Alle Beiträge anzeigen</Link>
                        </p>
                    ) : null}
                </section>
            ) : null}

            <p className="text-sm text-muted-foreground">
                <Link href="/write/articles">Zur Beitragsliste</Link>
                {' · '}
                <Link href="/manage/categories">Kategorien</Link>
                {' · '}
                <Link href="/bonus">Bonusdateien</Link>
            </p>
        </div>
    )
}
