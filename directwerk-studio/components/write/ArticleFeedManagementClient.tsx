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

import FeedUrlActions from '@/components/publication/FeedUrlActions'
import {hasModule} from '@/lib/api/client'
import {listArticleFeeds, setArticleFeedEnabled} from '@/lib/api/subscriptionApi'
import type {ArticleFeedAdminView} from '@directwerk/api/types'
import {useSiteConfig} from '@/lib/site/SiteConfigProvider'
import {useAuthRequired} from '@directwerk/api/auth/useAuthRequired'
import {useDictionary} from '@/components/i18n/LocaleProvider'

/**
 * Renders the article feed management page, including public and subscriber feeds.
 */
export default function ArticleFeedManagementClient(): React.JSX.Element {
    const dict = useDictionary()
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
                const loadedFeeds = showArticleFeeds
                    ? await listArticleFeeds()
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
            await navigator.clipboard.writeText(url)
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
                title={dict.nav.podcast.feeds}
                description={dict.write.feedsShareDescription}
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
                    <SectionHeader title={dict.common.subscriberFeeds} />
                    {articleFeedItems.length === 0 ? (
                        <EmptyState
                            description={dict.write.subscriberFeedAutoCreated}
                            title={dict.write.noSubscriberFeeds}
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
