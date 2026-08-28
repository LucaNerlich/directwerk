'use client'

import {Button} from '@directwerk/ui/components/button'
import {Textarea} from '@directwerk/ui/components/textarea'
import {Input} from '@directwerk/ui/components/input'

import LevelSelect from '@/components/studio/LevelSelect'

import Link from 'next/link'
import Form from 'next/form'
import {useRouter} from 'next/navigation'
import {useActionState, useEffect, useState} from 'react'

import {AUTH_REQUIRED} from '@directwerk/api/constants'
import {
    createFormat,
    deactivateFormat,
    listFormats,
    suggestSlug,
    updateFormat,
} from '@/lib/api/tenantApi'
import type {FormatSummary} from '@directwerk/api/types'
import {getClientTenantHost} from '@/lib/tenant/getClientTenantHost'
import {useAuthRequired} from '@directwerk/api/auth/useAuthRequired'

interface FormatEditorProps {
    formatId?: number
}

interface FormatFormState {
    error: string | null
    success: string | null
}

const INITIAL_STATE: FormatFormState = {error: null, success: null}

/**
 * Parses an optional non-negative integer from a form value.
 *
 * @param value - The form value to parse.
 * @returns The parsed integer, or `undefined` when the value is empty, invalid, or negative.
 */
function parseOptionalInt(value: FormDataEntryValue | null): number | undefined {
    const text = String(value ?? '').trim()
    if (text.length === 0) {
        return undefined
    }
    const parsed = Number.parseInt(text, 10)
    return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : undefined
}

/**
 * Provides a form for creating, editing, and deactivating a format.
 *
 * @param formatId - The identifier of the format to edit; omit to create a new format.
 */
