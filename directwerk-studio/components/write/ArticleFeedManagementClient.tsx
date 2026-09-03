'use client'

import {useCallback, useEffect, useState} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Button} from '@directwerk/ui/components/button'
import EmptyState from '@directwerk/ui/components/empty-state'
import {
    EntityListView,
    type EntityListViewItem,
} from '@directwerk/ui/components/entity-list-view'
import PageHeader from '@directwerk/ui/components/page-header'
import PageStack from '@directwerk/ui/components/page-stack'
import SectionHeader from '@directwerk/ui/components/section-header'

import {hasModule} from '@/lib/api/client'
import {listArticleFeeds, setArticleFeedEnabled} from '@/lib/api/subscriptionApi'
import type {ArticleFeedAdminView} from '@directwerk/api/types'
import {useSiteConfig} from '@/lib/site/SiteConfigProvider'
import {getClientTenantHost} from '@directwerk/api/tenant'
import {safeLinkHref} from '@/lib/url/safeUrl'
import {useAuthRequired} from '@directwerk/api/auth/useAuthRequired'

function copyUrl(url: string): Promise<void> {
    return navigator.clipboard.writeText(url)
}

function FeedUrlActions({
    copiedUrl,
    onCopy,
    url,
}: {
    copiedUrl: string | null
    onCopy: (url: string) => void
    url: string
}): React.JSX.Element {
    return (
        <div className="flex flex-wrap items-center gap-2">
            {safeLinkHref(url) !== null ? (
                <a
                    className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                    href={url}
                    rel="noreferrer"
                    target="_blank"
                >
                    Öffnen
                </a>
            ) : null}
            <Button
                aria-label={copiedUrl === url ? 'Feed-URL kopiert' : 'Feed-URL kopieren'}
                onClick={() => onCopy(url)}
                size="sm"
                type="button"
                variant="outline"
            >
                {copiedUrl === url ? 'Kopiert!' : 'Kopieren'}
            </Button>
            {copiedUrl === url ? (
                <span className="sr-only" role="status">
                    Feed-URL kopiert.
                </span>
            ) : null}
        </div>
    )
}

export default function ArticleFeedManagementClient(): React.JSX.Element {
    const authRedirect = useAuthRequired()
    const config = useSiteConfig()
    const [articleFeeds, setArticleFeeds] = useState<ArticleFeedAdminView[]>([])
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [busyFeedId, setBusyFeedId] = useState<number | null>(null)
    const [copiedUrl, setCopiedUrl] = useState<string | null>(null)
    const showArticleFeeds = hasModule(config, 'SUBSCRIPTION')

    const handleAuthError = useCallback(
        (error: unknown) => {
            if (authRedirect(error)) return
            setErrorMessage(
                error instanceof Error ? error.message : 'Aktion fehlgeschlagen.',
            )
        },
        [authRedirect],
    )

    useEffect(() => {
        let active = true

        async function load(): Promise<void> {
            try {
                const host = getClientTenantHost()
                const loadedFeeds = showArticleFeeds
                    ? await listArticleFeeds(host)
                    : []
                if (!active) {
                    return
                }
                setArticleFeeds(loadedFeeds)
            } catch (error) {
                if (!active) {
                    return
                }
                handleAuthError(error)
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
    }, [handleAuthError, showArticleFeeds])

    async function handleCopy(url: string): Promise<void> {
        setErrorMessage(null)
        try {
            await copyUrl(url)
            setCopiedUrl(url)
        } catch (error) {
            handleAuthError(error)
        }
    }

    async function handleToggleFeed(
        feed: ArticleFeedAdminView,
    ): Promise<void> {
        setBusyFeedId(feed.id)
        setErrorMessage(null)
        try {
            const updated = await setArticleFeedEnabled(
                getClientTenantHost(),
                feed.id,
                !feed.enabled,
            )
            setArticleFeeds((current) =>
                current.map((item) => (item.id === feed.id ? updated : item)),
            )
        } catch (error) {
            handleAuthError(error)
        } finally {
            setBusyFeedId(null)
        }
    }

    if (isLoading) {
        return <p className="text-sm text-muted-foreground">Feeds werden geladen…</p>
    }

    const generalFeedItems: EntityListViewItem[] =
        config.publicArticleRssUrl !== null
            ? [
                  {
                      id: 'general-article-feed',
                      title: config.tenant.name,
                      description: config.publicArticleRssUrl,
                      actions: (
                          <FeedUrlActions
                              copiedUrl={copiedUrl}
                              onCopy={(url) => {
                                  void handleCopy(url)
                              }}
                              url={config.publicArticleRssUrl}
                          />
                      ),
                  },
              ]
            : []

    const articleFeedItems: EntityListViewItem[] = articleFeeds.map((feed) => ({
        id: feed.id,
        title: feed.userEmail,
        descriptions: [
            <>
                <code>{feed.title}</code>
                {feed.isDefault ? ' (Standard)' : ' (Eigener Feed)'}
                {feed.categories.length > 0
                    ? ` · ${feed.categories.map((item) => item.name).join(', ')}`
                    : null}
            </>,
            feed.enabled ? 'Aktiv' : 'Deaktiviert',
        ],
        actions: (
            <Button
                disabled={busyFeedId === feed.id}
                onClick={() => {
                    void handleToggleFeed(feed)
                }}
                size="sm"
                type="button"
                variant="outline"
            >
                {busyFeedId === feed.id
                    ? 'Arbeiten…'
                    : feed.enabled
                      ? 'Deaktivieren'
                      : 'Aktivieren'}
            </Button>
        ),
    }))

    return (
        <PageStack>
            <PageHeader
                eyebrow="Write · Einrichtung"
                title="Feeds"
                description="Teile diese URLs mit Feed-Readern. Der Abonnenten-Feed ist privat und wird über den Feed-Token der Abonnentin bzw. des Abonnenten geschützt."
            />

            {errorMessage !== null ? (
                <Alert variant="destructive">
                    <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
            ) : null}

            {generalFeedItems.length > 0 ? (
                <section className="flex flex-col gap-4">
                    <SectionHeader title="Allgemeiner Feed" />
                    <EntityListView
                        ariaLabel="Allgemeiner Feed"
                        items={generalFeedItems}
                        viewMode="list"
                    />
                </section>
            ) : null}

            {showArticleFeeds ? (
                <section className="flex flex-col gap-4">
                    <SectionHeader title="Abonnenten-Feeds" />
                    {articleFeedItems.length === 0 ? (
                        <EmptyState
                            description="Ein Feed wird bei der ersten Freischaltung einer Abonnentin bzw. eines Abonnenten automatisch angelegt."
                            title="Noch keine Abonnenten-Feeds"
                        />
                    ) : (
                        <EntityListView
                            ariaLabel="Abonnenten-Feeds"
                            items={articleFeedItems}
                            viewMode="list"
                        />
                    )}
                </section>
            ) : null}
        </PageStack>
    )
}
