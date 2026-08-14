'use client'

import {Button} from '@directwerk/ui/components/button'
import {Input} from '@directwerk/ui/components/input'

import Form from 'next/form'
import {useRouter} from 'next/navigation'
import {useActionState, useEffect, useState} from 'react'

import {AUTH_REQUIRED} from '@/lib/api/errors'
import {getBranding, updateBranding} from '@/lib/api/tenantApi'
import type {TenantBranding} from '@/lib/api/types'
import {getClientTenantHost} from '@/lib/tenant/getClientTenantHost'

interface BrandingFormState {
    error: string | null
    success: string | null
}

const INITIAL_STATE: BrandingFormState = {error: null, success: null}

const COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/
const UMAMI_PATTERN = /^$|^[a-zA-Z0-9-]{8,64}$/

function normalizeColor(value: FormDataEntryValue | null): string | null | undefined {
    const text = String(value ?? '').trim()
    if (text.length === 0) {
        return null
    }
    return text
}

/**
 * Tenant branding editor (site title, colors, logo URL, Umami website id).
 */
export default function BrandingEditor(): React.JSX.Element {
    const router = useRouter()
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
                if (error instanceof Error && error.message === AUTH_REQUIRED) {
                    router.replace('/login')
                    return
                }
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

        try {
            const updated = await updateBranding(getClientTenantHost(), {
                siteTitle: siteTitle.length > 0 ? siteTitle : '',
                primaryColor: primaryColor ?? null,
                secondaryColor: secondaryColor ?? null,
                logoUrl: logoUrl.length > 0 ? logoUrl : null,
                umamiWebsiteId: umamiWebsiteId.length > 0 ? umamiWebsiteId : null,
            })
            setBranding(updated)
            return {error: null, success: 'Branding gespeichert.'}
        } catch (error: unknown) {
            if (error instanceof Error && error.message === AUTH_REQUIRED) {
                router.replace('/login')
                return INITIAL_STATE
            }
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
        return <p>Wird geladen…</p>
    }

    if (loadError !== null) {
        return <p className="text-sm text-destructive">{loadError}</p>
    }

    return (
        <div className="flex flex-col gap-6">
            <header className="flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Einstellungen</p>
                    <h1>Branding</h1>
                </div>
            </header>

            <Form action={formAction} className="grid w-full max-w-xl gap-5">
                <label className="grid gap-2 text-sm font-medium" htmlFor="siteTitle">
                    Seitentitel
                    <Input
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                        defaultValue={branding?.siteTitle ?? ''}
                        id="siteTitle"
                        maxLength={255}
                        name="siteTitle"
                        placeholder="Öffentlicher Titel auf der Website"
                        type="text"
                    />
                </label>
                <label className="grid gap-2 text-sm font-medium" htmlFor="primaryColor">
                    Primärfarbe
                    <Input
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                        defaultValue={branding?.primaryColor ?? ''}
                        id="primaryColor"
                        maxLength={7}
                        name="primaryColor"
                        placeholder="#1a1a1a"
                        type="text"
                    />
                </label>
                <label className="grid gap-2 text-sm font-medium" htmlFor="secondaryColor">
                    Sekundärfarbe
                    <Input
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                        defaultValue={branding?.secondaryColor ?? ''}
                        id="secondaryColor"
                        maxLength={7}
                        name="secondaryColor"
                        placeholder="#445566"
                        type="text"
                    />
                </label>
                <label className="grid gap-2 text-sm font-medium" htmlFor="logoUrl">
                    Logo-URL
                    <Input
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                        defaultValue={branding?.logoUrl ?? ''}
                        id="logoUrl"
                        maxLength={2048}
                        name="logoUrl"
                        placeholder="https://…"
                        type="url"
                    />
                </label>
                <label className="grid gap-2 text-sm font-medium" htmlFor="umamiWebsiteId">
                    Umami Website-ID
                    <Input
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                        defaultValue={branding?.umamiWebsiteId ?? ''}
                        id="umamiWebsiteId"
                        maxLength={64}
                        name="umamiWebsiteId"
                        type="text"
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
        </div>
    )
}
