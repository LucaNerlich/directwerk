import 'server-only'

/**
 * Optional observability for the streaming media-upload pipeline. All output is
 * gated on `DIRECTWERK_UPLOAD_DEBUG=1` so production logs stay quiet by default;
 * when enabled, each progress/settle point of the browser -> BFF -> object-storage
 * chain reports its byte counts. Without these lines a cloud-only upload stall is
 * invisible: the browser leg reports nothing to any runtime log, and the storage
 * leg's watchdogs only surface as the final response status.
 *
 * Never log presigned URLs (they carry signing secrets, repo security rule 9);
 * only hostnames and byte counts are reported.
 */
const UPLOAD_DEBUG_ENV = 'DIRECTWERK_UPLOAD_DEBUG'
/** Progress log cadence: one line per this many streamed bytes. */
const UPLOAD_DEBUG_PROGRESS_BYTES = 32 * 1024 * 1024

export function uploadDebugEnabled(): boolean {
    return process.env[UPLOAD_DEBUG_ENV] === '1'
}

export function logUploadDebug(message: string): void {
    console.info(`[media-upload] ${message}`)
}

/** Hostname of a presigned/log-safe target for debug lines, `<unparsable>` if not a URL. */
export function uploadDebugHost(uploadUrl: string): string {
    try {
        return new URL(uploadUrl).host
    } catch {
        return '<unparsable>'
    }
}

export const UPLOAD_PROGRESS_LOG_BYTES = UPLOAD_DEBUG_PROGRESS_BYTES
