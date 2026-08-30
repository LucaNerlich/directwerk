'use client'

import SelectControl from '@/components/studio/SelectControl'
import {suggestSlug} from '@/lib/api/studioHelpers'

import {Button} from '@directwerk/ui/components/button'
import {Input} from '@directwerk/ui/components/input'

import Link from 'next/link'
import Form from 'next/form'
import {useRouter} from 'next/navigation'
import {useActionState, useEffect, useState} from 'react'

import {AUTH_REQUIRED, HTML_SLUG_PATTERN} from '@directwerk/api/constants'
import {createCategory, deactivateCategory, listCategories, updateCategory} from '@/lib/api/catalogApi'
import type {CategorySummary} from '@directwerk/api/types'
import {getClientTenantHost} from '@directwerk/api/tenant'
import {useAuthRequired} from '@directwerk/api/auth/useAuthRequired'

interface CategoryEditorProps {
    categoryId?: number
}

interface CategoryFormState {
    error: string | null
    success: string | null
}

interface DeactivateState {
    error: string | null
}

const INITIAL_STATE: CategoryFormState = {error: null, success: null}

function parseOptionalId(value: FormDataEntryValue | null): number | undefined {
    const text = String(value ?? '').trim()
    if (text.length === 0) {
        return undefined
    }
    const parsed = Number.parseInt(text, 10)
    return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : undefined
}

export default function CategoryEditor({categoryId}: CategoryEditorProps): React.JSX.Element {
    const router = useRouter()
    const authRedirect = useAuthRequired()
    const isNew = categoryId === undefined
    const [categories, setCategories] = useState<CategorySummary[]>([])
    const [category, setCategory] = useState<CategorySummary | null>(null)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(!isNew)
    const [isDeactivating, setIsDeactivating] = useState(false)
    const [deactivateError, setDeactivateError] = useState<string | null>(null)

    useEffect(() => {
        let active = true

        listCategories(getClientTenantHost())
            .then((allCategories) => {
                if (!active) {
                    return
                }
                setCategories(allCategories)
                if (categoryId !== undefined) {
                    const found = allCategories.find((item) => item.id === categoryId)
                    if (!found) {
                        setLoadError('Kategorie wurde nicht gefunden.')
                    } else {
                        setCategory(found)
                    }
                }
                setIsLoading(false)
            })
            .catch((error: unknown) => {
                if (!active) {
                    return
                }
                if (authRedirect(error)) return
                setLoadError(
                    error instanceof Error
                        ? error.message
                        : 'Kategorie konnte nicht geladen werden.',
                )
                setIsLoading(false)
            })

        return () => {
            active = false
        }
    }, [categoryId, router])

    async function saveAction(
        _previous: CategoryFormState,
        formData: FormData,
    ): Promise<CategoryFormState> {
        const name = String(formData.get('name') ?? '').trim()
        const slugInput = String(formData.get('slug') ?? '').trim()
        const parentId = parseOptionalId(formData.get('parentId'))

        if (name.length === 0) {
            return {error: 'Name ist erforderlich.', success: null}
        }

        const host = getClientTenantHost()

        try {
            if (isNew) {
                const resolvedSlug = slugInput || suggestSlug(name) || 'kategorie'
                const created = await createCategory(host, {slug: resolvedSlug, name, parentId})
                router.replace(`/manage/categories/${created.id}`)
                return {error: null, success: `Kategorie "${created.name}" angelegt.`}
            }

            const updated = await updateCategory(host, categoryId, {name, parentId})
            setCategory(updated)
            return {error: null, success: 'Kategorie gespeichert.'}
        } catch (error) {
            if (authRedirect(error)) return INITIAL_STATE
            return {
                error: error instanceof Error ? error.message : 'Aktion fehlgeschlagen.',
                success: null,
            }
        }
    }

    const [state, formAction, pending] = useActionState(saveAction, INITIAL_STATE)

    async function handleDeactivate(): Promise<void> {
        if (categoryId === undefined) {
            return
        }
        setIsDeactivating(true)
        setDeactivateError(null)
        try {
            const updated = await deactivateCategory(getClientTenantHost(), categoryId)
            setCategory(updated)
        } catch (error) {
            if (authRedirect(error)) return
            setDeactivateError(
                error instanceof Error ? error.message : 'Deaktivierung fehlgeschlagen.',
            )
        } finally {
            setIsDeactivating(false)
        }
    }

    if (isLoading) {
        return <p>Laden…</p>
    }

    if (loadError) {
        return (
            <p>
                {loadError} <Link href="/manage/categories">Zurück zur Liste</Link>
            </p>
        )
    }

    const parentOptions = categories.filter(
        (item) => item.active && item.id !== categoryId && item.parentId === null,
    )

    return (
        <div className="flex flex-col gap-6">
            <header className="flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Organisation
                    </p>
                    <h1>{isNew ? 'Neue Kategorie' : 'Kategorie bearbeiten'}</h1>
                </div>
                <Link className="text-sm font-medium text-primary underline-offset-4 hover:underline" href="/manage/categories">
                    Zurück zur Liste
                </Link>
            </header>

            {state.error ? (
                <p className="text-sm text-destructive" role="alert">
                    {state.error}
                </p>
            ) : null}
            {state.success ? <p role="status">{state.success}</p> : null}
            {deactivateError ? (
                <p className="text-sm text-destructive" role="alert">
                    {deactivateError}
                </p>
            ) : null}

            <Form action={formAction}>
                <p>
                    <label htmlFor="category-name">Name</label>
                    <br />
                    <Input
                        defaultValue={category?.name ?? ''}
                        id="category-name"
                        maxLength={255}
                        name="name"
                        required
                        type="text"
                    />
                </p>
                <p>
                    <label htmlFor="category-slug">Slug</label>
                    <br />
                    <Input
                        defaultValue={category?.slug ?? ''}
                        disabled={!isNew}
                        id="category-slug"
                        maxLength={64}
                        name="slug"
                        pattern={HTML_SLUG_PATTERN}
                        required={isNew}
                        type="text"
                    />
                </p>
                <p>
                    <label htmlFor="category-parent">Übergeordnete Kategorie</label>
                    <br />
                    <SelectControl
                        defaultValue={category?.parentId ?? ''}
                        id="category-parent"
                        name="parentId"
                    >
                        <option value="">— Keine —</option>
                        {parentOptions.map((item) => (
                            <option key={item.id} value={item.id}>
                                {item.name}
                            </option>
                        ))}
                    </SelectControl>
                </p>
                <p>
                    <Button disabled={pending} type="submit">
                        {pending ? 'Speichert…' : 'Speichern'}
                    </Button>
                    {!isNew && category?.active ? (
                        <>
                            {' '}
                            <Button
                                disabled={isDeactivating}
                                onClick={() => void handleDeactivate()}
                                type="button"
                            >
                                {isDeactivating ? 'Deaktiviert…' : 'Deaktivieren'}
                            </Button>
                        </>
                    ) : null}
                </p>
            </Form>
        </div>
    )
}
