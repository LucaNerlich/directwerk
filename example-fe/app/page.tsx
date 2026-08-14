'use client'

import Form from 'next/form'
import Link from 'next/link'
import {useActionState, useEffect, useState} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Button} from '@directwerk/ui/components/button'
import {Card, CardContent, CardHeader, CardTitle} from '@directwerk/ui/components/card'
import {Label} from '@directwerk/ui/components/label'
import PageHeader from '@directwerk/ui/components/page-header'

import {getSiteConfig} from '@/lib/api/client'
import type {SiteConfig} from '@/lib/api/types'
import {clearTokens} from '@/lib/auth/tokenStore'
import {getSelectedTenant, setSelectedTenant} from '@/lib/tenantStore'
import {parseTenantHost, TENANTS, type TenantHost} from '@/lib/tenants'

interface TenantFormState {
    error: string | null
}

const INITIAL_STATE: TenantFormState = {error: null}

export default function Home() {
    const [tenantHost, setTenantHost] = useState<TenantHost | null>(null)
    const [siteConfig, setSiteConfig] = useState<SiteConfig | null>(null)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [formState, formAction, isSwitching] = useActionState(
        async (_previousState: TenantFormState, formData: FormData) => {
            const nextHost = parseTenantHost(
                typeof formData.get('tenant') === 'string'
                    ? (formData.get('tenant') as string)
                    : null,
            )
            if (nextHost === null) {
                return {error: 'Select a valid tenant.'}
            }

            if (nextHost !== tenantHost) {
                clearTokens()
                setSelectedTenant(nextHost)
                setTenantHost(nextHost)
            }
            return INITIAL_STATE
        },
        INITIAL_STATE,
    )

    useEffect(() => {
        setTenantHost(getSelectedTenant())
    }, [])

    useEffect(() => {
        if (tenantHost === null) {
            return
        }

        let isCurrent = true
        setIsLoading(true)
        setLoadError(null)

        getSiteConfig(tenantHost)
            .then((response) => {
                if (isCurrent) {
                    setSiteConfig(response.data)
                }
            })
            .catch((error: unknown) => {
                if (isCurrent) {
                    setSiteConfig(null)
                    setLoadError(
                        error instanceof Error
                            ? error.message
                            : 'Unable to load the tenant configuration.',
                    )
                }
            })
            .finally(() => {
                if (isCurrent) {
                    setIsLoading(false)
                }
            })

        return () => {
            isCurrent = false
        }
    }, [tenantHost])

    return (
        <div className="page-container space-y-8">
            <PageHeader eyebrow="Reference frontend" title="Directwerk subscriber demo" description="Switch tenants and inspect their public publishing configuration." />
            <Card>
                <CardHeader><CardTitle>Tenant</CardTitle></CardHeader>
                <CardContent>
            <Form action={formAction} className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="flex-1 space-y-2">
                    <Label htmlFor="tenant">Tenant</Label>
                    <select id="tenant" className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm" name="tenant" defaultValue={tenantHost ?? TENANTS[0].host} key={tenantHost ?? TENANTS[0].host}>
                        {TENANTS.map((tenant) => (
                            <option key={tenant.host} value={tenant.host}>
                                {tenant.label} ({tenant.slug})
                            </option>
                        ))}
                    </select>
                </div>
                <Button type="submit" disabled={isSwitching}>
                    {isSwitching ? 'Switching…' : 'Use tenant'}
                </Button>
            </Form>
            {formState.error !== null && <Alert className="mt-4" variant="destructive"><AlertDescription>{formState.error}</AlertDescription></Alert>}
                </CardContent>
            </Card>

            <Card aria-live="polite">
                <CardHeader><CardTitle>Public site configuration</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                {isLoading && <p>Loading…</p>}
                {loadError !== null && <Alert variant="destructive"><AlertDescription>{loadError}</AlertDescription></Alert>}
                {siteConfig !== null && !isLoading && (
                    <>
                        <p>
                            <strong>{siteConfig.tenant.name}</strong> (
                            {siteConfig.tenant.slug})
                        </p>
                        <p>
                            Site title: {siteConfig.branding.siteTitle ?? 'Not configured'}
                        </p>
                        <p>
                            Enabled modules:{' '}
                            {siteConfig.enabledModules.length === 0
                                ? 'None'
                                : siteConfig.enabledModules.join(', ')}
                        </p>
                        {siteConfig.publicRssUrl !== null ? (
                            <p>
                                Public podcast feed:{' '}
                                <a href={siteConfig.publicRssUrl} rel="noreferrer">
                                    {siteConfig.publicRssUrl}
                                </a>
                            </p>
                        ) : (
                            <p>Public podcast feed: not available (PODCAST_RSS off)</p>
                        )}
                        <p>
                            Browse:{' '}
                            <Link href="/articles">Articles</Link>
                            {' · '}
                            <Link href="/episodes">Episodes</Link>
                            {' · '}
                            <Link href="/formats">Formats</Link>
                            {' · '}
                            <Link href="/feeds">Feeds</Link>
                            {' · '}
                            <Link href="/pricing">Pricing</Link>
                            {' · '}
                            <Link href="/account">Account</Link>
                        </p>
                    </>
                )}
                </CardContent>
            </Card>
        </div>
    )
}
