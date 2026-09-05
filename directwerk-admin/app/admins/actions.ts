'use server'

import {callPlatformApi, statusToFormError} from '@/lib/server/platform'
import {validatePlatformAdminInviteInput} from '@/lib/validation'

import {
    INITIAL_INVITE_PLATFORM_ADMIN_STATE,
    type InvitePlatformAdminState,
} from '@/app/admins/actionState'

export async function invitePlatformAdminAction(
    _previousState: InvitePlatformAdminState,
    formData: FormData
): Promise<InvitePlatformAdminState> {
    const validation = validatePlatformAdminInviteInput({
        email: formData.get('email'),
        name: formData.get('name'),
    })

    if (!validation.success) {
        return {...INITIAL_INVITE_PLATFORM_ADMIN_STATE, error: validation.error}
    }

    const result = await callPlatformApi<{
        email: string
        inviteToken: string | null
    }>(['admins', 'invite'], {
        method: 'POST',
        body: validation.data,
    })

    if (!result.ok) {
        return {
            ...INITIAL_INVITE_PLATFORM_ADMIN_STATE,
            error: statusToFormError(result.status, {
                conflict: 'This user is already a platform admin.',
                fallback: 'Invitation failed. Check the details and try again.',
            }),
        }
    }

    return {
        error: null,
        success: `Invitation sent to ${result.data.email}.`,
        inviteToken:
            process.env.NODE_ENV === 'production'
                ? null
                : result.data.inviteToken,
    }
}
