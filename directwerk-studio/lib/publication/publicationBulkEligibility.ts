import type {PublicationStatus} from '@directwerk/api/types'

export function isBulkPublicationStatus(status: PublicationStatus): boolean {
    return status === 'DRAFT' || status === 'PUBLISHED'
}
