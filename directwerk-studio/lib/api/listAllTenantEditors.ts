import {listTenantUsers} from '@/lib/api/tenantSettingsApi'
import type {TenantUser} from '@directwerk/api/types'

const EDITOR_PAGE_SIZE = 100

/**
 * Walks the paged tenant-user directory and returns every non-disabled EDITOR.
 * The editor-rights picker must not stop at the first page (#561 review).
 */
export async function listAllTenantEditors(): Promise<TenantUser[]> {
    const editors: TenantUser[] = []
    let page = 0

    for (;;) {
        const editorPage = await listTenantUsers({page, size: EDITOR_PAGE_SIZE})
        for (const user of editorPage.content) {
            if (user.roles.includes('EDITOR') && user.status !== 'DISABLED') {
                editors.push(user)
            }
        }
        const loadedThrough = (page + 1) * editorPage.size
        if (
            editorPage.content.length === 0
            || loadedThrough >= editorPage.totalElements
        ) {
            break
        }
        page += 1
    }

    return editors
}
