import Link from 'next/link'

import {Button} from '@directwerk/ui/components/button'
import EmptyState from '@directwerk/ui/components/empty-state'
import FeatureCard from '@directwerk/ui/components/feature-card'
import PageHeader from '@directwerk/ui/components/page-header'
import PageStack from '@directwerk/ui/components/page-stack'

import OverviewQueue from '@/components/studio/OverviewQueue'
import {requireStudioSiteConfig} from '@/lib/site/requireSiteConfig'

export default async function OverviewPage() {
    const {config} = await requireStudioSiteConfig()
    const desks = new Set(config.studioDesks)
    const hasDesks = desks.has('WRITE') || desks.has('PODCAST')

    return (
        <PageStack>
            <nav aria-label="Brotkrumen">
                <ol className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <li aria-current="page" className="font-medium text-foreground">
                        Übersicht
                    </li>
                </ol>
            </nav>
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
            {!hasDesks ? (
                <EmptyState
                    title="Noch kein Desk freigeschaltet"
                    description="Für diesen Mandanten ist weder Schreiben noch Podcast aktiviert. Bitte wende dich an dein Team, um einen Bereich freischalten zu lassen."
                />
            ) : (
                <section
                    aria-label="Desks"
                    className="grid gap-4 sm:grid-cols-2"
                >
                    {desks.has('WRITE') ? (
                        <FeatureCard
                            eyebrow="Write Desk"
                            description="Beitrag schreiben, einplanen und veröffentlichen. Ideal für den schnellen Einstieg."
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
                            eyebrow="Podcast Desk"
                            description="Folge erstellen — oder zuerst Sendung und Formate als Einrichtung abschließen."
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
            )}
            <OverviewQueue desks={config.studioDesks} />
        </PageStack>
    )
}
