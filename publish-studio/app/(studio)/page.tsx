import Link from 'next/link'

import {Button} from '@publish/ui/components/button'
import PageHeader from '@publish/ui/components/page-header'

import OverviewQueue from '@/components/studio/OverviewQueue'
import {defaultHomePath} from '@/lib/api/client'
import {fetchSiteConfigServer} from '@/lib/site/fetchSiteConfigServer'
import {getTenantHost} from '@/lib/site/getTenantHost'

export default async function OverviewPage() {
    const host = await getTenantHost()
    const config = await fetchSiteConfigServer(host)
    const desks = new Set(config.studioDesks)

    return (
        <div className="flex flex-col gap-6">
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
                    <div className="flex flex-col gap-4 rounded-xl border bg-card p-5">
                        <div>
                            <h2 className="text-lg font-semibold">Schreiben</h2>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Beitrag schreiben und veröffentlichen.
                            </p>
                        </div>
                        <Button nativeButton={false} render={<Link href="/write/articles/new" />}>
                            Neuer Beitrag
                        </Button>
                    </div>
                ) : null}
                {desks.has('PODCAST') ? (
                    <div className="flex flex-col gap-4 rounded-xl border bg-card p-5">
                        <div>
                            <h2 className="text-lg font-semibold">Podcast</h2>
                            <p className="mt-1 text-sm text-muted-foreground">
                                Folge erstellen — oder Einrichtung (Sendung, Formate)
                                abschließen.
                            </p>
                        </div>
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
                    </div>
                ) : null}
            </section>
            <OverviewQueue desks={config.studioDesks} />
            <p className="text-sm text-muted-foreground">
                Standard-Start: <code>{defaultHomePath(config.studioHome)}</code>
            </p>
        </div>
    )
}
