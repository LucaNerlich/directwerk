export const dynamic = 'force-dynamic'

/**
 * Manage area shell. Subscription gating lives on Abos pages, not here —
 * categories (Organisation) must remain available without SUBSCRIPTION.
 */
export default function ManageLayout({
    children,
}: {
    children: React.ReactNode
}): React.JSX.Element {
    return <>{children}</>
}
