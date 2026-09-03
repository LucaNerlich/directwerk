'use client'

import Link from 'next/link'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Button} from '@directwerk/ui/components/button'
import EmptyState from '@directwerk/ui/components/empty-state'
import ListPanel from '@directwerk/ui/components/list-panel'
import PageHeader from '@directwerk/ui/components/page-header'
import PageStack from '@directwerk/ui/components/page-stack'
import SectionHeader from '@directwerk/ui/components/section-header'

import AccessPolicyBadge from '@/components/AccessPolicyBadge'
import CatalogRow, {LockedCatalogAction} from '@/components/CatalogRow'
import {ListPanelSkeleton} from '@/components/ContentLoadingSkeleton'
import PublicFeedFooter, {PublicFeedStrip} from '@/components/PublicFeedFooter'
import SubscriberContextBanner from '@/components/SubscriberContextBanner'
import {usePublicArticles} from '@/lib/catalog/usePublicArticles'
import {findUnlockProduct, unlockHref} from '@/lib/catalog/unlock'
import {usePublicProducts} from '@/lib/catalog/usePublicProducts'
import {useArticleFeeds} from '@/lib/auth/useArticleFeeds'
import {useSubscriberAuth} from '@/lib/auth/useSubscriberAuth'
import {getClientTenantHost} from '@/lib/tenant/clientHost'
import {webPublicArticleFeedUrl} from '@/lib/feeds/webPublicFeedUrl'
import {formatPublishedAt} from '@directwerk/api/format/datetime'

export default function ArticlesPage() {
    const tenantHost = getClientTenantHost()
    const {isAuthenticated} = useSubscriberAuth()
    const {siteConfig, articles, errorMessage, isLoading} = usePublicArticles({
        tenantHost,
        isAuthenticated,
    })
    const products = usePublicProducts(tenantHost)
    const unlockTarget = unlockHref(findUnlockProduct(products))
    const {feeds: privateFeeds} = useArticleFeeds(
        isAuthenticated && (siteConfig?.enabledModules.includes('ARTICLE_RSS') ?? false),
    )
    const defaultPrivateFeed = privateFeeds.find((feed) => feed.isDefault) ?? null
    const publicArticleFeedUrl =
        siteConfig === null ? null : webPublicArticleFeedUrl(siteConfig, tenantHost)

    return (
        <PageStack className="page-container">
            <PageHeader
                eyebrow="Magazin"
                title="Beiträge"
                description={
                    isAuthenticated
                        ? 'Angemeldet: freie und für dich freigeschaltete Beiträge.'
                        : 'Öffentlich: nur freie Beiträge. Anmelden für bezahlte Inhalte.'
                }
            />
            {publicArticleFeedUrl !== null ? (
                <PublicFeedStrip kind="articles" publicFeedUrl={publicArticleFeedUrl} />
            ) : null}
            <SubscriberContextBanner showWhenAuthenticated={false} />

            {isLoading ? <ListPanelSkeleton rows={5} /> : null}
            {errorMessage !== null ? (
                <Alert variant="destructive">
                    <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
            ) : null}
            {!isLoading && errorMessage === null && articles.length === 0 ? (
                <EmptyState
                    title="Noch keine Beiträge"
                    description="Veröffentlichte Beiträge erscheinen hier."
                    action={
                        !isAuthenticated ? (
                            <Button nativeButton={false} render={<Link href="/login" />}>
                                Anmelden
                            </Button>
                        ) : undefined
                    }
                />
            ) : null}
            {articles.length > 0 ? (
                <section className="flex flex-col gap-4">
                    <SectionHeader
                        description={`${articles.length} ${articles.length === 1 ? 'Beitrag' : 'Beiträge'} sichtbar.`}
                        title="Veröffentlichte Beiträge"
                    />
                    <ListPanel>
                        {articles.map((article) => {
                            const href = `/articles/${encodeURIComponent(article.slug)}`
                            const isLocked =
                                article.accessPolicy === 'PAID' && article.body === null
                            return (
                                <CatalogRow
                                    key={article.id}
                                    href={href}
                                    title={article.title}
                                    badge={
                                        <AccessPolicyBadge
                                            policy={article.accessPolicy}
                                            isEntitled={
                                                article.accessPolicy === 'PAID'
                                                    ? !isLocked
                                                    : undefined
                                            }
                                        />
                                    }
                                    metaItems={[
                                        article.categories.length > 0
                                            ? article.categories
                                                  .map((category) => category.name)
                                                  .join(', ')
                                            : null,
                                        formatPublishedAt(article.publishedAt),
                                    ]}
                                    excerpt={article.excerpt}
                                    action={
                                        article.body !== null ? (
                                            <Button
                                                nativeButton={false}
                                                render={<Link href={href} />}
                                                size="sm"
                                                variant="outline"
                                            >
                                                Lesen
                                            </Button>
                                        ) : isLocked ? (
                                            <LockedCatalogAction
                                                isAuthenticated={isAuthenticated}
                                                unlockHref={unlockTarget}
                                            />
                                        ) : (
                                            <span className="max-w-32 text-right text-xs text-muted-foreground">
                                                Kein Text
                                            </span>
                                        )
                                    }
                                />
                            )
                        })}
                    </ListPanel>
                </section>
            ) : null}

            {!isLoading && errorMessage === null ? (
                <PublicFeedFooter
                    kind="articles"
                    publicFeedUrl={publicArticleFeedUrl}
                    privateFeedUrl={
                        defaultPrivateFeed !== null && defaultPrivateFeed.enabled
                            ? defaultPrivateFeed.url
                            : null
                    }
                    isAuthenticated={isAuthenticated}
                />
            ) : null}
        </PageStack>
    )
}
