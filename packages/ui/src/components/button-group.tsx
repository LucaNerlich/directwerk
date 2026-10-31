import {cva, type VariantProps} from 'class-variance-authority'
import type {ComponentProps} from 'react'

import {cn} from '#lib/utils'

const buttonGroupVariants = cva(
    'flex w-fit items-stretch [&>[data-slot=button]]:focus-visible:relative [&>[data-slot=button]]:focus-visible:z-10',
    {
        variants: {
            orientation: {
                horizontal:
                    '[&>[data-slot=button]:not(:first-child)]:rounded-l-none [&>[data-slot=button]:not(:last-child)]:rounded-r-none [&>[data-slot=button]:not(:first-child)]:border-l-0',
                vertical:
                    'flex-col [&>[data-slot=button]:not(:first-child)]:rounded-t-none [&>[data-slot=button]:not(:last-child)]:rounded-b-none [&>[data-slot=button]:not(:first-child)]:border-t-0',
            },
        },
        defaultVariants: {
            orientation: 'horizontal',
        },
    },
)

function ButtonGroup({
    className,
    orientation = 'horizontal',
    ...props
}: ComponentProps<'div'> & VariantProps<typeof buttonGroupVariants>) {
    return (
        <div
            role="group"
            data-slot="button-group"
            data-orientation={orientation ?? undefined}
            className={cn(buttonGroupVariants({orientation}), className)}
            {...props}
        />
    )
}

export {ButtonGroup, buttonGroupVariants}
