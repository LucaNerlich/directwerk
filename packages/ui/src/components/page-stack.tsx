import type {ReactNode} from 'react'

import {cn} from '#lib/utils'

export default function PageStack({
    children,
    className,
}: {
    children: ReactNode
    className?: string
}): React.JSX.Element {
    return <div className={cn('flex flex-col gap-8', className)}>{children}</div>
}
