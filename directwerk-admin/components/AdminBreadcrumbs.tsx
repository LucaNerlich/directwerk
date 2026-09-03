'use client'

import Link from 'next/link'
import {Fragment} from 'react'

export interface AdminCrumb {
    label: string
    href?: string
}

/**
 * English breadcrumb trail for admin detail pages. Keeps the tenant/job
 * hierarchy visible and gives keyboard and small-screen users a way back
 * without relying on raw "←" links.
 */
export default function AdminBreadcrumbs({
    items,
}: {
    items: readonly AdminCrumb[]
}): React.JSX.Element {
    return (
        <nav aria-label="Breadcrumb">
            <ol className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
                {items.map((item, index) => {
                    const isLast = index === items.length - 1
                    return (
                        <Fragment key={`${item.label}-${index}`}>
                            {index > 0 ? (
                                <li aria-hidden="true" className="select-none">
                                    /
                                </li>
                            ) : null}
                            <li className="min-w-0">
                                {item.href !== undefined && !isLast ? (
                                    <Link
                                        className="underline-offset-4 hover:underline hover:text-foreground"
                                        href={item.href}
                                    >
                                        {item.label}
                                    </Link>
                                ) : (
                                    <span
                                        aria-current={isLast ? 'page' : undefined}
                                        className={
                                            isLast
                                                ? 'inline-block max-w-64 truncate font-medium text-foreground'
                                                : undefined
                                        }
                                    >
                                        {item.label}
                                    </span>
                                )}
                            </li>
                        </Fragment>
                    )
                })}
            </ol>
        </nav>
    )
}
