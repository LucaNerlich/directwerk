'use client'

import Link from 'next/link'
import {useCallback, useEffect, useState} from 'react'

import {Button} from '@directwerk/ui/components/button'
import EmptyState from '@directwerk/ui/components/empty-state'
import ListPanel, {ListPanelRow} from '@directwerk/ui/components/list-panel'
import PageHeader from '@directwerk/ui/components/page-header'

import PublicationStatusBadge from '@/components/publication/PublicationStatusBadge'
import {
    cancelScheduleArticle,
    listArticles,
    unarchiveArticle,
    unpublishArticle,
} from '@/lib/api/writeApi'
import type {ArticleDetail} from '@directwerk/api/types'
import {usePublicationListActions} from '@/lib/publication/usePublicationListActions'
import {getClientTenantHost} from '@/lib/tenant/getClientTenantHost'
import {useAuthRequired} from '@directwerk/api/auth/useAuthRequired'

export default function ArticleListClient() {
    const authRedirect = useAuthRequired()
    const [articles, setArticles] = useState<ArticleDetail[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [listError, setListError] = useState<string | null>(null)

    const load = useCallback(async (): Promise<void> => {
        try {
            const loaded = await listArticles(getClientTenantHost())
            setArticles(loaded)
        } catch (error) {
            if (authRedirect(error)) return
            setListError(
                error instanceof Error
                    ? error.message
                    : 'Beiträge konnten nicht geladen werden.',
            )
        } finally {
            setIsLoading(false)
        }
    }, [])

    const {
        busyItemId: busyArticleId,
        errorMessage,
        statusMessage,
        handleUnpublish,
        handleCancelSchedule,
        handleUnarchive,
    } = usePublicationListActions({
        setItems: setArticles,
        unpublish: (id) => unpublishArticle(getClientTenantHost(), id),
        cancelSchedule: (id) => cancelScheduleArticle(getClientTenantHost(), id),
        unarchive: (id) => unarchiveArticle(getClientTenantHost(), id),
        labels: {
            unpublishSuccess: (title) =>
                `Beitrag „${title}“ wurde zurückgezogen (Entwurf).`,
            cancelScheduleSuccess: (title) =>
                `Planung für „${title}“ wurde aufgehoben (Entwurf).`,
            unarchiveSuccess: (title) =>
                `Beitrag „${title}“ wurde wiederhergestellt (Entwurf).`,
            unpublishError: 'Beitrag konnte nicht zurückgezogen werden.',
            cancelScheduleError: 'Planung konnte nicht aufgehoben werden.',
            unarchiveError: 'Beitrag konnte nicht wiederhergestellt werden.',
        },
        authRedirect,
    })

    const displayError = listError ?? errorMessage

    useEffect(() => {
        void load()
    }, [load])

    if (isLoading) {
        return <p>Beiträge werden geladen…</p>
    }

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                eyebrow="Schreiben"
                title="Beiträge"
                description="Artikel und Newsletter-Texte — mit Freigabe, Planung und Kategorien."
                actions={
                    <Button nativeButton={false} render={<Link href="/write/articles/new" />} size="lg">
                        Neuer Beitrag
                    </Button>
                }
            />
            {displayError !== null && (
                <p className="text-sm text-destructive" role="alert">
                    {displayError}
                </p>
            )}
            {statusMessage !== null && (
                <p className="text-sm text-muted-foreground" role="status">
                    {statusMessage}
                </p>
            )}
            {articles.length === 0 ? (
                <EmptyState
                    title="Noch keine Beiträge"
                    description="Schreibe den ersten Entwurf. Veröffentlichen kannst du später."
                    action={
                        <Button nativeButton={false} render={<Link href="/write/articles/new" />}>
                            Ersten Beitrag schreiben
                        </Button>
                    }
                />
            ) : (
                <ListPanel>
                    {articles.map((article) => {
                        const isBusy = busyArticleId === article.id
                        return (
                            <ListPanelRow key={article.id}>
                                <div className="min-w-0 flex-1">
                                    <Link
                                        className="font-medium hover:underline"
                                        href={`/write/articles/${article.id}`}
                                    >
                                        {article.title}
                                    </Link>
                                </div>
                                <div className="flex shrink-0 items-center gap-3">
                                    <PublicationStatusBadge status={article.status} />
                                    {article.status === 'PUBLISHED' && (
                                        <Button
                                            disabled={isBusy}
                                            onClick={() => void handleUnpublish(article)}
                                            size="sm"
                                            type="button"
                                            variant="outline"
                                        >
                                            {isBusy ? 'Wird zurückgezogen…' : 'Zurückziehen'}
                                        </Button>
                                    )}
                                    {article.status === 'SCHEDULED' && (
                                        <Button
                                            disabled={isBusy}
                                            onClick={() => void handleCancelSchedule(article)}
                                            size="sm"
                                            type="button"
                                            variant="outline"
                                        >
                                            {isBusy ? 'Wird abgebrochen…' : 'Planung aufheben'}
                                        </Button>
                                    )}
                                    {article.status === 'ARCHIVED' && (
                                        <Button
                                            disabled={isBusy}
                                            onClick={() => void handleUnarchive(article)}
                                            size="sm"
                                            type="button"
                                            variant="outline"
                                        >
                                            {isBusy ? 'Wird wiederhergestellt…' : 'Wiederherstellen'}
                                        </Button>
                                    )}
                                </div>
                            </ListPanelRow>
                        )
                    })}
                </ListPanel>
            )}
        </div>
    )
}
