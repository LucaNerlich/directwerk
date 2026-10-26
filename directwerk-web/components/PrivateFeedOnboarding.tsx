'use client'

import Link from 'next/link'
import {useEffect, useRef, useState} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Button, buttonVariants} from '@directwerk/ui/components/button'
import EmptyState from '@directwerk/ui/components/empty-state'
import SectionHeader from '@directwerk/ui/components/section-header'

import FeedUrlDisplay from '@/components/FeedUrlDisplay'
import HowToSubscribe from '@/components/HowToSubscribe'
import {ListPanelSkeleton} from '@/components/ContentLoadingSkeleton'
import type {ArticleFeedView, SubscriberFeedView} from '@directwerk/api/types'
import {useArticleFeeds} from '@/lib/auth/useArticleFeeds'
import {useSubscriberAuth} from '@/lib/auth/useSubscriberAuth'
import {useSubscriberFeeds} from '@/lib/auth/useSubscriberFeeds'
import {useDictionary, useLocale} from '@/lib/i18n/LocaleProvider'
import {localizedPath} from '@/lib/i18n/paths'
import {useSiteConfig} from '@/lib/site/SiteConfigProvider'

const EMPTY_RETRY_MS = 1500

export type PrivateFeedOnboardingVariant = 'full' | 'compact'

export interface PrivateFeedOnboardingProps {
    /**
     * `full` — checkout / setup: URL + how-to + app checklist.
     * `compact` — account: URL + link to feeds (no how-to card).
     */
    variant?: PrivateFeedOnboardingVariant
    /** When false, skip feed fetch (e.g. checkout still polling entitlements). */
    enabled?: boolean
}

function defaultFeedOf<T extends {isDefault: boolean}>(feeds: T[]): T | null {
    return feeds.find((feed) => feed.isDefault) ?? null
}

function PodcastAppChecklist(): React.JSX.Element {
    const {feeds} = useDictionary()
    return (
        <ul className="grid gap-2 sm:grid-cols-3">
            {[
                feeds.onboardingAppApple,
                feeds.onboardingAppSpotify,
                feeds.onboardingAppAntennaPod,
            ].map((label) => (
                <li
                    className="rounded-lg border bg-muted/40 px-3 py-2 text-sm font-medium"
                    key={label}
                >
                    {label}
                </li>
            ))}
        </ul>
    )
}

function FeedBlock({
    title,
    description,
    feed,
    emptyTitle,
    emptyDescription,
    isLoading,
    error,
    onRetry,
    preparing,
}: {
    title: string
    description: string
    feed: SubscriberFeedView | ArticleFeedView | null
    emptyTitle: string
    emptyDescription: string
    isLoading: boolean
    error: string | null
    onRetry: () => void
    preparing: boolean
}): React.JSX.Element {
    const lang = useLocale()
    const {common, feeds, nav} = useDictionary()

    return (
        <div className="space-y-3">
            <div className="space-y-1">
                <h3 className="text-base font-semibold">{title}</h3>
                <p className="text-sm text-muted-foreground">{description}</p>
            </div>
            {error !== null ? (
                <Alert variant="destructive">
                    <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <span>{error}</span>
                        <Button onClick={onRetry} size="sm" type="button" variant="outline">
                            {common.retry}
                        </Button>
                    </AlertDescription>
                </Alert>
            ) : null}
            {isLoading || preparing ? (
                <div className="space-y-2">
                    <ListPanelSkeleton rows={1} />
                    {preparing ? (
                        <p className="text-sm text-muted-foreground" role="status">
                            {feeds.onboardingPreparing}
                        </p>
                    ) : null}
                </div>
            ) : null}
            {!isLoading && !preparing && error === null && feed === null ? (
                <EmptyState
                    className="min-h-40 py-8"
                    description={emptyDescription}
                    title={emptyTitle}
                    action={
                        <Button
                            nativeButton={false}
                            render={<Link href={localizedPath(lang, '/pricing')} />}
                        >
                            {nav.viewPlans}
                        </Button>
                    }
                />
            ) : null}
            {!isLoading && !preparing && feed !== null ? (
                <FeedUrlDisplay
                    description={
                        feed.enabled ? undefined : feeds.onboardingFeedDisabledHint
                    }
                    title={feed.title}
                    url={feed.url}
                />
            ) : null}
        </div>
    )
}

/**
 * Guides new subscribers to copy their private feed URL and add it in a
 * podcast app / feed reader. Reuses `GET /me/feeds` (+ article twin).
 */
