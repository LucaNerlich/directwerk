'use client'

import Link from 'next/link'
import {useEffect, useState} from 'react'

import EmptyState from '@directwerk/ui/components/empty-state'
import PageHeader from '@directwerk/ui/components/page-header'
import PageStack from '@directwerk/ui/components/page-stack'
import {Skeleton} from '@directwerk/ui/components/skeleton'
import type {PublicNewsletterList} from '@directwerk/api/types'

import NewsletterSubscribeForm from '@/components/newsletter/NewsletterSubscribeForm'
import {listPublicNewsletterLists} from '@/lib/api/publicApi'
import {useSiteConfig} from '@/lib/site/SiteConfigProvider'

interface NewsletterIndexClientProps {
    initialLists: PublicNewsletterList[] | null
}

export default function NewsletterIndexClient({
    initialLists,
}: NewsletterIndexClientProps): React.JSX.Element {
    const config = useSiteConfig()
    const emailNotify = config.emailNotifyAvailable === true
    const [lists, setLists] = useState<PublicNewsletterList[] | null>(initialLists)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (initialLists !== null || !emailNotify) {
            return
        }
        let cancelled = false
        void listPublicNewsletterLists()
            .then((rows) => {
                if (!cancelled) {
                    setLists(rows)
                }
            })
            .catch((err: unknown) => {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : 'Listen konnten nicht geladen werden.')
                }
            })
        return () => {
            cancelled = true
        }
    }, [emailNotify, initialLists])

    if (!emailNotify) {
        return (
            <PageStack className="page-container">
                <PageHeader title="Newsletter" description="Newsletter sind für diesen Tenant nicht aktiv." />
            </PageStack>
        )
    }

    if (lists === null && error === null) {
        return (
            <PageStack className="page-container">
                <PageHeader
                    title="Newsletter abonnieren"
                    description="Keine Anmeldung nötig. Du bekommst eine Bestätigungsmail."
                />
                <Skeleton className="h-24 max-w-md w-full" />
            </PageStack>
        )
    }

    if (error !== null) {
        return (
            <PageStack className="page-container">
                <PageHeader title="Newsletter" description={error} />
            </PageStack>
        )
    }

    const rows = lists ?? []

    if (rows.length === 0) {
        return (
            <PageStack className="page-container">
                <PageHeader
                    title="Newsletter"
                    description="Zurzeit gibt es keine offenen Newsletter-Listen."
                />
                <EmptyState
                    title="Keine Listen"
                    description="Sobald der Creator eine Liste anlegt, kannst du sie hier abonnieren."
                />
            </PageStack>
        )
    }

    if (rows.length === 1) {
        const list = rows[0]
        return (
            <PageStack className="page-container">
                <PageHeader
                    title={list.name}
                    description={
                        list.description?.trim() ||
                        'Keine Anmeldung nötig. Du bekommst eine Bestätigungsmail.'
                    }
                />
                <NewsletterSubscribeForm listSlug={list.slug} />
            </PageStack>
        )
    }

    return (
        <PageStack className="page-container">
            <PageHeader
                title="Newsletter abonnieren"
                description="Wähle eine Liste. Keine Anmeldung nötig — du bekommst eine Bestätigungsmail."
            />
            <ul className="grid max-w-xl gap-3">
                {rows.map((list) => (
                    <li key={list.slug}>
                        <Link
                            className="block rounded-lg border px-4 py-3 transition-colors hover:bg-muted/40"
                            href={`/newsletter/${encodeURIComponent(list.slug)}`}
                        >
                            <p className="font-medium text-foreground">{list.name}</p>
                            {list.description?.trim() ? (
                                <p className="mt-1 text-sm text-muted-foreground">{list.description}</p>
                            ) : (
                                <p className="mt-1 text-sm text-muted-foreground">Abonnieren</p>
                            )}
                        </Link>
                    </li>
                ))}
            </ul>
        </PageStack>
    )
}
