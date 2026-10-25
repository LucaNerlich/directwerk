import {getPlatformData} from '@/lib/api/client'
import type {DirectoryListPage, TenantUser} from '@directwerk/api/types'

const PAGE_SIZE = 100

/**
 * Walks every page of the platform tenant-user directory so the detail view is
 * not hard-capped at the first 100 members (#561 review).
 */
export async function listAllPlatformTenantUsers(
    tenantId: string,
): Promise<DirectoryListPage<TenantUser>> {
    const content: TenantUser[] = []
    let page = 0
    let totalElements = 0

    for (;;) {
        const result = await getPlatformData<DirectoryListPage<TenantUser>>(
            `tenants/${tenantId}/users?page=${page}&size=${PAGE_SIZE}`,
        )
        totalElements = result.totalElements
        content.push(...result.content)
        const loadedThrough = (page + 1) * result.size
        if (result.content.length === 0 || loadedThrough >= totalElements) {
            break
        }
        page += 1
    }

    return {
        content,
        totalElements,
        page: 0,
        size: content.length,
    }
}
