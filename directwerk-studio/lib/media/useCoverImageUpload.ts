'use client'

import {useCallback, useEffect, useRef, useState} from 'react'

import {getClientTenantHost} from '@directwerk/api/tenant'

import {getMediaUploadLimits} from '@/lib/api/mediaApi'
import {resolveMediaLimits, type ResolvedMediaLimits} from '@/lib/media/limits'
import {uploadMediaFile} from '@/lib/media/upload'

/**
 * Provides state and controls for uploading a cover image.
 *
 * @param onUploaded - Called with the uploaded asset ID when the upload succeeds
 * @param onError - Called with the upload error when the upload fails
 * @returns Upload state and a function for starting an upload
 */
export function useCoverImageUpload({
    onUploaded,
    onError,
}: {
    onUploaded: (assetId: number) => void
    onError: (error: unknown) => void
}) {
    const mountedRef = useRef(true)
    // Tenant-specific limits, not the global defaults (#1063).
    const [limits, setLimits] = useState<ResolvedMediaLimits>(() =>
        resolveMediaLimits(null)
    )

    useEffect(() => {
        let active = true
        void getMediaUploadLimits()
            .then((remote) => {
                if (active) {
                    setLimits(resolveMediaLimits(remote))
                }
            })
            .catch(() => {
                // Keep the defaults; the server still enforces its own caps.
            })
        return () => {
            active = false
        }
    }, [])
    const [isUploading, setIsUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState<{file: File; progress: number} | null>(
        null,
    )

    useEffect(() => {
        mountedRef.current = true
        return () => {
            mountedRef.current = false
        }
    }, [])

    const upload = useCallback(
        async (file: File | null): Promise<void> => {
            if (file === null) {
                return
            }
            setIsUploading(true)
            setUploadProgress({file, progress: 0})
            try {
                const asset = await uploadMediaFile(getClientTenantHost(), file, {
                    assetType: 'IMAGE',
                    visibility: 'PUBLIC',
                    limits,
                    onProgress: (percent) => {
                        if (mountedRef.current) {
                            setUploadProgress({file, progress: percent})
                        }
                    },
                })
                onUploaded(asset.id)
            } catch (error) {
                onError(error)
            } finally {
                if (mountedRef.current) {
                    setIsUploading(false)
                    setUploadProgress(null)
                }
            }
        },
        [onError, onUploaded],
    )

    return {isUploading, uploadProgress, upload}
}
