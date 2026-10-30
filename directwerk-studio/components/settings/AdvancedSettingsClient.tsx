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
import {useActionState, useEffect, useRef, useState} from 'react'

import LanguageSwitcher from '@/components/i18n/LanguageSwitcher'
import {useDictionary} from '@/components/i18n/LocaleProvider'
import {hasModule} from '@/lib/api/client'
import {getBranding, updateBranding} from '@/lib/api/tenantSettingsApi'
import {useSiteConfig} from '@/lib/site/SiteConfigProvider'
import type {TenantBranding} from '@directwerk/api/types'
import {useAuthRequired} from '@directwerk/api/auth/useAuthRequired'

interface FormState {
    error: string | null
    success: string | null
}

const INITIAL_STATE: FormState = {error: null, success: null}
const UMAMI_PATTERN = /^[a-zA-Z0-9-]{8,64}$/
const UMAMI_HOST_PATTERN = /^https:\/\/[^/\s?#@]+\/?$/

export default function AdvancedSettingsClient(): React.JSX.Element {
    const dict = useDictionary()
    const s = dict.settings
    const authRedirect = useAuthRequired()
    const siteConfig = useSiteConfig()
    const analyticsModuleActive = hasModule(siteConfig, 'ANALYTICS')
    const [branding, setBranding] = useState<TenantBranding | null>(null)
    const brandingRef = useRef<TenantBranding | null>(null)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        let active = true
        getBranding()
            .then((result) => {
                if (!active) return
                setBranding(result)
                brandingRef.current = result
                setIsLoading(false)
            })
            .catch((error: unknown) => {
                if (!active) return
                if (authRedirect(error)) return
                setLoadError(error instanceof Error ? error.message : s.brandingKonnteGespeichert)
                setIsLoading(false)
            })
        return () => {
            active = false
        }
    }, [authRedirect, s.brandingKonnteGespeichert])

    async function saveAction(_previous: FormState, formData: FormData): Promise<FormState> {
        const current = brandingRef.current
        if (current === null) {
            return {error: s.brandingKonnteGespeichert, success: null}
        }
        const umamiWebsiteId = String(formData.get('umamiWebsiteId') ?? '').trim()
        const umamiHostUrl =
            umamiWebsiteId.length > 0
                ? String(formData.get('umamiHostUrl') ?? '').trim()
                : ''

        if (umamiWebsiteId.length > 0 && !UMAMI_PATTERN.test(umamiWebsiteId)) {
            return {error: s.umamiWebsiteIdMuss864, success: null}
        }
        if (umamiHostUrl.length > 0 && !UMAMI_HOST_PATTERN.test(umamiHostUrl)) {
            return {error: s.umamiServerMussHttpsOrigin, success: null}
        }

        try {
            const updated = await updateBranding({
                siteTitle: current.siteTitle ?? '',
                primaryColor: current.primaryColor,
                secondaryColor: current.secondaryColor,
                logoUrl: current.logoUrl,
                faviconUrl: current.faviconUrl,
                umamiWebsiteId,
                umamiHostUrl,
            })
            setBranding(updated)
            brandingRef.current = updated
            const success =
                umamiWebsiteId.length === 0
                    ? s.brandingGespeichertAnalyticsTrackingDeaktivi
                    : umamiHostUrl.length > 0
                      ? s.brandingGespeichertAnalyticsEigenenUmamiSer
                      : s.brandingGespeichertAnalyticsPlattformStandar
            return {error: null, success}
        } catch (error: unknown) {
            if (authRedirect(error)) return INITIAL_STATE
            return {
                error: error instanceof Error ? error.message : s.brandingKonnteGespeichert,
                success: null,
            }
        }
    }

    const [state, formAction, pending] = useActionState(saveAction, INITIAL_STATE)

    return (
        <PageStack>
            <PageHeader
                eyebrow={dict.nav.verwaltung.settings}
                title={dict.nav.verwaltung.advanced}
                description={s.optionalesWebsiteTrackingOhneWebsite}
            />
            <Card className="w-full max-w-xl">
                <CardHeader>
                    <CardTitle>{s.preferences}</CardTitle>
                    <CardDescription>{s.preferencesDescription}</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-2">
                    <Label>{dict.shell.language}</Label>
                    <LanguageSwitcher />
                </CardContent>
            </Card>
            {isLoading ? <Skeleton className="h-48 w-full max-w-xl" /> : null}
            {loadError !== null ? (
                <Alert variant="destructive">
                    <AlertDescription>{loadError}</AlertDescription>
                </Alert>
            ) : null}
            {!isLoading && loadError === null ? (
                <Form action={formAction} className="grid w-full max-w-xl gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Analytics (Umami)</CardTitle>
                            <CardDescription>{s.optionalesWebsiteTrackingOhneWebsite}</CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-5">
                            <div className="grid gap-2">
                                <Label htmlFor="umamiWebsiteId">{s.umamiWebsiteId}</Label>
                                <Input
                                    aria-describedby="umamiWebsiteId-help"
                                    defaultValue={branding?.umamiWebsiteId ?? ''}
                                    id="umamiWebsiteId"
                                    key={`id-${branding?.umamiWebsiteId ?? ''}`}
                                    maxLength={64}
                                    name="umamiWebsiteId"
                                    type="text"
                                />
                                <p className="text-xs text-muted-foreground" id="umamiWebsiteId-help">
                                    {s.umamiWebsiteIdHilfe}
                                </p>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="umamiHostUrl">{s.umamiServer}</Label>
                                <Input
                                    aria-describedby="umamiHostUrl-help"
                                    defaultValue={branding?.umamiHostUrl ?? ''}
                                    id="umamiHostUrl"
                                    key={`host-${branding?.umamiHostUrl ?? ''}`}
                                    maxLength={512}
                                    name="umamiHostUrl"
                                    placeholder="https://umami.example.com"
                                    type="url"
                                />
                                <p className="text-xs text-muted-foreground" id="umamiHostUrl-help">
                                    {s.umamiServerHilfe}
                                </p>
                            </div>
                            {analyticsModuleActive === false && branding?.umamiWebsiteId ? (
                                <Alert variant="destructive">
                                    <AlertDescription>{s.analyticsModuleInactiveHint}</AlertDescription>
                                </Alert>
                            ) : null}
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
                    <Button disabled={pending} type="submit">
                        {pending ? dict.common.saving : dict.common.save}
                    </Button>
                </Form>
            ) : null}
        </PageStack>
    )
}
