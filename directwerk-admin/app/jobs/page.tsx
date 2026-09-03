'use client'

import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {useCallback, useEffect, useState} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Badge} from '@directwerk/ui/components/badge'
import {Button} from '@directwerk/ui/components/button'
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@directwerk/ui/components/card'
import EmptyState from '@directwerk/ui/components/empty-state'
import {Input} from '@directwerk/ui/components/input'
import {Label} from '@directwerk/ui/components/label'
import PageHeader from '@directwerk/ui/components/page-header'
import PageStack from '@directwerk/ui/components/page-stack'
import ResponsiveTable from '@directwerk/ui/components/responsive-table'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@directwerk/ui/components/table'

import {AdminLoadingText, TableSkeleton} from '@/components/AdminLoading'
import {getPlatformJobList} from '@/lib/api/client'
import {AUTH_REQUIRED} from '@directwerk/api/constants'
import {
    JOB_STATUSES,
    KNOWN_JOB_QUEUES,
    type JobListPage,
    type JobListQuery,
} from '@directwerk/api/types'
import {validateJobListQuery} from '@/lib/validation'

const DEFAULT_QUERY: JobListQuery = {
    offset: 0,
    limit: 20,
}

function formatTimestamp(value: string): string {
    const parsed = Date.parse(value)

    if (Number.isNaN(parsed)) {
        return value
    }

    return new Date(parsed).toLocaleString()
}

