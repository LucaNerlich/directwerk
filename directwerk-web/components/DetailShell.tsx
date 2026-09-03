'use client'

import Link from 'next/link'
import type {ReactNode} from 'react'

import {Alert, AlertDescription} from '@directwerk/ui/components/alert'
import {Button, buttonVariants} from '@directwerk/ui/components/button'
import EmptyState from '@directwerk/ui/components/empty-state'
import PageStack from '@directwerk/ui/components/page-stack'
import SectionHeader from '@directwerk/ui/components/section-header'

import {DetailSkeleton} from '@/components/ContentLoadingSkeleton'

export interface DetailNotFound {
    title: string
    description: string
}

/**
 * Inline locked-content panel shared by the episode and article detail pages:
 * no bare text, no destructive alert — Anmelden / Mitgliedschaft actions plus
 * an optional retry.
 */
export function DetailLockedPanel({
    title,
    description,
    isAuthenticated,
    unlockHref,
}: {
    title: string
    description?: ReactNode
    isAuthenticated: boolean
    unlockHref: string
}): React.JSX.Element {
    return (
        <section className="flex flex-col gap-3 rounded-xl border bg-card p-5">
            <SectionHeader title={title} />
            {description !== undefined ? (
                <div className="text-sm leading-6 text-muted-foreground">{description}</div>
            ) : null}
            <div className="flex flex-wrap gap-2">
                {!isAuthenticated ? (
                    <Button nativeButton={false} render={<Link href="/login" />}>
                        Anmelden
                    </Button>
                ) : null}
                <Button
                    nativeButton={false}
                    render={<Link href={unlockHref} />}
                    variant={isAuthenticated ? 'default' : 'outline'}
                >
                    Mitgliedschaft ansehen
                </Button>
            </div>
        </section>
    )
}

/**
 * Shared shell for the episode and article detail clients: back link, loading
 * skeleton, transport-error alert with retry, and a paid-gate / not-found
 * `EmptyState` with Anmelden / Mitgliedschaft / retry actions.
 */
export default function DetailShell({
    backHref,
    backLabel,
    isLoading,
    isAuthenticated,
    errorMessage,
    onRetry,
    notFound,
    unlockHref,
    children,
}: {
    backHref: string
    backLabel: string
    isLoading: boolean
    isAuthenticated: boolean
    errorMessage: string | null
    onRetry: () => void
    notFound: DetailNotFound | null
    unlockHref: string
    children?: ReactNode
}): React.JSX.Element {
    return (
        <PageStack className="page-container">
            <Link
                className="text-sm text-muted-foreground hover:text-foreground"
                href={backHref}
            >
                {backLabel}
            </Link>
            {isLoading ? <DetailSkeleton /> : null}
            {errorMessage !== null ? (
                <div className="flex max-w-3xl flex-col gap-3">
                    <Alert variant="destructive">
                        <AlertDescription>{errorMessage}</AlertDescription>
                    </Alert>
                    <div>
                        <Button onClick={onRetry} type="button" variant="outline">
                            Erneut versuchen
                        </Button>
                    </div>
                </div>
            ) : null}
            {!isLoading && errorMessage === null && notFound !== null ? (
                <EmptyState
                    title={notFound.title}
                    description={notFound.description}
                    action={
                        <div className="flex flex-wrap items-center justify-center gap-2">
                            {!isAuthenticated ? (
                                <Link className={buttonVariants()} href="/login">
                                    Anmelden
                                </Link>
                            ) : null}
                            <Link
                                className={buttonVariants({
                                    variant: isAuthenticated ? 'default' : 'outline',
                                })}
                                href={unlockHref}
                            >
                                Mitgliedschaft ansehen
                            </Link>
                            <Button onClick={onRetry} type="button" variant="ghost">
                                Erneut versuchen
                            </Button>
                        </div>
                    }
                />
            ) : null}
            {!isLoading && errorMessage === null && notFound === null
                ? children
                : null}
        </PageStack>
    )
}
