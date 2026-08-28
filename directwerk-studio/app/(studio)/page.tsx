import Link from 'next/link'

import {Button} from '@directwerk/ui/components/button'
import FeatureCard from '@directwerk/ui/components/feature-card'
import PageHeader from '@directwerk/ui/components/page-header'
import PageStack from '@directwerk/ui/components/page-stack'

import OverviewQueue from '@/components/studio/OverviewQueue'
import {fetchSiteConfigServer} from '@/lib/site/fetchSiteConfigServer'
import {getTenantHost} from '@/lib/site/getTenantHost'

export default async function OverviewPage() {
    const host = await getTenantHost()
    const config = await fetchSiteConfigServer(host)
    const desks = new Set(config.studioDesks)

    return (
        <PageStack>
            <PageHeader
                eyebrow="Directwerk Studio"
                title="Was möchtest du veröffentlichen?"
                description={
                    <>
                        Willkommen im Studio für <strong>{config.tenant.name}</strong>.
                        Starte mit dem nächsten Inhalt — Einrichtung und Abos liegen
                        getrennt davon.
                    </>
                }
            />
            <section className="grid gap-4 sm:grid-cols-2">
                {desks.has('WRITE') ? (
                    <FeatureCard
                        description="Beitrag schreiben und veröffentlichen."
                        title="Schreiben"
                    >
                        <div className="flex flex-wrap gap-2">
                            <Button nativeButton={false} render={<Link href="/write/articles/new" />}>
                                Neuer Beitrag
                            </Button>
                            <Button
                                nativeButton={false}
                                render={<Link href="/write" />}
                                variant="outline"
                            >
                                Schreib-Übersicht
                            </Button>
                        </div>
                    </FeatureCard>
                ) : null}
                {desks.has('PODCAST') ? (
                    <FeatureCard
                        description="Folge erstellen — oder Einrichtung (Sendung, Formate) abschließen."
                        title="Podcast"
                    >
                        <div className="flex flex-wrap gap-2">
                            <Button nativeButton={false} render={<Link href="/podcast/episodes/new" />}>
                                Neue Folge
                            </Button>
                            <Button
                                nativeButton={false}
                                render={<Link href="/podcast" />}
                                variant="outline"
                            >
                                Podcast-Übersicht
                            </Button>
                        </div>
                    </FeatureCard>
                ) : null}
            </section>
            <OverviewQueue desks={config.studioDesks} />
        </PageStack>
    )
}