export default function JobsPage() {
    const router = useRouter()
    const [query, setQuery] = useState<JobListQuery>(DEFAULT_QUERY)
    const [page, setPage] = useState<JobListPage | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [filterError, setFilterError] = useState<string | null>(null)
    const [isInitialLoad, setIsInitialLoad] = useState(true)

    const loadJobs = useCallback(
        (nextQuery: JobListQuery) => {
            setError(null)

            let isCurrent = true

            getPlatformJobList(nextQuery)
                .then((result) => {
                    if (isCurrent) {
                        setPage(result)
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

                    setPage(null)
                    setError('Could not load queue jobs.')
                    setIsInitialLoad(false)
                })

            return () => {
                isCurrent = false
            }
        },
        [router]
    )

    useEffect(() => {
        const cleanup = loadJobs(query)
        return cleanup
    }, [loadJobs, query])

    function applyFilters(formData: FormData): void {
        const validation = validateJobListQuery({
            queue: formData.get('queue'),
            status: formData.get('status'),
            offset: formData.get('offset'),
            limit: formData.get('limit'),
        })

        if (!validation.success) {
            setFilterError(validation.error)
            return
        }

        setFilterError(null)
        setQuery({
            ...validation.data,
            offset: validation.data.offset ?? 0,
            limit: validation.data.limit ?? 20,
        })
    }

    function resetFilters(): void {
        setFilterError(null)
        setQuery(DEFAULT_QUERY)
    }

    function goToPreviousPage(): void {
        if (!page || page.offset === 0) {
            return
        }

        setQuery((current) => ({
            ...current,
            offset: Math.max(0, page.offset - page.limit),
        }))
    }

    function goToNextPage(): void {
        if (!page || page.offset + page.limit >= page.total) {
            return
        }

        setQuery((current) => ({
            ...current,
            offset: page.offset + page.limit,
        }))
    }

    const hasPreviousPage = page !== null && page.offset > 0
    const hasNextPage =
        page !== null && page.offset + page.limit < page.total

    return (
        <PageStack>
                <PageHeader description="Inspect background processing and delivery attempts." eyebrow="Operations" title="Queue jobs" />

                <Card aria-labelledby="job-filters-heading" role="region">
                    <CardHeader>
                        <CardTitle id="job-filters-heading">Filters</CardTitle>
                        <CardDescription>
                            Queue and status narrow the list. After sending an
                            invitation, filter by the email queue to inspect
                            the mail job.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                    <form
                        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
                        key={`${query.offset}-${query.limit}`}
                        onSubmit={(event) => {
                            event.preventDefault()
                            applyFilters(new FormData(event.currentTarget))
                        }}
                    >
                        <div className="space-y-2">
                            <Label htmlFor="job-queue">Queue</Label>
                            <select
                                className="native-select"
                                defaultValue={query.queue ?? ''}
                                id="job-queue"
                                name="queue"
                            >
                                <option value="">All queues</option>
                                {KNOWN_JOB_QUEUES.map((queueName) => (
                                    <option key={queueName} value={queueName}>
                                        {queueName}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="job-status">Status</Label>
                            <select
                                className="native-select"
                                defaultValue={query.status ?? ''}
                                id="job-status"
                                name="status"
                            >
                                <option value="">All statuses</option>
                                {JOB_STATUSES.map((status) => (
                                    <option key={status} value={status}>
                                        {status}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="job-offset">Offset</Label>
                            <Input
                                id="job-offset"
                                inputMode="numeric"
                                min={0}
                                name="offset"
                                type="number"
                                defaultValue={query.offset ?? 0}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="job-limit">Limit</Label>
                            <Input
                                id="job-limit"
                                inputMode="numeric"
                                max={100}
                                min={1}
                                name="limit"
                                type="number"
                                defaultValue={query.limit ?? 20}
                            />
                        </div>
                        {filterError ? (
                            <Alert aria-live="polite" className="sm:col-span-2 lg:col-span-4" variant="destructive"><AlertDescription>{filterError}</AlertDescription></Alert>
                        ) : null}
                        <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-4">
                            <Button type="submit">Apply filters</Button>
                            <Button onClick={resetFilters} type="button" variant="outline">Reset</Button>
                        </div>
                    </form>
                    </CardContent>
                </Card>

                {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
                {!error && isInitialLoad ? (
                    <>
                        <TableSkeleton rows={6} />
                        <AdminLoadingText text="Loading queue jobs…" />
                    </>
                ) : null}

                {page ? (
                    <>
                        <p aria-live="polite" className="text-sm text-muted-foreground">
                            Showing {page.items.length} of {page.total} jobs
                            (offset {page.offset}, limit {page.limit}).
                        </p>

                        {page.items.length > 0 ? (
                            <ResponsiveTable label="Queue jobs">
                                <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead scope="col">Job ID</TableHead>
                                        <TableHead scope="col">Queue</TableHead>
                                        <TableHead scope="col">Status</TableHead>
                                        <TableHead scope="col">Attempts</TableHead>
                                        <TableHead scope="col">Updated</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {page.items.map((job) => (
                                        <TableRow key={job.id}>
                                            <TableCell>
                                                <Link className="font-medium underline-offset-4 hover:underline" href={`/jobs/${job.id}`}>
                                                    {job.id}
                                                </Link>
                                            </TableCell>
                                            <TableCell>{job.queue}</TableCell>
                                            <TableCell><Badge variant="outline">{job.status}</Badge></TableCell>
                                            <TableCell>
                                                {job.attempts}/{job.maxAttempts}
                                            </TableCell>
                                            <TableCell>
                                                {formatTimestamp(job.updatedAt)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                            </ResponsiveTable>
                        ) : (
                            <EmptyState
                                description="Try a different queue or status, or reset the filters."
                                title="No jobs match the current filters"
                            />
                        )}

                        <div className="flex flex-wrap gap-2">
                            <Button
                                aria-label="Previous jobs page"
                                disabled={!hasPreviousPage}
                                onClick={goToPreviousPage}
                                type="button"
                                variant="outline"
                            >
                                Previous page
                            </Button>
                            <Button
                                aria-label="Next jobs page"
                                disabled={!hasNextPage}
                                onClick={goToNextPage}
                                type="button"
                                variant="outline"
                            >
                                Next page
                            </Button>
                        </div>
                    </>
                ) : null}
        </PageStack>
    )
}
