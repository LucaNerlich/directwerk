'use client'

import LocaleLink from '@/components/i18n/LocaleLink'
import {useDictionary} from '@/components/i18n/LocaleProvider'
import {t} from '@/lib/i18n/dictionary'
import {useEffect, useState} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Badge} from '@directwerk/ui/components/badge'
import {Button} from '@directwerk/ui/components/button'
import EmptyState from '@directwerk/ui/components/empty-state'
import {EntityListSection} from '@directwerk/ui/components/entity-list-section'
import type {EntityListViewItem} from '@directwerk/ui/components/entity-list-view'
import PageHeader from '@directwerk/ui/components/page-header'
import PageStack from '@directwerk/ui/components/page-stack'
import SectionHeader from '@directwerk/ui/components/section-header'
import {Skeleton} from '@directwerk/ui/components/skeleton'
import {useListViewMode} from '@directwerk/ui/hooks/use-list-view-mode'

import PublicationStatusBadge from '@/components/publication/PublicationStatusBadge'
import {listDigitalPublications} from '@/lib/api/digitalPublicationsApi'
import type {DigitalPublication} from '@directwerk/api/types'
import {getClientTenantHost} from '@directwerk/api/tenant'
import {useAuthRequired} from '@directwerk/api/auth/useAuthRequired'

function formatBytes(
    sizeBytes: number | null,
    labels: {unknown: string; b: string; kb: string; mb: string},
): string {
    if (sizeBytes === null || sizeBytes <= 0) {
        return labels.unknown
    }
    if (sizeBytes < 1024) {
        return t(labels.b, {sizeBytes})
    }
    if (sizeBytes < 1024 * 1024) {
        return t(labels.kb, {value: (sizeBytes / 1024).toFixed(1)})
    }
    return t(labels.mb, {value: (sizeBytes / (1024 * 1024)).toFixed(1)})
}

export default function BonusLibraryClient(): React.JSX.Element {
    const dict = useDictionary()
    const b = dict.bonus
    const authRedirect = useAuthRequired()
    const [publications, setPublications] = useState<DigitalPublication[]>([])
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [reloadToken, setReloadToken] = useState(0)
    const {viewMode, setViewMode} = useListViewMode()

    useEffect(() => {
        let active = true
        setIsLoading(true)
        setErrorMessage(null)
        listDigitalPublications(getClientTenantHost())
            .then((result) => {
                if (!active) {
                    return
                }
                setPublications(result)
                setIsLoading(false)
            })
            .catch((error: unknown) => {
                if (!active) {
                    return
                }
                if (authRedirect(error)) return
                setErrorMessage(
                    error instanceof Error
                        ? error.message
                        : b.bonusdateienKonntenGeladen,
                )
                setIsLoading(false)
            })
        return () => {
            active = false
        }
    }, [reloadToken, authRedirect, b.bonusdateienKonntenGeladen])

    if (isLoading) {
        return (
            <PageStack>
                <PageHeader
                    eyebrow={b.mediaEyebrow}
                    title={b.title}
                    description={b.veroeffentlichbareDokumenteAbonnentenTitel}
                />
                <p className="text-sm text-muted-foreground" role="status">{dict.common.loading}</p>
                <div className="grid gap-4" aria-hidden="true">
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                </div>
            </PageStack>
        )
    }

    const sizeLabels = {
        unknown: b.groesseUnbekannt,
        b: b.b,
        kb: b.kb,
        mb: b.mb,
    }

    const items: EntityListViewItem[] = publications.map((publication) => ({
        id: publication.id,
        title: publication.title,
        href: `/bonus/${publication.id}`,
        description: `${publication.accessPolicy === 'PAID' ? dict.common.access.paid : dict.common.access.free} · ${publication.originalFilename ?? `Asset #${publication.assetId}`} · ${formatBytes(publication.sizeBytes, sizeLabels)}`,
        trailing: (
            <PublicationStatusBadge
                status={
                    publication.status === 'DRAFT'
                        ? 'DRAFT'
                        : publication.status === 'PUBLISHED'
                          ? 'PUBLISHED'
                          : 'ARCHIVED'
                }
            />
        ),
        actions: (
            <Button
                nativeButton={false}
                render={<LocaleLink href={`/bonus/${publication.id}`} />}
                variant="outline"
            >
                {dict.common.edit}
            </Button>
        ),
    }))

    return (
        <PageStack>
            <PageHeader
                eyebrow={b.mediaEyebrow}
                title={b.title}
                description={b.legeDokumenteBonusInhalteSetzeFrei}
                actions={
                    <Button nativeButton={false} render={<LocaleLink href="/bonus/new" />} size="lg">
                        {b.neueBonusdatei}
                    </Button>
                }
            />
            {errorMessage !== null ? (
                <Alert variant="destructive">
                    <AlertDescription>{errorMessage}</AlertDescription>
                    <Button
                        className="mt-3"
                        onClick={() => setReloadToken((value) => value + 1)}
                        type="button"
                        variant="outline"
                    >
                        {dict.common.retry}
                    </Button>
                </Alert>
            ) : null}
            {publications.length === 0 && errorMessage === null ? (
                <EmptyState
                    title={b.keineBonusdateien}
                    description={b.ladeZuerstPdfMediathekHochDann}
                    action={
                        <div className="flex flex-wrap justify-center gap-2">
                            <Button nativeButton={false} render={<LocaleLink href="/bonus/new" />}>
                                {b.createCta}
                            </Button>
                            <Button
                                nativeButton={false}
                                render={<LocaleLink href="/media" />}
                                variant="outline"
                            >
                                {b.toMediaLibrary}
                            </Button>
                        </div>
                    }
                />
            ) : null}
            {publications.length > 0 ? (
                <section aria-labelledby="bonus-files-heading" className="flex flex-col gap-4">
                    <SectionHeader
                        id="bonus-files-heading"
                        title={t(b.bonusdateien, {'publications.length': publications.length})}
                        description={b.listDescription}
                    />
                    <EntityListSection
                        items={items}
                        onViewModeChange={setViewMode}
                        showSelection={false}
                        viewMode={viewMode}
                    />
                    <p className="text-sm text-muted-foreground">
                        {b.paidNeedRule}{' '}
                        <LocaleLink className="underline" href="/manage/products">
                            {b.digitalAssetRule}
                        </LocaleLink>{' '}
                        {b.onPackage}
                    </p>
                    <Badge variant="outline" className="w-fit">
                        {b.moduleBadge}
                    </Badge>
                </section>
            ) : null}
        </PageStack>
    )
}
