import {notFound} from 'next/navigation'

import BrandTheme from '@directwerk/ui/components/brand-theme'
import {Button} from '@directwerk/ui/components/button'
import FeatureCard from '@directwerk/ui/components/feature-card'
import AppShell from '@directwerk/ui/components/layout/app-shell'
import ListPanel, {ListPanelRow} from '@directwerk/ui/components/list-panel'
import PageHeader from '@directwerk/ui/components/page-header'
import PageStack from '@directwerk/ui/components/page-stack'
import StatCard from '@directwerk/ui/components/stat-card'

/**
 * Local visual QA for studio brand atmosphere (gradients, glass sidebar, neo panels).
 * Production returns 404 — not part of the creator workflow.
 */
export default function BrandPreviewPage(): React.JSX.Element {
    if (process.env.NODE_ENV === 'production') {
        notFound()
    }

    return (
        <BrandTheme
            className="dw-brand min-h-svh"
            primaryHex="#c45c26"
            secondaryHex="#2f5d50"
        >
            <AppShell
                brand={
                    <div className="flex min-w-0 flex-col gap-1">
                        <p className="truncate text-sm font-semibold">Wellenwerk</p>
                        <p className="text-xs text-muted-foreground">Directwerk Studio</p>
                    </div>
                }
                footer={<p className="px-2 text-xs text-muted-foreground">Abmelden</p>}
                navigation={
                    <nav aria-label="Vorschau" className="flex flex-col gap-1 px-2">
                        <span className="rounded-md bg-sidebar-accent px-3 py-2 text-sm font-medium">
                            Übersicht
                        </span>
                        <span className="px-3 py-2 text-sm text-muted-foreground">Schreiben</span>
                        <span className="px-3 py-2 text-sm text-muted-foreground">Podcast</span>
                        <span className="px-3 py-2 text-sm text-muted-foreground">Medien</span>
                    </nav>
                }
                navigationTriggerLabel="Navigation öffnen"
                skipLinkLabel="Zum Inhalt springen"
            >
                <PageStack>
                    <PageHeader
                        description="Brand-Atmosphäre für das Creator-Dashboard (Glass, Soft-Neo, Token-Wash)."
                        eyebrow="Design preview"
                        title="Studio Übersicht"
                    />
                    <section className="grid gap-4 sm:grid-cols-3">
                        <StatCard hint="diese Woche" label="Entwürfe" value={4} />
                        <StatCard hint="bereit" label="Episoden" value={12} />
                        <StatCard hint="aktiv" label="Abos" value={86} />
                    </section>
                    <section className="grid gap-4 sm:grid-cols-2">
                        <FeatureCard
                            description="Artikel und Listen aus dem Schreibpult."
                            eyebrow="Schreiben"
                            title="Schreibpult"
                        >
                            <Button type="button">Neuer Artikel</Button>
                        </FeatureCard>
                        <FeatureCard
                            description="Serien, Formate und Episoden."
                            eyebrow="Podcast"
                            title="Podcast-Pult"
                        >
                            <Button type="button" variant="outline">
                                Neue Episode
                            </Button>
                        </FeatureCard>
                    </section>
                    <ListPanel aria-label="Warteschlange">
                        <ListPanelRow>
                            <div>
                                <p className="font-medium">Draft: Frühlingsthema</p>
                                <p className="text-sm text-muted-foreground">Artikel · Entwurf</p>
                            </div>
                        </ListPanelRow>
                        <ListPanelRow>
                            <div>
                                <p className="font-medium">Episode 42 — Schnitt</p>
                                <p className="text-sm text-muted-foreground">Podcast · In Arbeit</p>
                            </div>
                        </ListPanelRow>
                    </ListPanel>
                </PageStack>
            </AppShell>
        </BrandTheme>
    )
}
