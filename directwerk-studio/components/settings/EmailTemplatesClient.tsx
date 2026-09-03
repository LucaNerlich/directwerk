'use client'

import SelectControl from '@/components/studio/SelectControl'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Button} from '@directwerk/ui/components/button'
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@directwerk/ui/components/card'
import {Textarea} from '@directwerk/ui/components/textarea'
import {Input} from '@directwerk/ui/components/input'
import {Label} from '@directwerk/ui/components/label'
import PageHeader from '@directwerk/ui/components/page-header'
import PageStack from '@directwerk/ui/components/page-stack'
import {Skeleton} from '@directwerk/ui/components/skeleton'

import Form from 'next/form'
import {useRouter} from 'next/navigation'
import {useActionState, useEffect, useState} from 'react'

import {AUTH_REQUIRED} from '@directwerk/api/constants'
import {getContentEmailTemplate, upsertContentEmailTemplate} from '@/lib/api/tenantSettingsApi'
import type {ContentEmailTemplate, ContentEmailTemplateType} from '@directwerk/api/types'
import {getClientTenantHost} from '@directwerk/api/tenant'
import {useAuthRequired} from '@directwerk/api/auth/useAuthRequired'

interface TemplateFormState {
    error: string | null
    success: string | null
}

const INITIAL_STATE: TemplateFormState = {error: null, success: null}

const CONTENT_TYPES: ContentEmailTemplateType[] = ['EPISODE', 'ARTICLE']

export default function EmailTemplatesClient(): React.JSX.Element {
    const router = useRouter()
    const authRedirect = useAuthRequired()
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
                if (authRedirect(error)) return
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
            if (authRedirect(error)) return INITIAL_STATE
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
        <PageStack>
            <PageHeader
                eyebrow="Einstellungen"
                title="E-Mail-Vorlagen"
                description="Vorlagen für Benachrichtigungen bei neuen Folgen und Beiträgen (Modul EMAIL_NOTIFY). Platzhalter wie {{title}} werden beim Versand ersetzt."
            />

            <div className="grid w-full max-w-xl gap-2">
                <Label htmlFor="contentType">Inhaltstyp</Label>
                <SelectControl
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
                <p className="text-xs text-muted-foreground">
                    {contentType === 'EPISODE'
                        ? 'Wird an Abonnenten versendet, sobald eine neue Folge erscheint.'
                        : 'Wird an Abonnenten versendet, sobald ein neuer Beitrag erscheint.'}
                </p>
            </div>

            {isLoading ? (
                <div className="grid gap-3" aria-busy="true">
                    <p className="text-sm text-muted-foreground" role="status">Wird geladen…</p>
                    <Skeleton className="h-10 w-full max-w-xl" />
                    <Skeleton className="h-48 w-full max-w-xl" />
                </div>
            ) : null}
            {loadError !== null ? (
                <Alert variant="destructive">
                    <AlertDescription>{loadError}</AlertDescription>
                </Alert>
            ) : null}

            {!isLoading && loadError === null ? (
                <Card className="max-w-xl">
                    <CardHeader>
                        <CardTitle>{contentType === 'EPISODE' ? 'Vorlage: Neue Folge' : 'Vorlage: Neuer Beitrag'}</CardTitle>
                        <CardDescription>Betreff und HTML-Inhalt der Benachrichtigungs-E-Mail.</CardDescription>
                    </CardHeader>
                    <CardContent>
                <Form action={formAction} className="grid w-full gap-5" key={contentType}>
                    <div className="grid gap-2">
                        <Label htmlFor="subjectTemplate">Betreff</Label>
                        <Input
                            aria-describedby="subjectTemplate-help"
                            defaultValue={template?.subjectTemplate ?? ''}
                            id="subjectTemplate"
                            maxLength={512}
                            name="subjectTemplate"
                            placeholder={contentType === 'EPISODE' ? 'Neue Folge: {{title}}' : 'Neuer Beitrag: {{title}}'}
                            required
                            type="text"
                        />
                        <p className="text-xs text-muted-foreground" id="subjectTemplate-help">
                            {'{{title}}'} wird durch den Titel der Folge bzw. des Beitrags ersetzt.
                        </p>
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="bodyHtml">HTML-Inhalt</Label>
                        <Textarea
                            aria-describedby="bodyHtml-help"
                            defaultValue={template?.bodyHtml ?? ''}
                            id="bodyHtml"
                            name="bodyHtml"
                            required
                            rows={12}
                        />
                        <p className="text-xs text-muted-foreground" id="bodyHtml-help">
                            HTML für den E-Mail-Text. Platzhalter wie {'{{title}}'} werden beim Versand mit den Inhalten der Folge bzw. des Beitrags gefüllt.
                        </p>
                    </div>
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
                    <div>
                    <Button disabled={pending} type="submit">
                        {pending ? 'Speichern…' : 'Speichern'}
                    </Button>
                    </div>
                </Form>
                    </CardContent>
                </Card>
            ) : null}
        </PageStack>
    )
}
