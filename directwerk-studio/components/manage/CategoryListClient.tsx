'use client'

import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {useEffect, useState} from 'react'

import {Button} from '@directwerk/ui/components/button'
import EmptyState from '@directwerk/ui/components/empty-state'
import PageHeader from '@directwerk/ui/components/page-header'

import {listCategories} from '@/lib/api/tenantApi'
import type {CategorySummary} from '@directwerk/api/types'
import {getClientTenantHost} from '@/lib/tenant/getClientTenantHost'
import {useAuthRequired} from '@directwerk/api/auth/useAuthRequired'

export default function CategoryListClient(): React.JSX.Element {
    const router = useRouter()
    const authRedirect = useAuthRequired()
    const [categories, setCategories] = useState<CategorySummary[] | null>(null)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)

    useEffect(() => {
        let active = true

        listCategories(getClientTenantHost())
            .then((result) => {
                if (active) {
                    setCategories(result)
                }
            })
            .catch((error: unknown) => {
                if (!active) {
                    return
                }
                if (authRedirect(error)) return
                setErrorMessage(
                    error instanceof Error
                        ? error.message
                        : 'Kategorien konnten nicht geladen werden.',
                )
            })

        return () => {
            active = false
        }
    }, [router])

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                eyebrow="Organisation"
                title="Kategorien"
                description="Optionale Themen-Tags für Folgen und Beiträge — getrennt von Podcast-Formaten."
                actions={
                    <Button nativeButton={false} render={<Link href="/manage/categories/new" />} size="lg">
                        Neue Kategorie
                    </Button>
                }
            />

            {errorMessage ? (
                <p className="text-sm text-destructive" role="alert">
                    {errorMessage}
                </p>
            ) : null}
            {categories === null && !errorMessage ? <p>Laden…</p> : null}
            {categories && categories.length === 0 ? (
                <EmptyState
                    title="Noch keine Kategorien"
                    description="Kategorien sind optional. Mit ihnen sortierst du Beiträge und Folgen nach Themen."
                    action={
                        <Button nativeButton={false} render={<Link href="/manage/categories/new" />}>
                            Erste Kategorie anlegen
                        </Button>
                    }
                />
            ) : null}
            {categories && categories.length > 0 ? (
                <ul className="overflow-hidden rounded-xl border bg-card divide-y">
                    {categories.map((category) => (
                        <li key={category.id}>
                            <Link
                                className="flex w-full items-center justify-between gap-4 p-4 text-sm no-underline hover:bg-muted/40"
                                href={`/manage/categories/${category.id}`}
                            >
                                <span>
                                    <span className="font-medium">{category.name}</span>
                                    <br />
                                    <small className="text-muted-foreground">{category.slug}</small>
                                </span>
                                <span className="flex shrink-0 items-center gap-3 text-sm text-muted-foreground">
                                    {category.active ? 'Aktiv' : 'Inaktiv'}
                                </span>
                            </Link>
                        </li>
                    ))}
                </ul>
            ) : null}
        </div>
    )
}
