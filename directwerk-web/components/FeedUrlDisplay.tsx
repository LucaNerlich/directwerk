'use client'

import {buttonVariants} from '@directwerk/ui/components/button'
import {cn} from '@directwerk/ui/lib/utils'

import CopyUrlButton from '@/components/CopyUrlButton'

export default function FeedUrlDisplay({
    url,
    title,
    description,
    className,
}: {
    url: string
    title?: string
    description?: string
    className?: string
}): React.JSX.Element {
    return (
        <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between', className)}>
            <div className="min-w-0 flex-1">
                {title !== undefined ? <p className="font-medium">{title}</p> : null}
                {description !== undefined ? (
                    <p className="mt-1 text-sm text-muted-foreground">{description}</p>
                ) : null}
                <p className="mt-2 break-all rounded-md bg-muted/50 px-3 py-2 font-mono text-xs leading-5 text-muted-foreground">
                    {url}
                </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
                <a
                    className={buttonVariants({size: 'sm', variant: 'outline'})}
                    href={url}
                    rel="noreferrer"
                    target="_blank"
                >
                    Öffnen
                </a>
                <CopyUrlButton url={url} />
            </div>
        </div>
    )
}
