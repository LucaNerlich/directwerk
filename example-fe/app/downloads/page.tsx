'use client'

import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {useEffect, useState} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import EmptyState from '@directwerk/ui/components/empty-state'
import PageHeader from '@directwerk/ui/components/page-header'

import {listMyDownloads} from '@/lib/api/client'
import {AUTH_REQUIRED} from '@/lib/api/errors'
import type {SubscriberDownload} from '@/lib/api/types'
import {useSelectedTenant} from '@/lib/useSelectedTenant'

export default function DownloadsPage(): React.JSX.Element {
    const router = useRouter()
    const tenantHost = useSelectedTenant()
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
                if (error instanceof Error && error.message === AUTH_REQUIRED) {
                    router.replace('/login')
                    return
                }
                setErrorMessage(
                    error instanceof Error
                        ? error.message
                        : 'Unable to load downloads.',
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
                title="Downloads"
                description="Bonus files entitled by DIGITAL_ASSET package rules."
            />
            {isLoading ? <p>Loading…</p> : null}
            {errorMessage !== null ? (
                <Alert variant="destructive">
                    <AlertDescription>{errorMessage}</AlertDescription>
                </Alert>
            ) : null}
            {!isLoading && errorMessage === null && downloads.length === 0 ? (
                <EmptyState
                    title="No bonus files yet"
                    description="Attach a DOCUMENT asset to a PACKAGE product, then grant that product."
                    action={<Link href="/pricing">View pricing</Link>}
                />
            ) : null}
            {downloads.length > 0 ? (
                <ul className="space-y-3">
                    {downloads.map((item) => (
                        <li className="rounded-xl border bg-card p-4" key={item.id}>
                            <h2 className="font-semibold">{item.title}</h2>
                            <p className="text-sm text-muted-foreground">{item.assetType}</p>
                            <p className="mt-2 text-sm">
                                <a href={item.downloadUrl} rel="noreferrer">
                                    Download
                                </a>
                            </p>
                        </li>
                    ))}
                </ul>
            ) : null}
        </div>
    )
}
