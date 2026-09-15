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

import {HTML_SLUG_PATTERN} from '@directwerk/api/constants'
import {
    createCategory,
    deactivateCategory,
    listCategories,
    updateCategory,
} from '@/lib/api/catalogApi'
import type {
    CategorySummary,
    CreateCategoryInput,
    UpdateCategoryInput,
} from '@directwerk/api/types'
import {useResourceEditor} from '@/lib/hooks/useResourceEditor'

interface CategoryEditorProps {
    categoryId?: number
}

interface CategoryFormValues {
    name: string
    slug: string
    parentId: string
}

const INITIAL_VALUES: CategoryFormValues = {name: '', slug: '', parentId: ''}

function toCategoryValues(category: CategorySummary): CategoryFormValues {
    return {
        name: category.name,
        slug: category.slug,
        parentId: category.parentId === null ? '' : String(category.parentId),
    }
}

function parseOptionalId(value: string): number | undefined {
    const text = value.trim()
    if (text.length === 0) {
        return undefined
    }
    const parsed = Number.parseInt(text, 10)
    return Number.isSafeInteger(parsed) && parsed >= 1 ? parsed : undefined
}

export default function CategoryEditor({categoryId}: CategoryEditorProps): React.JSX.Element {
    const {
        entity: category,
        entities: categories,
        values,
        setField,
        isNew,
        isLoading,
        loadError,
        isSaving,
        isDeactivating,
        errorMessage,
        statusMessage,
        handleSubmit,
        handleDeactivate,
    } = useResourceEditor<
        CategorySummary,
        CategoryFormValues,
        CreateCategoryInput,
        UpdateCategoryInput
    >({
        id: categoryId,
        load: listCategories,
        alwaysLoad: true,
        create: createCategory,
        update: updateCategory,
        deactivate: deactivateCategory,
        initialValues: INITIAL_VALUES,
        toValues: toCategoryValues,
        validate: (current) =>
            current.name.trim().length === 0 ? 'Name ist erforderlich.' : null,
        buildCreate: (current) => ({
            slug: current.slug.trim() || suggestSlug(current.name) || 'kategorie',
            name: current.name.trim(),
            parentId: parseOptionalId(current.parentId),
        }),
        buildUpdate: (current) => ({
            name: current.name.trim(),
            parentId: parseOptionalId(current.parentId),
        }),
        redirectPath: (created) => `/manage/categories/${created.id}`,
        createSuccessMessage: (created) => `Kategorie "${created.name}" angelegt.`,
        updateSuccessMessage: 'Kategorie gespeichert.',
        messages: {
            notFound: 'Kategorie wurde nicht gefunden.',
            loadFailed: 'Kategorie konnte nicht geladen werden.',
            saveFailed: 'Aktion fehlgeschlagen.',
            deactivateFailed: 'Deaktivierung fehlgeschlagen.',
        },
    })

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

            {errorMessage ? (
                <Alert variant="destructive">
                    <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
            ) : null}
            {statusMessage ? (
                <Alert role="status">
                    <AlertDescription>{statusMessage}</AlertDescription>
                </Alert>
            ) : null}

            <Card className="max-w-xl">
                <CardHeader>
                    <CardTitle>Details</CardTitle>
                    <CardDescription>Name, Kennung und optionale Oberkategorie.</CardDescription>
                </CardHeader>
                <CardContent>
            <form className="grid gap-5" onSubmit={(event) => void handleSubmit(event)}>
                <div className="grid gap-2">
                    <Label htmlFor="category-name">Name</Label>
                    <Input
                        aria-describedby="category-name-help"
                        id="category-name"
                        maxLength={255}
                        onChange={(event) => setField('name', event.target.value)}
                        placeholder="z. B. Interviews"
                        required
                        type="text"
                        value={values.name}
                    />
                    <p className="text-xs text-muted-foreground" id="category-name-help">
                        Anzeigename in Listen und Filtern.
                    </p>
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="category-slug">Slug</Label>
                    <Input
                        aria-describedby="category-slug-help"
                        disabled={!isNew}
                        id="category-slug"
                        maxLength={64}
                        onChange={(event) => setField('slug', event.target.value)}
                        pattern={HTML_SLUG_PATTERN}
                        placeholder="z. B. interviews"
                        required={isNew}
                        type="text"
                        value={values.slug}
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
                        id="category-parent"
                        onChange={(event) => setField('parentId', event.target.value)}
                        value={values.parentId}
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
                    <Button disabled={isSaving} type="submit">
                        {isSaving ? 'Speichert…' : 'Speichern'}
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
            </form>
                </CardContent>
            </Card>
        </PageStack>
    )
}
