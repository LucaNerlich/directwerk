'use client'

import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {useCallback, useEffect, useRef, useState} from 'react'

import {Button} from '@directwerk/ui/components/button'
import EmptyState from '@directwerk/ui/components/empty-state'
import ListPanel, {ListPanelRow} from '@directwerk/ui/components/list-panel'
import PageHeader from '@directwerk/ui/components/page-header'

import PublicationStatusBadge from '@/components/publication/PublicationStatusBadge'
import {cancelScheduleArticle, listArticles, unarchiveArticle, unpublishArticle} from '@/lib/api/writeApi'
import type {ArticleDetail} from '@directwerk/api/types'
import {getClientTenantHost} from '@/lib/tenant/getClientTenantHost'
import {useAuthRequired} from '@directwerk/api/auth/useAuthRequired'

export default function ArticleListClient() {
    const router = useRouter()
    const authRedirect = useAuthRequired()
    const routerRef = useRef(router)
    routerRef.current = router

    const [articles, setArticles] = useState<ArticleDetail[]>([])
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [statusMessage, setStatusMessage] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [busyArticleId, setBusyArticleId] = useState<number | null>(null)

    const load = useCallback(async (): Promise<void> => {
        try {
            const loaded = await listArticles(getClientTenantHost())
            setArticles(loaded)
        } catch (error) {
            if (authRedirect(error)) return
            setErrorMessage(
                error instanceof Error
                    ? error.message
                    : 'Beiträge konnten nicht geladen werden.',
            )
        } finally {
            setIsLoading(false)
        }
    }, [])

    useEffect(() => {
        void load()
    }, [load])

    const handleUnpublish = async (article: ArticleDetail): Promise<void> => {
        setBusyArticleId(article.id)
        setErrorMessage(null)
        setStatusMessage(null)
        try {
            const host = getClientTenantHost()
            const updated = await unpublishArticle(host, article.id)
            setArticles((current) =>
                current.map((item) => (item.id === article.id ? updated : item)),
            )
            setStatusMessage(`Beitrag „${article.title}“ wurde zurückgezogen (Entwurf).`)
        } catch (error) {
            if (authRedirect(error)) return
            setErrorMessage(
                error instanceof Error
                    ? error.message
                    : 'Beitrag konnte nicht zurückgezogen werden.',
            )
        } finally {
            setBusyArticleId(null)
        }
    }

    const handleCancelSchedule = async (article: ArticleDetail): Promise<void> => {
        setBusyArticleId(article.id)
        setErrorMessage(null)
        setStatusMessage(null)
        try {
            const host = getClientTenantHost()
            const updated = await cancelScheduleArticle(host, article.id)
            setArticles((current) =>
                current.map((item) => (item.id === article.id ? updated : item)),
            )
            setStatusMessage(`Planung für „${article.title}“ wurde aufgehoben (Entwurf).`)
        } catch (error) {
            if (authRedirect(error)) return
            setErrorMessage(
                error instanceof Error
                    ? error.message
                    : 'Planung konnte nicht aufgehoben werden.',
            )
        } finally {
            setBusyArticleId(null)
        }
    }

    const handleUnarchive = async (article: ArticleDetail): Promise<void> => {
        setBusyArticleId(article.id)
        setErrorMessage(null)
        setStatusMessage(null)
        try {
            const host = getClientTenantHost()
            const updated = await unarchiveArticle(host, article.id)
            setArticles((current) =>
                current.map((item) => (item.id === article.id ? updated : item)),
            )
            setStatusMessage(`Beitrag „${article.title}“ wurde wiederhergestellt (Entwurf).`)
        } catch (error) {
            if (authRedirect(error)) return
            setErrorMessage(
                error instanceof Error
                    ? error.message
                    : 'Beitrag konnte nicht wiederhergestellt werden.',
            )
        } finally {
            setBusyArticleId(null)
        }
    }

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
            {errorMessage !== null && (
                <p className="text-sm text-destructive" role="alert">
                    {errorMessage}
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
