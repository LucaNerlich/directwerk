'use client'

import Link from 'next/link'
import {useRouter} from 'next/navigation'
import {useCallback, useEffect, useRef, useState} from 'react'

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
import {getPlatformAuditPage} from '@/lib/api/client'
import {AUTH_REQUIRED} from '@directwerk/api/constants'
import type {PlatformAuditPage, PlatformAuditQuery} from '@directwerk/api/types'

const DEFAULT_QUERY: PlatformAuditQuery = {
    page: 0,
    size: 50,
}

function formatDetails(details: Record<string, unknown>): string {
    return JSON.stringify(details, null, 2)
}

export default function AuditPage(): React.JSX.Element {
    const router = useRouter()
    const [query, setQuery] = useState<PlatformAuditQuery>(DEFAULT_QUERY)
    const [page, setPage] = useState<PlatformAuditPage | null>(null)
    const [expandedId, setExpandedId] = useState<number | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [filterError, setFilterError] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [reloadKey, setReloadKey] = useState(0)
    const latestRequestId = useRef(0)

    const loadAudit = useCallback(
        (nextQuery: PlatformAuditQuery) => {
            const requestId = ++latestRequestId.current
            setError(null)
            setIsLoading(true)

            getPlatformAuditPage(nextQuery)
                .then((result) => {
                    if (requestId !== latestRequestId.current) {
                        return
                    }
                    setPage(result)
                    setIsLoading(false)
                })
                .catch((requestError: unknown) => {
                    if (requestId !== latestRequestId.current) {
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
                    setError('Could not load audit log.')
                    setIsLoading(false)
                })

            return () => {
                if (requestId === latestRequestId.current) {
                    latestRequestId.current += 1
                }
            }
        },
        [router],
    )

    useEffect(() => {
        return loadAudit(query)
    }, [loadAudit, query, reloadKey])

    function applyFilters(formData: FormData): void {
        const tenantIdRaw = String(formData.get('tenantId') ?? '').trim()
        const action = String(formData.get('action') ?? '').trim()
        const actorEmail = String(formData.get('actorEmail') ?? '').trim()
        const sizeRaw = String(formData.get('size') ?? '50').trim()

        const size = Number(sizeRaw)
        if (!Number.isInteger(size) || size < 1 || size > 100) {
            setFilterError('Size must be between 1 and 100.')
            return
        }

        let tenantId: number | undefined
        if (tenantIdRaw.length > 0) {
            tenantId = Number(tenantIdRaw)
            if (!Number.isInteger(tenantId) || tenantId < 1) {
                setFilterError('Tenant ID must be a positive integer.')
                return
            }
        }

        setFilterError(null)
        setQuery({
            page: 0,
            size,
            tenantId,
            action: action.length > 0 ? action : undefined,
            actorEmail: actorEmail.length > 0 ? actorEmail : undefined,
        })
    }

    function resetFilters(): void {
        setFilterError(null)
        setExpandedId(null)
        setQuery(DEFAULT_QUERY)
    }

    const hasPreviousPage = page !== null && page.page > 0
    const hasNextPage =
        page !== null && (page.page + 1) * page.size < page.totalElements

    return (
        <PageStack>
            <PageHeader
                description="Filter platform-admin actions and inspect event details."
                eyebrow="Platform"
                title="Audit log"
            />

            <Card aria-labelledby="audit-filters-heading" role="region">
                <CardHeader>
                    <CardTitle id="audit-filters-heading">Filters</CardTitle>
                    <CardDescription>
                        Tenant, action, and actor narrow the log. Page size
                        caps how many events load at once.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form
                        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
                        key={JSON.stringify(query)}
                        onSubmit={(event) => {
                            event.preventDefault()
                            applyFilters(new FormData(event.currentTarget))
                        }}
                    >
                        <div className="space-y-2">
                            <Label htmlFor="audit-tenant-id">Tenant ID</Label>
                            <Input
                                defaultValue={query.tenantId ?? ''}
                                id="audit-tenant-id"
                                inputMode="numeric"
                                name="tenantId"
                                type="number"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="audit-action">Action</Label>
                            <Input
                                defaultValue={query.action ?? ''}
                                id="audit-action"
                                name="action"
                                placeholder="TENANT_CREATED"
                                type="text"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="audit-actor-email">Actor email</Label>
                            <Input
                                defaultValue={query.actorEmail ?? ''}
                                id="audit-actor-email"
                                name="actorEmail"
                                type="email"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="audit-size">Page size</Label>
                            <Input
                                defaultValue={query.size ?? 50}
                                id="audit-size"
                                max={100}
                                min={1}
                                name="size"
                                type="number"
                            />
                        </div>
                        {filterError ? (
                            <Alert
                                aria-live="polite"
                                className="sm:col-span-2 lg:col-span-4"
                                variant="destructive"
                            >
                                <AlertDescription>{filterError}</AlertDescription>
                            </Alert>
                        ) : null}
                        <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-4">
                            <Button type="submit">
                                Apply filters
                            </Button>
                            <Button onClick={resetFilters} type="button" variant="outline">
                                Reset
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>

            {error ? (
                <>
                    <Alert variant="destructive">
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                    <div>
                        <Button onClick={() => setReloadKey((value) => value + 1)} type="button" variant="outline">
                            Retry
                        </Button>
                    </div>
                </>
            ) : null}

            {isLoading ? (
                <>
                    <TableSkeleton rows={6} />
                    <AdminLoadingText text="Loading audit events…" />
                </>
            ) : null}

            {!isLoading && page ? (
                <>
                    <p aria-live="polite" className="text-sm text-muted-foreground">
                        Showing {page.content.length} of {page.totalElements} events
                        (page {page.page + 1}, size {page.size}).
                    </p>

                    {page.content.length > 0 ? (
                        <ResponsiveTable label="Audit events">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead scope="col">When</TableHead>
                                        <TableHead scope="col">Action</TableHead>
                                        <TableHead scope="col">Actor</TableHead>
                                        <TableHead scope="col">Tenant</TableHead>
                                        <TableHead scope="col">Details</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {page.content.map((event) => (
                                        <TableRow key={event.id}>
                                            <TableCell className="whitespace-nowrap text-sm">
                                                {new Date(event.createdAt).toLocaleString()}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline">
                                                    {event.action}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                {event.actorEmail ??
                                                    event.actorUserId ??
                                                    '—'}
                                            </TableCell>
                                            <TableCell>
                                                {event.tenantId !== null ? (
                                                    <Link
                                                        className="underline-offset-4 hover:underline"
                                                        href={`/tenants/${event.tenantId}`}
                                                    >
                                                        {event.tenantId}
                                                    </Link>
                                                ) : (
                                                    '—'
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <Button
                                                    aria-expanded={expandedId === event.id}
                                                    onClick={() =>
                                                        setExpandedId((current) =>
                                                            current === event.id
                                                                ? null
                                                                : event.id,
                                                        )
                                                    }
                                                    type="button"
                                                    variant="outline"
                                                >
                                                    {expandedId === event.id
                                                        ? 'Hide'
                                                        : 'Show'}
                                                </Button>
                                                {expandedId === event.id ? (
                                                    <pre className="mt-2 max-w-xl overflow-x-auto rounded-md bg-muted p-3 text-xs">
                                                        {formatDetails(event.details)}
                                                    </pre>
                                                ) : null}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </ResponsiveTable>
                    ) : (
                        <EmptyState
                            description="Try widening the filters or resetting them."
                            title="No audit events match the current filters"
                        />
                    )}

                    <div className="flex flex-wrap items-center gap-2">
                        <Button
                            aria-label="Previous audit page"
                            disabled={!hasPreviousPage}
                            onClick={() =>
                                setQuery((current) => ({
                                    ...current,
                                    page: Math.max(0, (current.page ?? 0) - 1),
                                }))
                            }
                            type="button"
                            variant="outline"
                        >
                            Previous page
                        </Button>
                        <Button
                            aria-label="Next audit page"
                            disabled={!hasNextPage}
                            onClick={() =>
                                setQuery((current) => ({
                                    ...current,
                                    page: (current.page ?? 0) + 1,
                                }))
                            }
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
