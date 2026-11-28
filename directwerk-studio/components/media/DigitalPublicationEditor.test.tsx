import {screen} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {describe, expect, it, vi} from 'vitest'

import {renderWithLocale} from '@/lib/i18n/testUtils'

const deleteDigitalPublication = vi.fn()
vi.mock('@/lib/api/digitalPublicationsApi', () => ({
    archiveDigitalPublication: vi.fn(),
    createDigitalPublication: vi.fn(),
    deleteDigitalPublication: (...args: unknown[]) => deleteDigitalPublication(...args),
    getDigitalPublication: vi.fn().mockResolvedValue({
        id: 5,
        title: 'Bonus file',
        slug: 'bonus-file',
        description: '',
        assetId: 9,
        accessPolicy: 'FREE',
        requiredLevelSortOrder: null,
        status: 'PUBLISHED',
        availableActions: ['EDIT', 'DELETE'],
        createdBy: 1,
    }),
    publishDigitalPublication: vi.fn(),
    unarchiveDigitalPublication: vi.fn(),
    unpublishDigitalPublication: vi.fn(),
    updateDigitalPublication: vi.fn(),
}))
vi.mock('@/lib/api/client', () => ({hasModule: () => true}))
vi.mock('@/lib/rbac/useDeskAccess', () => ({
    useDeskAccess: () => ({
        canCreate: true,
        canEdit: true,
        canDelete: true,
        canPublish: true,
        createBlockedReason: null,
        editBlockedReason: null,
    }),
}))
vi.mock('@/lib/site/SiteConfigProvider', () => ({useSiteConfig: () => ({enabledModules: ['BONUS_CONTENT']})}))
vi.mock('@directwerk/api/auth/useAuthRequired', () => ({useAuthRequired: () => () => false}))
vi.mock('next/navigation', () => ({useRouter: () => ({replace: vi.fn()})}))
vi.mock('@/components/media/MediaLibraryPicker', () => ({default: () => <div />}))
vi.mock('@/components/studio/LevelSelect', () => ({default: () => <select aria-label="level" />}))
vi.mock('@/components/publication/PublicationStatusBadge', () => ({default: () => <span />}))

import DigitalPublicationEditor from './DigitalPublicationEditor'

describe('DigitalPublicationEditor delete', () => {
    it('does not delete on the first click', async () => {
        deleteDigitalPublication.mockResolvedValue(undefined)
        const user = userEvent.setup()
        renderWithLocale(<DigitalPublicationEditor publicationId={5} />)

        await user.click(await screen.findByRole('button', {name: 'Löschen'}))

        // The destructive call is behind the shared ConfirmDialog, whose own suite
        // covers the confirmation; this pins the no-one-click-delete guarantee.
        expect(deleteDigitalPublication).not.toHaveBeenCalled()
    })
})
