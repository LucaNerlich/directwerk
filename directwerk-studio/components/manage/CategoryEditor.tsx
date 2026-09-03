'use client'

import SelectControl from '@/components/studio/SelectControl'
import {suggestSlug} from '@/lib/api/studioHelpers'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Button} from '@directwerk/ui/components/button'
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@directwerk/ui/components/card'
import {Input} from '@directwerk/ui/components/input'
import {Label} from '@directwerk/ui/components/label'
import PageHeader from '@directwerk/ui/components/page-header'
import PageStack from '@directwerk/ui/components/page-stack'
import {Skeleton} from '@directwerk/ui/components/skeleton'

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
        return (
            <PageStack>
                <PageHeader
                    eyebrow="Organisation"
                    title={isNew ? 'Neue Kategorie' : 'Kategorie bearbeiten'}
                    description="Themen-Tags für Folgen und Beiträge — getrennt von Podcast-Formaten."
                />
                <p className="text-sm text-muted-foreground" role="status">Laden…</p>
                <Skeleton className="h-64 w-full max-w-xl" />
            </PageStack>
        )
    }

    if (loadError) {
        return (
            <PageStack>
                <Alert variant="destructive">
                    <AlertDescription>
                        {loadError}{' '}
                        <Link className="underline underline-offset-4" href="/manage/categories">
                            Zurück zur Liste
                        </Link>
                    </AlertDescription>
                </Alert>
            </PageStack>
        )
    }

    const parentOptions = categories.filter(
        (item) => item.active && item.id !== categoryId && item.parentId === null,
    )

    return (
        <PageStack>
            <PageHeader
                eyebrow="Organisation"
                title={isNew ? 'Neue Kategorie' : 'Kategorie bearbeiten'}
                description="Themen-Tags für Folgen und Beiträge — getrennt von Podcast-Formaten."
                actions={
                    <Button nativeButton={false} render={<Link href="/manage/categories" />} variant="outline">
                        Zurück zur Liste
                    </Button>
                }
            />

            {state.error ? (
                <Alert variant="destructive">
                    <AlertDescription>{state.error}</AlertDescription>
                </Alert>
            ) : null}
            {state.success ? (
                <Alert role="status">
                    <AlertDescription>{state.success}</AlertDescription>
                </Alert>
            ) : null}
            {deactivateError ? (
                <Alert variant="destructive">
                    <AlertDescription>{deactivateError}</AlertDescription>
                </Alert>
            ) : null}

            <Card className="max-w-xl">
                <CardHeader>
                    <CardTitle>Details</CardTitle>
                    <CardDescription>Name, Kennung und optionale Oberkategorie.</CardDescription>
                </CardHeader>
                <CardContent>
            <Form action={formAction} className="grid gap-5">
                <div className="grid gap-2">
                    <Label htmlFor="category-name">Name</Label>
                    <Input
                        aria-describedby="category-name-help"
                        defaultValue={category?.name ?? ''}
                        id="category-name"
                        maxLength={255}
                        name="name"
                        placeholder="z. B. Interviews"
                        required
                        type="text"
                    />
                    <p className="text-xs text-muted-foreground" id="category-name-help">
                        Anzeigename in Listen und Filtern.
                    </p>
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="category-slug">Slug</Label>
                    <Input
                        aria-describedby="category-slug-help"
                        defaultValue={category?.slug ?? ''}
                        disabled={!isNew}
                        id="category-slug"
                        maxLength={64}
                        name="slug"
                        pattern={HTML_SLUG_PATTERN}
                        placeholder="z. B. interviews"
                        required={isNew}
                        type="text"
                    />
                    <p className="text-xs text-muted-foreground" id="category-slug-help">
                        Technische Kennung aus Kleinbuchstaben, Zahlen und Bindestrichen.
                        {isNew ? ' Wird aus dem Namen vorgeschlagen, wenn du sie leer lässt.' : ' Nach dem Anlegen nicht mehr änderbar.'}
                    </p>
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="category-parent">Übergeordnete Kategorie</Label>
                    <SelectControl
                        aria-describedby="category-parent-help"
                        defaultValue={category?.parentId ?? ''}
                        id="category-parent"
                        name="parentId"
                    >
                        <option value="">— Keine (oberste Kategorie) —</option>
                        {parentOptions.map((item) => (
                            <option key={item.id} value={item.id}>
                                {item.name}
                            </option>
                        ))}
                    </SelectControl>
                    <p className="text-xs text-muted-foreground" id="category-parent-help">
                        Optional. Nur aktive Oberkategorien ohne eigene Eltern stehen zur Auswahl.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Button disabled={pending} type="submit">
                        {pending ? 'Speichert…' : 'Speichern'}
                    </Button>
                    {!isNew && category?.active ? (
                        <>
                            <Button
                                disabled={isDeactivating}
                                onClick={() => void handleDeactivate()}
                                type="button"
                                variant="outline"
                            >
                                {isDeactivating ? 'Deaktiviert…' : 'Deaktivieren'}
                            </Button>
                        </>
                    ) : null}
                </div>
            </Form>
                </CardContent>
            </Card>
        </PageStack>
    )
}
