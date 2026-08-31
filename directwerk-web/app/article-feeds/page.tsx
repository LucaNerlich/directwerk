'use client'

import Link from 'next/link'
import {useState} from 'react'
import useSWR from 'swr'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Badge} from '@directwerk/ui/components/badge'
import {Button} from '@directwerk/ui/components/button'
import PageHeader from '@directwerk/ui/components/page-header'
import PageStack from '@directwerk/ui/components/page-stack'
import ListPanel, {ListPanelRow} from '@directwerk/ui/components/list-panel'
import SectionHeader from '@directwerk/ui/components/section-header'

import ArticleCustomFeedsPanel from '@/components/ArticleCustomFeedsPanel'
import FeedUrlDisplay from '@/components/FeedUrlDisplay'
import {ListPanelSkeleton} from '@/components/ContentLoadingSkeleton'
import SubscriberContextBanner from '@/components/SubscriberContextBanner'
import {
    getSiteConfig,
    rotateDefaultArticleFeedToken,
    setDefaultArticleFeedEnabled,
} from '@/lib/api/client'
import type {PublicSiteConfig} from '@directwerk/api/types'
import {useSubscriberAuth} from '@/lib/auth/useSubscriberAuth'
import {useArticleFeeds} from '@/lib/auth/useArticleFeeds'
import {formatPublishedAt} from '@directwerk/api/format/datetime'
import {getClientTenantHost} from '@/lib/tenant/clientHost'

