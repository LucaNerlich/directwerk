import {Badge} from '@publish/ui/components/badge'

import type {PublicationStatus} from '@/lib/api/types'

const LABELS: Record<PublicationStatus, string> = {
    DRAFT: 'Entwurf',
    SCHEDULED: 'Geplant',
    PUBLISHED: 'Veröffentlicht',
    ARCHIVED: 'Archiviert',
}

export default function PublicationStatusBadge({status}: {status: PublicationStatus}) {
    const variant = status === 'PUBLISHED'
        ? 'default'
        : status === 'ARCHIVED'
          ? 'outline'
          : 'secondary'

    return (
        <Badge className="uppercase tracking-wide" variant={variant}>
            {LABELS[status]}
        </Badge>
    )
}
