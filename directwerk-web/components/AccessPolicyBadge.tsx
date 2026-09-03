import {Badge} from '@directwerk/ui/components/badge'
import type {AccessPolicy} from '@directwerk/api/types'

import {entitlementLabel, entitlementState} from '@/lib/format/content'

/**
 * Entitlement-aware access badge shared by episodes, articles and the home
 * teaser cards: "Frei" / "Enthalten" / "Mitgliedschaft nötig".
 *
 * Pass `isEntitled` for `PAID` items when the viewer can currently consume
 * them (playable audio / readable body). Omit it for `FREE` items or when
 * entitlement is unknown — paid items then read as locked.
 */
export default function AccessPolicyBadge({
    policy,
    isEntitled = false,
    className,
}: {
    policy: AccessPolicy
    isEntitled?: boolean
    className?: string
}): React.JSX.Element {
    const state = entitlementState(policy, isEntitled)
    return (
        <Badge
            className={className}
            variant={state === 'included' ? 'default' : state === 'locked' ? 'secondary' : 'outline'}
        >
            {entitlementLabel(policy, isEntitled)}
        </Badge>
    )
}
