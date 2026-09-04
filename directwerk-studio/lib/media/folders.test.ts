import {describe, expect, it} from 'vitest'

import {
    assetsInFolder,
    buildFolderTree,
    childFolders,
    descendantFolderIds,
    flattenFolderTree,
    folderDepth,
    folderPath,
    isValidFolderName,
    siblingNameTaken,
} from '@/lib/media/folders'
import type {MediaAsset, MediaFolder} from '@directwerk/api/types'

function folder(id: number, name: string, parentId: number | null): MediaFolder {
    return {
        id,
        name,
        parentId,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
    }
}

function asset(id: number, folderId: number | null | undefined): MediaAsset {
    return {
        id,
        s3Key: `t/private/audio/${id}.mp3`,
        visibility: 'PRIVATE',
        scope: 'CONTENT',
        assetType: 'AUDIO',
        status: 'READY',
        mimeType: 'audio/mpeg',
        sizeBytes: 100,
        originalFilename: `${id}.mp3`,
        episodeId: null,
        ownerUserId: null,
        folderId: folderId as number | null,
        cdnUrl: null,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
    }
}

const folders = [
    folder(1, 'B', null),
    folder(2, 'A', null),
    folder(3, 'Tief', 4),
    folder(4, 'Mitte', 2),
]

describe('media folders', () => {
    it('validates folder names like the API', () => {
        expect(isValidFolderName('Interviews')).toBe(true)
        expect(isValidFolderName('  x  ')).toBe(true)
        expect(isValidFolderName('   ')).toBe(false)
        expect(isValidFolderName('')).toBe(false)
        expect(isValidFolderName('x'.repeat(256))).toBe(false)
    })

    it('builds a sorted tree and flattens it depth-first', () => {
        const tree = buildFolderTree(folders)

        expect(tree.map((node) => node.folder.name)).toEqual(['A', 'B'])
        expect(tree[0].children.map((node) => node.folder.name)).toEqual(['Mitte'])
        expect(tree[0].children[0].children.map((node) => node.folder.name)).toEqual(['Tief'])
        expect(tree[0].depth).toBe(1)
        expect(tree[0].children[0].children[0].depth).toBe(3)
        expect(flattenFolderTree(tree).map((node) => node.folder.name)).toEqual([
            'A',
            'Mitte',
            'Tief',
            'B',
        ])
    })

    it('resolves breadcrumb paths and depths', () => {
        expect(folderPath(folders, null)).toEqual([])
        expect(folderPath(folders, 3).map((entry) => entry.name)).toEqual([
            'A',
            'Mitte',
            'Tief',
        ])
        expect(folderDepth(folders, null)).toBe(0)
        expect(folderDepth(folders, 2)).toBe(1)
        expect(folderDepth(folders, 3)).toBe(3)
    })

    it('collects descendants without the folder itself', () => {
        expect(descendantFolderIds(folders, 2).sort()).toEqual([3, 4])
        expect(descendantFolderIds(folders, 4)).toEqual([3])
        expect(descendantFolderIds(folders, 1)).toEqual([])
    })

    it('terminates descendant traversal when corrupt data contains a cycle', () => {
        const cyclic = [folder(1, 'One', 3), folder(2, 'Two', 1), folder(3, 'Three', 2)]

        expect(descendantFolderIds(cyclic, 1)).toEqual([2, 3])
    })

    it('detects duplicate sibling names exactly like the unique index', () => {
        expect(siblingNameTaken(folders, null, 'A')).toBe(true)
        expect(siblingNameTaken(folders, null, 'a')).toBe(false)
        expect(siblingNameTaken(folders, null, ' A ')).toBe(true)
        expect(siblingNameTaken(folders, 2, 'Mitte')).toBe(true)
        expect(siblingNameTaken(folders, 4, 'Mitte')).toBe(false)
        expect(siblingNameTaken(folders, null, 'A', 2)).toBe(false)
    })

    it('splits assets and folders by location, tolerating missing folder ids', () => {
        const assets = [asset(1, null), asset(2, 2), asset(3, undefined)]
        expect(assetsInFolder(assets, null).map((entry) => entry.id)).toEqual([1, 3])
        expect(assetsInFolder(assets, 2).map((entry) => entry.id)).toEqual([2])
        expect(childFolders(folders, null).map((entry) => entry.name)).toEqual(['A', 'B'])
        expect(childFolders(folders, 2).map((entry) => entry.name)).toEqual(['Mitte'])
    })
})
