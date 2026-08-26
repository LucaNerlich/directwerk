'use client'

import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {useEffect, useState} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import EmptyState from '@directwerk/ui/components/empty-state'
import PageHeader from '@directwerk/ui/components/page-header'

import {listMyDownloads} from '@/lib/api/client'
import {AUTH_REQUIRED} from '@directwerk/api/constants'
import type {SubscriberDownload} from '@directwerk/api/types'
import {getClientTenantHost} from '@/lib/tenant/getClientTenantHost'
import {useAuthRequired} from '@directwerk/api/auth/useAuthRequired'

export default function DownloadsPage(): React.JSX.Element {
    const router = useRouter()
    const authRedirect = useAuthRequired()
    const tenantHost = getClientTenantHost()
    const [downloads, setDownloads] = useState<SubscriberDownload[]>([])
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        let active = true
        listMyDownloads(tenantHost)
            .then((items) => {
                if (active) {
                    setDownloads(items)
                    setIsLoading(false)
                }
            })
            .catch((error: unknown) => {
                if (!active) {
                    return
                }
                if (authRedirect(error)) return
                setErrorMessage(
                    error instanceof Error
                        ? error.message
                        : 'Bonusdateien konnten nicht geladen werden.',
                )
                setIsLoading(false)
            })
        return () => {
            active = false
        }
    }, [router, tenantHost])

    return (
        <div className="page-container space-y-8">
            <PageHeader
                title="Bonusdateien"
                description="PDFs und andere Dateien, die dein Abo freischaltet."
            />
            {isLoading ? <p>Wird geladen…</p> : null}
            {errorMessage !== null ? (
                <Alert variant="destructive">
                    <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
            ) : null}
            {!isLoading && errorMessage === null && downloads.length === 0 ? (
                <EmptyState
                    title="Noch keine Bonusdateien"
                    description="Sobald ein Paket eine Datei freischaltet, erscheint sie hier."
                    action={
                        <Link href="/pricing">Mitgliedschaft ansehen</Link>
                    }
                />
            ) : null}
            {downloads.length > 0 ? (
                <ul className="grid gap-4 sm:grid-cols-2">
                    {downloads.map((item) => (
                        <li className="rounded-xl border bg-card p-4" key={item.id}>
                            <p className="font-medium">{item.title}</p>
                            <p className="mt-1 text-sm text-muted-foreground">
                                {item.assetType}
                                {item.sizeBytes !== null
                                    ? ` · ${Math.max(1, Math.round(item.sizeBytes / 1024))} KB`
                                    : ''}
                            </p>
                            <p className="mt-3 text-sm">
                                <a href={item.downloadUrl} rel="noreferrer">
                                    Herunterladen
                                </a>
                            </p>
                        </li>
                    ))}
                </ul>
            ) : null}
        </div>
    )
}