export default function FormatEditor({formatId}: FormatEditorProps): React.JSX.Element {
    const router = useRouter()
    const authRedirect = useAuthRequired()
    const isNew = formatId === undefined
    const [format, setFormat] = useState<FormatSummary | null>(null)
    const [requiredLevelSortOrder, setRequiredLevelSortOrder] = useState<number | null>(null)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(!isNew)
    const [isDeactivating, setIsDeactivating] = useState(false)
    const [deactivateError, setDeactivateError] = useState<string | null>(null)

    useEffect(() => {
        if (formatId === undefined) {
            setIsLoading(false)
            return
        }

        const resolvedId = formatId
        let active = true

        listFormats(getClientTenantHost())
            .then((formats) => {
                if (!active) {
                    return
                }
                const found = formats.find((item) => item.id === resolvedId)
                if (!found) {
                    setLoadError('Format wurde nicht gefunden.')
                    setIsLoading(false)
                    return
                }
                setFormat(found)
                setRequiredLevelSortOrder(found.requiredLevelSortOrder)
                setIsLoading(false)
            })
            .catch((error: unknown) => {
                if (!active) {
                    return
                }
                if (authRedirect(error)) return
                setLoadError(
                    error instanceof Error ? error.message : 'Format konnte nicht geladen werden.',
                )
                setIsLoading(false)
            })

        return () => {
            active = false
        }
    }, [formatId, router])

    async function saveAction(
        _previous: FormatFormState,
        formData: FormData,
    ): Promise<FormatFormState> {
        const name = String(formData.get('name') ?? '').trim()
        const slugInput = String(formData.get('slug') ?? '').trim()
        const description = String(formData.get('description') ?? '').trim()
        const requiredLevelSortOrder = parseOptionalInt(formData.get('requiredLevelSortOrder'))
        const sortOrder = parseOptionalInt(formData.get('sortOrder'))

        if (name.length === 0) {
            return {error: 'Name ist erforderlich.', success: null}
        }

        const host = getClientTenantHost()

        try {
            if (isNew) {
                const resolvedSlug = slugInput || suggestSlug(name) || 'format'
                const created = await createFormat(host, {
                    slug: resolvedSlug,
                    name,
                    description: description.length > 0 ? description : undefined,
                    requiredLevelSortOrder,
                    sortOrder,
                })
                router.replace(`/podcast/formats/${created.id}`)
                return {error: null, success: `Format "${created.name}" angelegt.`}
            }

            const updated = await updateFormat(host, formatId, {
                name,
                description: description.length > 0 ? description : undefined,
                requiredLevelSortOrder,
                sortOrder,
            })
            setFormat(updated)
            return {error: null, success: 'Format gespeichert.'}
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
        if (formatId === undefined) {
            return
        }
        setIsDeactivating(true)
        setDeactivateError(null)
        try {
            const updated = await deactivateFormat(getClientTenantHost(), formatId)
            setFormat(updated)
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
                {loadError} <Link href="/podcast/formats">Zurück zur Liste</Link>
            </p>
        )
    }

    return (
        <div className="flex flex-col gap-6">
            <header className="flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                        Podcast · Einrichtung
                    </p>
                    <h1>{isNew ? 'Neues Format' : 'Format bearbeiten'}</h1>
                    <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                        Formate erscheinen beim Erstellen einer Folge als Auswahl.
                    </p>
                </div>
                <Link
                    className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                    href="/podcast/formats"
                >
                    Zurück zur Liste
                </Link>
            </header>

            {state.error ? (
                <p className="text-sm text-destructive" role="alert">
                    {state.error}
                </p>
            ) : null}
            {deactivateError ? (
                <p className="text-sm text-destructive" role="alert">
                    {deactivateError}
                </p>
            ) : null}
            {state.success ? <p role="status">{state.success}</p> : null}

            <Form action={formAction}>
                <p>
                    <label htmlFor="format-name">Name</label>
                    <br />
                    <Input
                        defaultValue={format?.name ?? ''}
                        id="format-name"
                        maxLength={255}
                        name="name"
                        required
                        type="text"
                    />
                </p>
                <p>
                    <label htmlFor="format-slug">Slug</label>
                    <br />
                    <Input
                        defaultValue={format?.slug ?? ''}
                        disabled={!isNew}
                        id="format-slug"
                        maxLength={64}
                        name="slug"
                        pattern="^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,62}[a-zA-Z0-9])?$"
                        required={isNew}
                        type="text"
                    />
                </p>
                <p>
                    <label htmlFor="format-description">Beschreibung</label>
                    <br />
                    <Textarea
                        defaultValue={format?.description ?? ''}
                        id="format-description"
                        name="description"
                        rows={4}
                    />
                </p>
                <p>
                    <label htmlFor="format-required-level">Mindest-Stufe</label>
                    <br />
                    <LevelSelect
                        id="format-required-level"
                        onChange={setRequiredLevelSortOrder}
                        value={requiredLevelSortOrder}
                    />
                    <input
                        name="requiredLevelSortOrder"
                        type="hidden"
                        value={requiredLevelSortOrder ?? ''}
                    />
                    <span className="mt-1 block text-sm text-muted-foreground">
                        Niedrigste Stufe, die auf Folgen dieses Formats zugreifen darf.
                        Zugriff hat, wessen höchste Stufe ≥ Mindest-Stufe ist. „Öffentlich“ = jede aktive Stufe.
                    </span>
                </p>
                <p>
                    <label htmlFor="format-sort-order">Anzeigereihenfolge in der Formatauswahl</label>
                    <br />
                    <Input
                        defaultValue={format?.sortOrder ?? ''}
                        id="format-sort-order"
                        min={0}
                        name="sortOrder"
                        type="number"
                    />
                    <span className="mt-1 block text-sm text-muted-foreground">
                        Legt fest, an welcher Position dieses Format in der Format-Auswahl beim
                        Erstellen einer Folge erscheint — hat nichts mit Zugriff zu tun.
                    </span>
                </p>
                <p>
                    <Button disabled={pending} type="submit">
                        {pending ? 'Speichert…' : 'Speichern'}
                    </Button>
                    {!isNew && format?.active ? (
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