export default function ArticleFeedsPage() {
    const tenantHost = getClientTenantHost()
    const {isAuthenticated} = useSubscriberAuth()
    const {
        feeds: privateFeeds,
        error: privateError,
        isLoading: isPrivateLoading,
        setFeeds: setPrivateFeeds,
    } = useArticleFeeds(isAuthenticated)

    const {data: siteConfig} = useSWR<PublicSiteConfig>(
        ['site-config', tenantHost] as const,
        async ([, host]: readonly [string, string]) =>
            (await getSiteConfig(host)).data,
    )

    const [feedActionBusy, setFeedActionBusy] = useState(false)
    const [feedActionError, setFeedActionError] = useState<string | null>(null)

    const articleFeedUrl =
        siteConfig === undefined ? null : siteConfig.publicArticleRssUrl

    const defaultPrivate = privateFeeds.find((feed) => feed.isDefault) ?? null
    const customFeeds = privateFeeds.filter((feed) => !feed.isDefault)
    const showFeedBuilder =
        isAuthenticated &&
        ((siteConfig?.enabledModules.includes('ARTICLE_FEED_BUILDER') ?? false) ||
            customFeeds.length > 0)
    const canBuildFeeds =
        isAuthenticated &&
        (siteConfig?.enabledModules.includes('ARTICLE_FEED_BUILDER') ?? false)

    async function handleRotate(): Promise<void> {
        setFeedActionBusy(true)
        setFeedActionError(null)
        try {
            const updated = await rotateDefaultArticleFeedToken(tenantHost)
            setPrivateFeeds((current) =>
                current.map((feed) => (feed.isDefault ? updated : feed)),
            )
        } catch (error: unknown) {
            setFeedActionError(
                error instanceof Error
                    ? error.message
                    : 'Token konnte nicht erneuert werden.',
            )
        } finally {
            setFeedActionBusy(false)
        }
    }

    async function handleToggleDefault(enabled: boolean): Promise<void> {
        setFeedActionBusy(true)
        setFeedActionError(null)
        try {
            const updated = await setDefaultArticleFeedEnabled(tenantHost, enabled)
            setPrivateFeeds((current) =>
                current.map((feed) => (feed.isDefault ? updated : feed)),
            )
        } catch (error: unknown) {
            setFeedActionError(
                error instanceof Error
                    ? error.message
                    : 'Feed konnte nicht aktualisiert werden.',
            )
        } finally {
            setFeedActionBusy(false)
        }
    }

    return (
        <PageStack className="page-container">
            <PageHeader
                title="Beitrags-Feeds"
                description="Öffentlicher Feed für freie Beiträge. Nach der Anmeldung kommt der private Feed für bezahlte Beiträge."
            />

            <SubscriberContextBanner showWhenAuthenticated={false} />

            <section className="flex flex-col gap-4">
                <SectionHeader
                    description="Nur veröffentlichte freie Beiträge. Bezahlte Beiträge erscheinen im privaten Feed."
                    title="Öffentlicher Feed"
                />
                <ListPanel>
                    <ListPanelRow>
                        <div className="min-w-0 flex-1">
                            <p className="font-medium">Alle freien Beiträge</p>
                            {articleFeedUrl !== null ? (
                                <div className="mt-3">
                                    <FeedUrlDisplay url={articleFeedUrl} />
                                </div>
                            ) : (
                                <p className="mt-2 text-sm text-muted-foreground">
                                    Kein öffentlicher Feed (ARTICLE_RSS aus).
                                </p>
                            )}
                        </div>
                    </ListPanelRow>
                </ListPanel>
            </section>

            <section className="flex flex-col gap-4">
                <SectionHeader
                    description="Enthält Beiträge, die dein Abo freischaltet. Teile die URL nicht — sie ist persönlich."
                    title="Dein privater Feed"
                />
                {!isAuthenticated ? (
                    <Alert>
                        <AlertDescription>
                            <Link href="/login">Anmelden</Link>, um den privaten Feed für
                            Beiträge zu sehen, die du freigeschaltet hast.
                        </AlertDescription>
                    </Alert>
                ) : (
                    <>
                        {isPrivateLoading && (
                            <ListPanelSkeleton rows={1} />
                        )}
                        {(privateError ?? feedActionError) !== null && (
                            <Alert variant="destructive">
                                <AlertDescription>
                                    {privateError ?? feedActionError}
                                </AlertDescription>
                            </Alert>
                        )}
                        {!isPrivateLoading && privateError === null && feedActionError === null && (
                            defaultPrivate === null ? (
                                <p className="text-sm text-muted-foreground">
                                    Noch kein privater Feed für dieses Konto.
                                </p>
                            ) : (
                                <ListPanel>
                                    <ListPanelRow key={defaultPrivate.id}>
                                        <div className="min-w-0 flex-1 space-y-3">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <p className="font-medium">
                                                    {defaultPrivate.title}
                                                </p>
                                                <Badge variant={defaultPrivate.enabled ? 'secondary' : 'outline'}>
                                                    {defaultPrivate.enabled ? 'Aktiv' : 'Deaktiviert'}
                                                </Badge>
                                            </div>
                                            <p className="text-sm text-muted-foreground">
                                                Aktualisiert{' '}
                                                {formatPublishedAt(defaultPrivate.updatedAt)}
                                            </p>
                                            {defaultPrivate.enabled ? (
                                                <FeedUrlDisplay url={defaultPrivate.url} />
                                            ) : (
                                                <p className="text-sm text-muted-foreground">
                                                    Dieser Feed ist derzeit deaktiviert.
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            <Button
                                                disabled={feedActionBusy}
                                                onClick={() =>
                                                    void handleToggleDefault(
                                                        !defaultPrivate.enabled,
                                                    )
                                                }
                                                size="sm"
                                                type="button"
                                                variant="outline"
                                            >
                                                {defaultPrivate.enabled
                                                    ? 'Deaktivieren'
                                                    : 'Aktivieren'}
                                            </Button>
                                            <Button
                                                disabled={feedActionBusy}
                                                onClick={() => void handleRotate()}
                                                size="sm"
                                                type="button"
                                                variant="outline"
                                            >
                                                Token erneuern
                                            </Button>
                                        </div>
                                    </ListPanelRow>
                                </ListPanel>
                            )
                        )}
                    </>
                )}
            </section>

            {showFeedBuilder ? (
                <ArticleCustomFeedsPanel
                    canBuild={canBuildFeeds}
                    feeds={privateFeeds}
                    onAuthRequired={() =>
                        setFeedActionError(
                            'Bitte erneut anmelden, um private Feeds zu sehen.',
                        )
                    }
                    onError={setFeedActionError}
                    onFeedsChange={setPrivateFeeds}
                    tenantHost={tenantHost}
                />
            ) : null}
        </PageStack>
    )
}
