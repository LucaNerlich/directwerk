'use client'

import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {useCallback, useEffect, useState} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import EmptyState from '@directwerk/ui/components/empty-state'
import PageHeader from '@directwerk/ui/components/page-header'
import PageStack from '@directwerk/ui/components/page-stack'
import SectionHeader from '@directwerk/ui/components/section-header'

import CreateTenantForm from '@/components/CreateTenantForm'
import TenantListTable from '@/components/TenantListTable'
import {getPlatformData} from '@/lib/api/client'
import {AUTH_REQUIRED} from '@directwerk/api/constants'
import type {TenantList} from '@directwerk/api/types'

export default function TenantsPage(): React.JSX.Element {
    const router = useRouter()
    const [tenants, setTenants] = useState<TenantList['content'] | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [reloadKey, setReloadKey] = useState(0)

    const reloadTenants = useCallback(() => {
        setReloadKey((value) => value + 1)
    }, [])

    useEffect(() => {
        let active = true

        getPlatformData<TenantList>('tenants')
            .then((result) => {
                if (active) {
                    setTenants(result.content)
                    setError(null)
                }
            })
            .catch((requestError: unknown) => {
                if (!active) {
                    return
                }

                if (
                    requestError instanceof Error &&
                    requestError.message === AUTH_REQUIRED
                ) {
                    router.replace('/login')
                    return
                }

                setError('Could not load tenants.')
            })

        return () => {
            active = false
        }
    }, [router, reloadKey])

    return (
        <PageStack>
            <PageHeader
                description="Search, filter, and open tenant records."
                eyebrow="Platform administration"
                title="Tenants"
            />

            {error ? (
                <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            ) : null}

            {!error && tenants === null ? (
                <p aria-live="polite" className="text-sm text-muted-foreground">
                    Loading tenants…
                </p>
            ) : null}

            {tenants ? (
                tenants.length > 0 ? (
                    <TenantListTable tenants={tenants} />
                ) : (
                    <EmptyState
                        description="Create the first tenant to begin."
                        title="No tenants yet"
                    />
                )
            ) : null}

            <SectionHeader
                action={<Link href="/">Back to overview</Link>}
                title="Create tenant"
            />
            <CreateTenantForm onCreated={reloadTenants} />
        </PageStack>
    )
}
