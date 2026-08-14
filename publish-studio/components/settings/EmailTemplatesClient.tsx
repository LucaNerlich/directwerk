'use client'

import SelectControl from '@/components/studio/SelectControl'

import {Button} from '@publish/ui/components/button'
import {Textarea} from '@publish/ui/components/textarea'
import {Input} from '@publish/ui/components/input'

import Form from 'next/form'
import {useRouter} from 'next/navigation'
import {useActionState, useEffect, useState} from 'react'

import {AUTH_REQUIRED} from '@/lib/api/errors'
import {
    getContentEmailTemplate,
    upsertContentEmailTemplate,
} from '@/lib/api/tenantApi'
import type {ContentEmailTemplate, ContentEmailTemplateType} from '@/lib/api/types'
import {getClientTenantHost} from '@/lib/tenant/getClientTenantHost'

interface TemplateFormState {
    error: string | null
    success: string | null
}

const INITIAL_STATE: TemplateFormState = {error: null, success: null}

const CONTENT_TYPES: ContentEmailTemplateType[] = ['EPISODE', 'ARTICLE']

export default function EmailTemplatesClient(): React.JSX.Element {
    const router = useRouter()
    const [contentType, setContentType] = useState<ContentEmailTemplateType>('EPISODE')
    const [template, setTemplate] = useState<ContentEmailTemplate | null>(null)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        let active = true
        setIsLoading(true)
        setLoadError(null)

        getContentEmailTemplate(getClientTenantHost(), contentType)
            .then((result) => {
                if (!active) {
                    return
                }
                setTemplate(result)
                setIsLoading(false)
            })
            .catch((error: unknown) => {
                if (!active) {
                    return
                }
                if (error instanceof Error && error.message === AUTH_REQUIRED) {
                    router.replace('/login')
                    return
                }
                setLoadError(
                    error instanceof Error
                        ? error.message
                        : 'E-Mail-Vorlage konnte nicht geladen werden.',
                )
                setIsLoading(false)
            })

        return () => {
            active = false
        }
    }, [contentType, router])

    async function saveAction(
        _previous: TemplateFormState,
        formData: FormData,
    ): Promise<TemplateFormState> {
        const subjectTemplate = String(formData.get('subjectTemplate') ?? '').trim()
        const bodyHtml = String(formData.get('bodyHtml') ?? '').trim()
        if (subjectTemplate.length === 0 || bodyHtml.length === 0) {
            return {
                error: 'Betreff und Inhalt sind erforderlich.',
                success: null,
            }
        }

        try {
            const updated = await upsertContentEmailTemplate(
                getClientTenantHost(),
                contentType,
                {subjectTemplate, bodyHtml},
            )
            setTemplate(updated)
            return {error: null, success: 'Vorlage gespeichert.'}
        } catch (error: unknown) {
            if (error instanceof Error && error.message === AUTH_REQUIRED) {
                router.replace('/login')
                return INITIAL_STATE
            }
            return {
                error:
                    error instanceof Error
                        ? error.message
                        : 'Vorlage konnte nicht gespeichert werden.',
                success: null,
            }
        }
    }

    const [state, formAction, pending] = useActionState(saveAction, INITIAL_STATE)

    return (
        <div className="flex flex-col gap-6">
            <header className="flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Einstellungen</p>
                    <h1>E-Mail-Vorlagen</h1>
                </div>
            </header>

            <p>
                Vorlagen für Benachrichtigungen bei neuen Folgen und Beiträgen
                (Modul <code>EMAIL_NOTIFY</code>).
            </p>

            <label className="grid gap-2 text-sm font-medium" htmlFor="contentType">
                Inhaltstyp
                <SelectControl
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                    id="contentType"
                    onChange={(event) =>
                        setContentType(event.target.value as ContentEmailTemplateType)
                    }
                    value={contentType}
                >
                    {CONTENT_TYPES.map((type) => (
                        <option key={type} value={type}>
                            {type === 'EPISODE' ? 'Folge' : 'Beitrag'}
                        </option>
                    ))}
                </SelectControl>
            </label>

            {isLoading ? <p>Wird geladen…</p> : null}
            {loadError !== null ? (
                <p className="text-sm text-destructive" role="alert">
                    {loadError}
                </p>
            ) : null}

            {!isLoading && loadError === null ? (
                <Form action={formAction} className="grid w-full max-w-xl gap-5" key={contentType}>
                    <label className="grid gap-2 text-sm font-medium" htmlFor="subjectTemplate">
                        Betreff
                        <Input
                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                            defaultValue={template?.subjectTemplate ?? ''}
                            id="subjectTemplate"
                            maxLength={512}
                            name="subjectTemplate"
                            required
                            type="text"
                        />
                    </label>
                    <label className="grid gap-2 text-sm font-medium" htmlFor="bodyHtml">
                        HTML-Inhalt
                        <Textarea
                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                            defaultValue={template?.bodyHtml ?? ''}
                            id="bodyHtml"
                            name="bodyHtml"
                            required
                            rows={12}
                        />
                    </label>
                    {state.error ? (
                        <p aria-live="polite" className="text-sm text-destructive" role="alert">
                            {state.error}
                        </p>
                    ) : null}
                    {state.success ? (
                        <p aria-live="polite" role="status">
                            {state.success}
                        </p>
                    ) : null}
                    <Button className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50" disabled={pending} type="submit">
                        {pending ? 'Speichern…' : 'Speichern'}
                    </Button>
                </Form>
            ) : null}
        </div>
    )
}
