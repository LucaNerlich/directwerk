import {API_CONTRACT_ERROR} from './constants'

export {envelopeResult} from './envelope/envelopeResult'

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Unwraps `{data: ...}` API envelopes; throws `API_CONTRACT_ERROR` when malformed. */
export function parseApiEnvelope<T>(
    value: unknown,
    validator?: (data: unknown) => data is T,
): T {
    if (
        !isRecord(value) ||
        !Object.hasOwn(value, 'data') ||
        value.data === undefined ||
        value.data === null
    ) {
        throw new Error(API_CONTRACT_ERROR)
    }

    const data = value.data

    if (validator && !validator(data)) {
        throw new Error(API_CONTRACT_ERROR)
    }

    return data as T
}

function parseMetadataNumber(metadata: unknown, key: string): number | null {
    if (!isRecord(metadata)) {
        return null
    }

    const value = metadata[key]
    return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
        ? value
        : null
}

export interface PaginatedPage<T> {
    items: T[]
    total: number
    offset: number
    limit: number
}

/** Unwraps paginated `{data: [...], metadata: {total, offset, limit}}` envelopes. */
export function parsePaginatedApiEnvelope<T>(
    value: unknown,
    itemValidator?: (item: unknown) => item is T,
): PaginatedPage<T> {
    if (
        !isRecord(value) ||
        !Object.hasOwn(value, 'data') ||
        !Array.isArray(value.data)
    ) {
        throw new Error(API_CONTRACT_ERROR)
    }

    const envelope = value as {data: unknown[]; metadata?: unknown}
    const items = envelope.data

    if (itemValidator && items.some((item) => !itemValidator(item))) {
        throw new Error(API_CONTRACT_ERROR)
    }

    const total = parseMetadataNumber(envelope.metadata, 'total')
    const offset = parseMetadataNumber(envelope.metadata, 'offset')
    const limit = parseMetadataNumber(envelope.metadata, 'limit')

    if (total === null || offset === null || limit === null || limit < 1) {
        throw new Error(API_CONTRACT_ERROR)
    }

    return {items: items as T[], total, offset, limit}
}

// ---------------------------------------------------------------------------
// Structured error extraction
// ---------------------------------------------------------------------------

/**
 * User-facing message catalog for failed API responses. Each app supplies its
 * own catalog to keep its exact localized strings.
 */
export interface ErrorMessageCatalog {
    /** Overrides the OAuth protocol code `invalid_grant` (failed login). */
    invalidGrant?: string
    /** Used when no structured message exists and the status is 401. */
    unauthorized?: string
    /** Fallback for any status without a structured message. */
    fallback: (status: number) => string
}

/**
 * Extracts a user-facing message from a structured API error body.
 *
 * Recognizes `{error: string}` (bounded to 255 chars) and
 * `{errors: [{message: string}]}` shapes; everything else falls back to the
 * catalog.
 */
export function extractApiErrorMessage(
    value: unknown,
    status: number,
    catalog: ErrorMessageCatalog,
): string {
    if (
        isRecord(value) &&
        'error' in value &&
        typeof value.error === 'string'
    ) {
        // The OAuth token endpoint reports failed logins as 400 with an
        // `error` code (typically "invalid_grant").
        if (catalog.invalidGrant !== undefined && value.error === 'invalid_grant') {
            return catalog.invalidGrant
        }
        if (value.error.length > 0 && value.error.length <= 255) {
            return value.error
        }
    }

    if (
        isRecord(value) &&
        'errors' in value &&
        Array.isArray(value.errors) &&
        value.errors.length > 0
    ) {
        const first = value.errors[0]
        if (
            typeof first === 'object' &&
            first !== null &&
            'message' in first &&
            typeof first.message === 'string' &&
            first.message.length > 0 &&
            first.message.length <= 255
        ) {
            return first.message
        }
    }

    if (status === 401 && catalog.unauthorized !== undefined) {
        return catalog.unauthorized
    }

    return catalog.fallback(status)
}
