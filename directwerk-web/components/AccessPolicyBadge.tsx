import {Badge} from '@directwerk/ui/components/badge'
import type {AccessPolicy} from '@directwerk/api/types'

import {accessPolicyLabel} from '@/lib/format/content'

export default function AccessPolicyBadge({
    policy,
    className,
}: {
    policy: AccessPolicy
    className?: string
}): React.JSX.Element {
    return (
        <Badge className={className} variant={policy === 'PAID' ? 'secondary' : 'outline'}>
            {accessPolicyLabel(policy)}
        </Badge>
    )
}
