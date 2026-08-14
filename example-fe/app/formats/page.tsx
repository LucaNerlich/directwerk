'use client'

import {useEffect, useState} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import PageHeader from '@directwerk/ui/components/page-header'

import {listPublicCategories, listPublicFormats} from '@/lib/api/client'
import type {PublicCategory, PublicFormat} from '@/lib/api/types'
import {useSelectedTenant} from '@/lib/useSelectedTenant'

export default function FormatsPage(): React.JSX.Element {
    const tenantHost = useSelectedTenant()
    const [formats, setFormats] = useState<PublicFormat[]>([])
    const [categories, setCategories] = useState<PublicCategory[]>([])
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        let active = true
        setIsLoading(true)
        setErrorMessage(null)

        Promise.all([listPublicFormats(tenantHost), listPublicCategories(tenantHost)])
            .then(([formatList, categoryList]) => {
                if (!active) {
                    return
                }
                setFormats(formatList)
                setCategories(categoryList)
            })
            .catch((error: unknown) => {
                if (!active) {
                    return
                }
                setFormats([])
                setCategories([])
                setErrorMessage(
                    error instanceof Error
                        ? error.message
                        : 'Unable to load formats and categories.',
                )
            })
            .finally(() => {
                if (active) {
                    setIsLoading(false)
                }
            })

        return () => {
            active = false
        }
    }, [tenantHost])

    return (
        <div className="page-container space-y-8">
            <PageHeader
                title="Formats & categories"
                description={
                    <span>
                        Podcast formats (Formate) and shared categories from the public
                        API. Tenant: <code>{tenantHost}</code>
                    </span>
                }
            />
            {isLoading ? <p>Loading…</p> : null}
            {errorMessage !== null ? (
                <Alert variant="destructive">
                    <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
            ) : null}
            {!isLoading && errorMessage === null ? (
                <>
                    <section className="space-y-3">
                        <h2>Formats</h2>
                        {formats.length === 0 ? (
                            <p>No active formats.</p>
                        ) : (
                            <ul className="space-y-2">
                                {formats.map((format) => (
                                    <li key={format.id}>
                                        <strong>{format.name}</strong>{' '}
                                        <code>{format.slug}</code>
                                        {format.description !== null &&
                                        format.description.length > 0 ? (
                                            <p className="text-sm text-muted-foreground">
                                                {format.description}
                                            </p>
                                        ) : null}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                    <section className="space-y-3">
                        <h2>Categories</h2>
                        {categories.length === 0 ? (
                            <p>No active categories.</p>
                        ) : (
                            <ul className="space-y-2">
                                {categories.map((category) => (
                                    <li key={category.id}>
                                        <strong>{category.name}</strong>{' '}
                                        <code>{category.slug}</code>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                </>
            ) : null}
        </div>
    )
}
