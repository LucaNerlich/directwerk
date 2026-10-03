import Link from 'next/link'

import {Button} from '@directwerk/ui/components/button'
import EmptyState from '@directwerk/ui/components/empty-state'
import FeatureCard from '@directwerk/ui/components/feature-card'
import PageHeader from '@directwerk/ui/components/page-header'
import PageStack from '@directwerk/ui/components/page-stack'

import OverviewOpsWidgets from '@/components/studio/OverviewOpsWidgets'
import OverviewQueue from '@/components/studio/OverviewQueue'
import {assertLocale, getDictionary, localizedPath, t} from '@/lib/i18n'
import {requireStudioSiteConfig} from '@/lib/site/requireSiteConfig'

export default async function OverviewPage({
    params,
}: {
    params: Promise<{lang: string}>
}) {
    const {lang: langParam} = await params
    const lang = assertLocale(langParam)
    const dict = await getDictionary(lang)
    const {config} = await requireStudioSiteConfig(lang)
    const desks = new Set(config.studioDesks)
    const hasDesks = desks.has('WRITE') || desks.has('PODCAST')
    const home = dict.shell.home

    return (
        <PageStack>
            <nav aria-label={home.breadcrumbs}>
                <ol className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <li aria-current="page" className="font-medium text-foreground">
                        {home.overview}
                    </li>
                </ol>
            </nav>
            <PageHeader
                eyebrow={dict.meta.productName}
                title={home.headline}
                description={t(home.welcome, {tenantName: config.tenant.name})}
            />
            {!hasDesks ? (
                <EmptyState title={home.noDeskTitle} description={home.noDeskDescription} />
            ) : (
                <section aria-label={dict.shell.desksAria} className="grid gap-4 sm:grid-cols-2">
                    {desks.has('WRITE') ? (
                        <FeatureCard
                            eyebrow={home.writeDeskEyebrow}
                            description={home.writeDescription}
                            title={home.writeDesk}
                        >
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    nativeButton={false}
                                    render={<Link href={localizedPath(lang, '/write/articles/new')} />}
                                >
                                    {home.newArticle}
                                </Button>
                                <Button
                                    nativeButton={false}
                                    render={<Link href={localizedPath(lang, '/write')} />}
                                    variant="outline"
                                >
                                    {home.writeOverview}
                                </Button>
                            </div>
                        </FeatureCard>
                    ) : null}
                    {desks.has('PODCAST') ? (
                        <FeatureCard
                            eyebrow={home.podcastDesk}
                            description={home.podcastDescription}
                            title={dict.desks.podcast}
                        >
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    nativeButton={false}
                                    render={
                                        <Link href={localizedPath(lang, '/podcast/episodes/new')} />
                                    }
                                >
                                    {home.newEpisode}
                                </Button>
                                <Button
                                    nativeButton={false}
                                    render={<Link href={localizedPath(lang, '/podcast')} />}
                                    variant="outline"
                                >
                                    {home.podcastOverview}
                                </Button>
                            </div>
                        </FeatureCard>
                    ) : null}
                </section>
            )}
            <OverviewOpsWidgets />
            <OverviewQueue desks={config.studioDesks} />
        </PageStack>
    )
}
