export interface InvitePlatformAdminState {
    error: string | null
    success: string | null
    inviteToken: string | null
}

export const INITIAL_INVITE_PLATFORM_ADMIN_STATE: InvitePlatformAdminState = {
    error: null,
    success: null,
    inviteToken: null,
}