export default function PrivateFeedOnboarding({
    variant = 'full',
    enabled = true,
}: PrivateFeedOnboardingProps): React.JSX.Element | null {
    const lang = useLocale()
    const {account, feeds, nav} = useDictionary()
    const siteConfig = useSiteConfig()
    const {isAuthenticated} = useSubscriberAuth()

    const showPodcast =
        enabled &&
        isAuthenticated &&
        (siteConfig?.enabledModules.includes('PODCAST_RSS') ?? false)
    const showArticles =
        enabled &&
        isAuthenticated &&
        (siteConfig?.enabledModules.includes('ARTICLE_RSS') ?? false)

    const podcastQuery = useSubscriberFeeds(showPodcast)
    const articleQuery = useArticleFeeds(showArticles)

    const [podcastPreparing, setPodcastPreparing] = useState(false)
    const [articlePreparing, setArticlePreparing] = useState(false)
    const podcastRetried = useRef(false)
    const articleRetried = useRef(false)

    const defaultPodcast = defaultFeedOf(podcastQuery.feeds)
    const defaultArticle = defaultFeedOf(articleQuery.feeds)
    const podcastReload = podcastQuery.reload
    const articleReload = articleQuery.reload
    const podcastLoading = podcastQuery.isLoading
    const articleLoading = articleQuery.isLoading
    const podcastError = podcastQuery.error
    const articleError = articleQuery.error

    useEffect(() => {
        if (
            !showPodcast ||
            podcastLoading ||
            podcastError !== null ||
            defaultPodcast !== null ||
            podcastRetried.current
        ) {
            return
        }
        podcastRetried.current = true
        setPodcastPreparing(true)
        const timer = window.setTimeout(() => {
            podcastReload()
            setPodcastPreparing(false)
        }, EMPTY_RETRY_MS)
        return () => {
            window.clearTimeout(timer)
            setPodcastPreparing(false)
        }
    }, [
        defaultPodcast,
        podcastError,
        podcastLoading,
        podcastReload,
        showPodcast,
    ])

    useEffect(() => {
        if (
            !showArticles ||
            articleLoading ||
            articleError !== null ||
            defaultArticle !== null ||
            articleRetried.current
        ) {
            return
        }
        articleRetried.current = true
        setArticlePreparing(true)
        const timer = window.setTimeout(() => {
            articleReload()
            setArticlePreparing(false)
        }, EMPTY_RETRY_MS)
        return () => {
            window.clearTimeout(timer)
            setArticlePreparing(false)
        }
    }, [
        articleError,
        articleLoading,
        articleReload,
        defaultArticle,
        showArticles,
    ])

    if (!showPodcast && !showArticles) {
        return null
    }

    const compact = variant === 'compact'

    return (
        <section
            aria-labelledby="private-feed-onboarding-title"
            className="flex flex-col gap-5 rounded-xl border bg-card p-5 shadow-sm"
        >
            <SectionHeader
                description={
                    compact
                        ? account.privateFeedDesc
                        : feeds.onboardingDesc
                }
                id="private-feed-onboarding-title"
                title={
                    compact ? account.privateFeedTitle : feeds.onboardingTitle
                }
            />

            {showPodcast ? (
                <FeedBlock
                    description={
                        compact
                            ? feeds.onboardingFeedHintPodcast
                            : feeds.defaultPodcastDesc
                    }
                    emptyDescription={feeds.privateEmptyPodcastDesc}
                    emptyTitle={feeds.privateEmptyPodcastTitle}
                    error={podcastQuery.error}
                    feed={defaultPodcast}
                    isLoading={podcastQuery.isLoading}
                    onRetry={podcastQuery.reload}
                    preparing={podcastPreparing}
                    title={feeds.defaultPodcastTitle}
                />
            ) : null}

            {showArticles ? (
                <FeedBlock
                    description={
                        compact
                            ? feeds.onboardingFeedHintArticles
                            : feeds.defaultArticlesDesc
                    }
                    emptyDescription={feeds.privateEmptyArticlesDesc}
                    emptyTitle={feeds.privateEmptyArticlesTitle}
                    error={articleQuery.error}
                    feed={defaultArticle}
                    isLoading={articleQuery.isLoading}
                    onRetry={articleQuery.reload}
                    preparing={articlePreparing}
                    title={feeds.defaultArticlesTitle}
                />
            ) : null}

            {!compact && showPodcast ? <PodcastAppChecklist /> : null}

            {!compact ? (
                <HowToSubscribe
                    articles={showArticles}
                    framed={false}
                    podcast={showPodcast}
                />
            ) : null}

            <div className="flex flex-wrap gap-3">
                <Link
                    className={buttonVariants({
                        variant: compact ? 'outline' : 'default',
                    })}
                    href={localizedPath(lang, '/feeds?setup=1')}
                >
                    {nav.manageFeedsLink}
                </Link>
            </div>
        </section>
    )
}
