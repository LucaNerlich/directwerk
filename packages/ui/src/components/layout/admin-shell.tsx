import type {ReactNode} from 'react'

import AppShell from '#components/layout/app-shell'

export default function AdminShell({
    brand,
    navigation,
    footer,
    children,
}: {
    brand: ReactNode
    navigation: ReactNode
    footer?: ReactNode
    children: ReactNode
}): React.JSX.Element {
    return (
        <AppShell
            brand={brand}
            footer={footer}
            navigation={navigation}
            navigationTriggerLabel="Open navigation"
            skipLinkLabel="Skip to content"
        >
            {children}
        </AppShell>
    )
}
