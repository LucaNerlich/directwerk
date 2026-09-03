'use client'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Button} from '@directwerk/ui/components/button'
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@directwerk/ui/components/card'
import {Input} from '@directwerk/ui/components/input'
import {Label} from '@directwerk/ui/components/label'
import PageHeader from '@directwerk/ui/components/page-header'
import PageStack from '@directwerk/ui/components/page-stack'
import {Skeleton} from '@directwerk/ui/components/skeleton'

import Form from 'next/form'
import {useRouter} from 'next/navigation'
import {useActionState, useEffect, useState} from 'react'

import {AUTH_REQUIRED} from '@directwerk/api/constants'
import {getBranding, updateBranding} from '@/lib/api/tenantSettingsApi'
import type {TenantBranding} from '@directwerk/api/types'
import {getClientTenantHost} from '@directwerk/api/tenant'
import {useAuthRequired} from '@directwerk/api/auth/useAuthRequired'

interface BrandingFormState {
    error: string | null
    success: string | null
}

const INITIAL_STATE: BrandingFormState = {error: null, success: null}

const COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/
const UMAMI_PATTERN = /^$|^[a-zA-Z0-9-]{8,64}$/
// Aligns with backend UmamiHostUrlValidator + TenantAdminController: HTTPS origin, no path/query/fragment/userinfo.
const UMAMI_HOST_PATTERN = /^$|^https:\/\/[^/\s?#@]+\/?$/

function normalizeColor(value: FormDataEntryValue | null): string | null | undefined {
    const text = String(value ?? '').trim()
    if (text.length === 0) {
        return null
    }
    return text
}

export default function BrandingEditor(): React.JSX.Element {
    const router = useRouter()
    const authRedirect = useAuthRequired()
    const [branding, setBranding] = useState<TenantBranding | null>(null)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        let active = true

        getBranding(getClientTenantHost())
            .then((result) => {
                if (!active) {
                    return
                }
                setBranding(result)
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
                        : 'Branding konnte nicht geladen werden.',
                )
                setIsLoading(false)
            })

        return () => {
            active = false
        }
    }, [router])

    async function saveAction(
        _previous: BrandingFormState,
        formData: FormData,
    ): Promise<BrandingFormState> {
        const siteTitle = String(formData.get('siteTitle') ?? '').trim()
        const primaryColor = normalizeColor(formData.get('primaryColor'))
        const secondaryColor = normalizeColor(formData.get('secondaryColor'))
        const logoUrl = String(formData.get('logoUrl') ?? '').trim()
        const umamiWebsiteId = String(formData.get('umamiWebsiteId') ?? '').trim()
        const umamiHostUrl = String(formData.get('umamiHostUrl') ?? '').trim()

        if (primaryColor !== null && primaryColor !== undefined && !COLOR_PATTERN.test(primaryColor)) {
            return {error: 'Primärfarbe muss #RRGGBB sein.', success: null}
        }
        if (
            secondaryColor !== null &&
            secondaryColor !== undefined &&
            !COLOR_PATTERN.test(secondaryColor)
        ) {
            return {error: 'Sekundärfarbe muss #RRGGBB sein.', success: null}
        }
        if (!UMAMI_PATTERN.test(umamiWebsiteId)) {
            return {
                error: 'Umami Website-ID muss leer oder 8–64 Zeichen (a-z, 0-9, -) sein.',
                success: null,
            }
        }
        if (!UMAMI_HOST_PATTERN.test(umamiHostUrl)) {
            return {
                error: 'Umami-Server muss leer oder eine HTTPS-Origin sein (z. B. https://umami.example.com, ohne Pfad).',
                success: null,
            }
        }
        if (umamiWebsiteId.length === 0 && umamiHostUrl.length > 0) {
            return {
                error: 'Umami-Server ist ohne Website-ID wirkungslos — bitte auch die Website-ID setzen oder den Server leer lassen.',
                success: null,
            }
        }

        try {
            const updated = await updateBranding(getClientTenantHost(), {
                siteTitle: siteTitle.length > 0 ? siteTitle : '',
                primaryColor: primaryColor ?? null,
                secondaryColor: secondaryColor ?? null,
                logoUrl: logoUrl.length > 0 ? logoUrl : null,
                umamiWebsiteId: umamiWebsiteId.length > 0 ? umamiWebsiteId : null,
                umamiHostUrl: umamiHostUrl.length > 0 ? umamiHostUrl : null,
            })
            setBranding(updated)
            if (!updated.umamiWebsiteId) {
                return {error: null, success: 'Branding gespeichert. Analytics-Tracking ist deaktiviert (keine Website-ID).'}
            }
            if (updated.umamiHostUrl) {
                return {error: null, success: 'Branding gespeichert. Analytics für eigenen Umami-Server konfiguriert.'}
            }
            return {error: null, success: 'Branding gespeichert. Analytics für den Plattform-Standard konfiguriert.'}
        } catch (error: unknown) {
            if (authRedirect(error)) return INITIAL_STATE
            return {
                error:
                    error instanceof Error
                        ? error.message
                        : 'Branding konnte nicht gespeichert werden.',
                success: null,
            }
        }
    }

    const [state, formAction, pending] = useActionState(saveAction, INITIAL_STATE)

    if (isLoading) {
        return (
            <PageStack>
                <PageHeader
                    eyebrow="Einstellungen"
                    title="Branding"
                    description="Titel, Farben, Logo und Analytics für deine öffentliche Website."
                />
                <p className="text-sm text-muted-foreground" role="status">Wird geladen…</p>
                <Skeleton className="h-96 w-full max-w-xl" />
            </PageStack>
        )
    }

    if (loadError !== null) {
        return (
            <PageStack>
                <PageHeader
                    eyebrow="Einstellungen"
                    title="Branding"
                    description="Titel, Farben, Logo und Analytics für deine öffentliche Website."
                />
                <Alert variant="destructive">
                    <AlertDescription>{loadError}</AlertDescription>
                </Alert>
            </PageStack>
        )
    }

    return (
        <PageStack>
            <PageHeader
                eyebrow="Einstellungen"
                title="Branding"
                description="Titel, Farben, Logo und Analytics für deine öffentliche Website. Farben im Format #RRGGBB."
            />

            <Form action={formAction} className="grid w-full max-w-xl gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Website &amp; Farben</CardTitle>
                        <CardDescription>So erscheint deine Seite für Hörerinnen und Hörer.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-5">
                <div className="grid gap-2">
                    <Label htmlFor="siteTitle">Seitentitel</Label>
                    <Input
                        aria-describedby="siteTitle-help"
                        defaultValue={branding?.siteTitle ?? ''}
                        id="siteTitle"
                        maxLength={255}
                        name="siteTitle"
                        placeholder="Öffentlicher Titel auf der Website"
                        type="text"
                    />
                    <p className="text-xs text-muted-foreground" id="siteTitle-help">
                        Leer lassen, um den Standard-Titel zu verwenden.
                    </p>
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="primaryColor">Primärfarbe</Label>
                    <div className="flex items-center gap-3">
                        <span
                            aria-hidden="true"
                            className="size-9 shrink-0 rounded-md border"
                            style={{backgroundColor: branding?.primaryColor ?? 'transparent'}}
                        />
                    <Input
                        aria-describedby="primaryColor-help"
                        defaultValue={branding?.primaryColor ?? ''}
                        id="primaryColor"
                        maxLength={7}
                        name="primaryColor"
                        placeholder="#1a1a1a"
                        type="text"
                    />
                    </div>
                    <p className="text-xs text-muted-foreground" id="primaryColor-help">
                        Format #RRGGBB, z. B. #1a1a1a. Leer lassen für die Standardfarbe. Aktuell: {branding?.primaryColor ?? 'Standard'}.
                    </p>
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="secondaryColor">Sekundärfarbe</Label>
                    <div className="flex items-center gap-3">
                        <span
                            aria-hidden="true"
                            className="size-9 shrink-0 rounded-md border"
                            style={{backgroundColor: branding?.secondaryColor ?? 'transparent'}}
                        />
                    <Input
                        aria-describedby="secondaryColor-help"
                        defaultValue={branding?.secondaryColor ?? ''}
                        id="secondaryColor"
                        maxLength={7}
                        name="secondaryColor"
                        placeholder="#445566"
                        type="text"
                    />
                    </div>
                    <p className="text-xs text-muted-foreground" id="secondaryColor-help">
                        Format #RRGGBB, z. B. #445566. Leer lassen für die Standardfarbe.
                    </p>
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="logoUrl">Logo-URL</Label>
                    <Input
                        aria-describedby="logoUrl-help"
                        defaultValue={branding?.logoUrl ?? ''}
                        id="logoUrl"
                        maxLength={2048}
                        name="logoUrl"
                        placeholder="https://…"
                        type="url"
                    />
                    <p className="text-xs text-muted-foreground" id="logoUrl-help">
                        Optionale absolute https-URL zu deinem Logo. Leer lassen für kein Logo.
                    </p>
                </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>Analytics (Umami)</CardTitle>
                        <CardDescription>Optionales Website-Tracking — ohne Website-ID bleibt es inaktiv.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid gap-5">
                <div className="grid gap-2">
                    <Label htmlFor="umamiWebsiteId">Umami Website-ID</Label>
                    <Input
                        aria-describedby="umamiWebsiteId-help"
                        defaultValue={branding?.umamiWebsiteId ?? ''}
                        id="umamiWebsiteId"
                        maxLength={64}
                        name="umamiWebsiteId"
                        placeholder="z. B. abc12345-def6-…"
                        type="text"
                    />
                    <p className="text-xs text-muted-foreground" id="umamiWebsiteId-help">
                        8–64 Zeichen (a–z, 0–9, Bindestrich). Leer lassen deaktiviert das Tracking.
                    </p>
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="umamiHostUrl">Umami-Server</Label>
                    <Input
                        aria-describedby="umamiHostUrl-help"
                        defaultValue={branding?.umamiHostUrl ?? ''}
                        id="umamiHostUrl"
                        maxLength={512}
                        name="umamiHostUrl"
                        placeholder="https://umami.example.com"
                        type="url"
                    />
                    <p className="text-xs text-muted-foreground" id="umamiHostUrl-help">
                        Leer lassen, um den Plattform-Standard zu verwenden. Nur HTTPS-Origin ohne Pfad.
                        Tracking braucht ANALYTICS-Modul + Website-ID; ohne ID bleibt es inaktiv.
                    </p>
                </div>
                    </CardContent>
                </Card>
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
        </PageStack>
    )
}
