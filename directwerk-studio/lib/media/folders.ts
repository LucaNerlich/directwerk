'use client'

import type {MediaAsset, MediaFolder} from '@directwerk/api/types'

export const MAX_FOLDER_NAME_LENGTH = 255

/** Maximum nesting depth enforced by the API. Root-level folders are depth 1. */
export const MAX_FOLDER_DEPTH = 8

export interface FolderNode {
    folder: MediaFolder
    children: FolderNode[]
    depth: number
}

export function folderParentId(folder: MediaFolder): number | null {
    return folder.parentId ?? null
}

export function assetFolderId(asset: MediaAsset): number | null {
    return asset.folderId ?? null
}

export function isValidFolderName(name: string): boolean {
    const trimmed = name.trim()
    return trimmed.length > 0 && trimmed.length <= MAX_FOLDER_NAME_LENGTH
}

/**
 * Builds the folder tree (roots sorted by name, children sorted by name).
 * Orphaned rows (parent missing from the list) are treated as roots so a
 * single inconsistent row cannot hide a whole subtree.
 */
export function buildFolderTree(folders: MediaFolder[]): FolderNode[] {
    const byId = new Map<number, MediaFolder>()
    for (const folder of folders) {
        byId.set(folder.id, folder)
    }
    const childrenByParent = new Map<number | null, MediaFolder[]>()
    for (const folder of folders) {
        const parentId = folderParentId(folder)
        const key = parentId !== null && byId.has(parentId) ? parentId : null
        const siblings = childrenByParent.get(key) ?? []
        siblings.push(folder)
        childrenByParent.set(key, siblings)
    }
    for (const siblings of childrenByParent.values()) {
        siblings.sort((left, right) =>
            left.name.localeCompare(right.name, 'de') !== 0
                ? left.name.localeCompare(right.name, 'de')
                : left.id - right.id,
        )
    }

    function toNode(folder: MediaFolder, depth: number): FolderNode {
        return {
            folder,
            depth,
            children: (childrenByParent.get(folder.id) ?? []).map((child) =>
                toNode(child, depth + 1),
            ),
        }
    }

    return (childrenByParent.get(null) ?? []).map((folder) => toNode(folder, 1))
}

/** Flattens the tree depth-first for picker options. */
export function flattenFolderTree(nodes: FolderNode[]): FolderNode[] {
    const flat: FolderNode[] = []
    for (const node of nodes) {
        flat.push(node)
        flat.push(...flattenFolderTree(node.children))
    }
    return flat
}

/** Breadcrumb chain from the library root to the folder (inclusive). Empty for root. */
export function folderPath(folders: MediaFolder[], folderId: number | null): MediaFolder[] {
    if (folderId === null) {
        return []
    }
    const byId = new Map(folders.map((folder) => [folder.id, folder]))
    const path: MediaFolder[] = []
    const seen = new Set<number>()
    let current = byId.get(folderId) ?? null
    while (current !== null && !seen.has(current.id)) {
        seen.add(current.id)
        path.unshift(current)
        const parentId = folderParentId(current)
        current = parentId !== null ? (byId.get(parentId) ?? null) : null
    }
    return path
}

/** Depth of a folder (root-level = 1, library root = 0). Unknown ids count as root. */
export function folderDepth(folders: MediaFolder[], folderId: number | null): number {
    return folderPath(folders, folderId).length
}

/** All descendant ids of a folder (excludes the folder itself). */
export function descendantFolderIds(folders: MediaFolder[], folderId: number): number[] {
    const childrenByParent = new Map<number, number[]>()
    for (const folder of folders) {
        const parentId = folderParentId(folder)
        if (parentId !== null) {
            const siblings = childrenByParent.get(parentId) ?? []
            siblings.push(folder.id)
            childrenByParent.set(parentId, siblings)
        }
    }
    const result: number[] = []
    const visited = new Set<number>([folderId])
    const queue = [...(childrenByParent.get(folderId) ?? [])]
    while (queue.length > 0) {
        const current = queue.shift() as number
        if (visited.has(current)) {
            continue
        }
        visited.add(current)
        result.push(current)
        queue.push(...(childrenByParent.get(current) ?? []))
    }
    return result
}

/**
 * Client-side duplicate check (the API validates authoritatively and answers
 * 409 MEDIA_FOLDER_NAME_EXISTS). Comparison is exact and case-sensitive,
 * matching the database unique indexes.
 */
export function siblingNameTaken(
    folders: MediaFolder[],
    parentId: number | null,
    name: string,
    excludeId?: number,
): boolean {
    const trimmed = name.trim()
    return folders.some(
        (folder) =>
            folder.id !== excludeId &&
            folderParentId(folder) === parentId &&
            folder.name === trimmed,
    )
}

/** Assets directly inside a folder (null = library root). */
export function assetsInFolder(assets: MediaAsset[], folderId: number | null): MediaAsset[] {
    return assets.filter((asset) => assetFolderId(asset) === folderId)
}

/** Direct subfolders of a folder (null = root-level folders). */
export function childFolders(folders: MediaFolder[], folderId: number | null): MediaFolder[] {
    return folders
        .filter((folder) => folderParentId(folder) === folderId)
        .sort((left, right) =>
            left.name.localeCompare(right.name, 'de') !== 0
                ? left.name.localeCompare(right.name, 'de')
                : left.id - right.id,
        )
}

/**
 * Maps folder API failures to German UI messages. The API is English-first for
 * integrators, so known failure modes are recognized by their stable message
 * fragments; unknown errors surface verbatim.
 */
export function folderErrorMessage(error: unknown): string {
    const message = error instanceof Error ? error.message : 'Aktion fehlgeschlagen.'
    if (message.includes('already exists in this location')) {
        return 'An diesem Ort gibt es bereits einen Ordner mit diesem Namen.'
    }
    if (message.includes('maximum folder depth')) {
        return 'Die maximale Ordnertiefe (8 Ebenen) ist erreicht.'
    }
    if (message.includes('would create a cycle')) {
        return 'Dieser Ablageort würde einen Kreis erzeugen.'
    }
    if (message.includes('own parent')) {
        return 'Ein Ordner kann nicht in sich selbst verschoben werden.'
    }
    if (message.includes('Folder name is required')) {
        return 'Bitte einen Ordnernamen eingeben.'
    }
    if (message.includes('at most 255 characters')) {
        return 'Der Ordnername darf höchstens 255 Zeichen lang sein.'
    }
    return message
}
