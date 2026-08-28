'use client'

import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {use, useEffect, useState} from 'react'

import {Alert, AlertDescription, AlertTitle} from '@directwerk/ui/components/alert'
import {Badge} from '@directwerk/ui/components/badge'
import {Button} from '@directwerk/ui/components/button'
import {Card, CardContent, CardHeader, CardTitle} from '@directwerk/ui/components/card'
import PageHeader from '@directwerk/ui/components/page-header'

import {getPlatformData, postPlatformData} from '@/lib/api/client'
import {AUTH_REQUIRED} from '@directwerk/api/constants'
import type {QueueJob} from '@directwerk/api/types'

interface JobPageProps {
    params: Promise<{id: string}>
}

const UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function formatTimestamp(value: string | null): string {
    if (value === null) {
        return '—'
    }

    const parsed = Date.parse(value)

    if (Number.isNaN(parsed)) {
        return value
    }

    return new Date(parsed).toLocaleString()
}

function formatPayload(payload: unknown): string {
    try {
        return JSON.stringify(payload, null, 2)
    } catch {
        return String(payload)
    }
}

const ADMIN_WORKER = 'platform-admin-ui'

export default function JobPage({params}: JobPageProps) {
    const {id} = use(params)
    const router = useRouter()
    const [job, setJob] = useState<QueueJob | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [isInitialLoad, setIsInitialLoad] = useState(true)
    const [actionBusy, setActionBusy] = useState(false)
    const [actionMessage, setActionMessage] = useState<string | null>(null)

    useEffect(() => {
        if (!UUID_PATTERN.test(id)) {
            setError('Invalid job identifier.')
            setJob(null)
            setIsInitialLoad(false)
            return
        }

        setJob(null)
        setError(null)
        setIsInitialLoad(true)

        let isCurrent = true

        getPlatformData<QueueJob>(`queue/jobs/${id}`)
            .then((result) => {
                if (isCurrent) {
                    setJob(result)
                    setIsInitialLoad(false)
                }
            })
            .catch((requestError: unknown) => {
                if (!isCurrent) {
                    return
                }

                if (
                    requestError instanceof Error &&
                    requestError.message === AUTH_REQUIRED
                ) {
                    router.replace('/login')
                    return
                }

                setJob(null)
                setError('Could not load job details.')
                setIsInitialLoad(false)
            })

        return () => {
            isCurrent = false
        }
    }, [id, router])

    async function handleComplete(): Promise<void> {
        if (job === null) {
            return
        }
        setActionBusy(true)
        setActionMessage(null)
        try {
            const updated = await postPlatformData<QueueJob>(
                `queue/jobs/${job.id}/complete`,
                {worker: job.lockedBy ?? ADMIN_WORKER},
            )
            setJob(updated)
            setActionMessage('Job marked complete.')
        } catch {
            setActionMessage('Could not complete job.')
        } finally {
            setActionBusy(false)
        }
    }

    async function handleFail(): Promise<void> {
        if (job === null) {
            return
        }
        setActionBusy(true)
        setActionMessage(null)
        try {
            const updated = await postPlatformData<QueueJob>(
                `queue/jobs/${job.id}/fail`,
                {
                    worker: job.lockedBy ?? ADMIN_WORKER,
                    error: 'Manually failed from platform admin UI',
                    retryDelaySeconds: 0,
                },
            )
            setJob(updated)
            setActionMessage('Job marked failed.')
        } catch {
            setActionMessage('Could not fail job.')
        } finally {
            setActionBusy(false)
        }
    }

    const canOperate =
        job !== null &&
        (job.status === 'PROCESSING' || job.status === 'QUEUED' || job.status === 'FAILED')

    return (
        <div className="space-y-8">
                <Link className="text-sm font-medium underline-offset-4 hover:underline" href="/jobs">← Back to queue jobs</Link>

                {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
                {!error && isInitialLoad ? <p aria-live="polite" className="text-sm text-muted-foreground">Loading job details…</p> : null}

                {job ? (
                    <>
                        <PageHeader actions={<Badge variant="outline">{job.status}</Badge>} eyebrow="Queue job" title={job.id} />

                        {job.status === 'FAILED' && job.lastError ? (
                            <Alert variant="destructive"><AlertTitle>Last error</AlertTitle><AlertDescription>{job.lastError}</AlertDescription></Alert>
                        ) : null}

                        {canOperate ? (
                            <div className="flex flex-wrap items-center gap-3">
                                <Button
                                    disabled={actionBusy}
                                    onClick={() => {
                                        void handleComplete()
                                    }}
                                    type="button"
                                >
                                    Mark complete
                                </Button>
                                <Button
                                    disabled={actionBusy}
                                    onClick={() => {
                                        void handleFail()
                                    }}
                                    type="button"
                                    variant="outline"
                                >
                                    Mark failed
                                </Button>
                                {actionMessage !== null ? (
                                    <p className="text-sm text-muted-foreground" role="status">
                                        {actionMessage}
                                    </p>
                                ) : null}
                            </div>
                        ) : null}

                        <Card>
                            <CardHeader><CardTitle>Job details</CardTitle></CardHeader>
                            <CardContent><dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 [&_dd]:mt-1 [&_dd]:text-sm [&_dt]:text-xs [&_dt]:font-semibold [&_dt]:uppercase [&_dt]:tracking-wide [&_dt]:text-muted-foreground">
                            <dt>Queue</dt>
                            <dd>{job.queue}</dd>
                            <dt>Status</dt>
                            <dd>{job.status}</dd>
                            <dt>Priority</dt>
                            <dd>{job.priority}</dd>
                            <dt>Attempts</dt>
                            <dd>
                                {job.attempts}/{job.maxAttempts}
                            </dd>
                            <dt>Available at</dt>
                            <dd>{formatTimestamp(job.availableAt)}</dd>
                            <dt>Locked by</dt>
                            <dd>{job.lockedBy ?? '—'}</dd>
                            <dt>Locked until</dt>
                            <dd>{formatTimestamp(job.lockedUntil)}</dd>
                            <dt>Last error</dt>
                            <dd>{job.lastError ?? '—'}</dd>
                            <dt>Created at</dt>
                            <dd>{formatTimestamp(job.createdAt)}</dd>
                            <dt>Updated at</dt>
                            <dd>{formatTimestamp(job.updatedAt)}</dd>
                            </dl></CardContent>
                        </Card>

                        <Card>
                            <CardHeader><CardTitle>Payload</CardTitle></CardHeader>
                            <CardContent><pre className="overflow-x-auto rounded-lg bg-muted p-4 text-xs">{formatPayload(job.payload)}</pre></CardContent>
                        </Card>
                    </>
                ) : null}
        </div>
    )
}
