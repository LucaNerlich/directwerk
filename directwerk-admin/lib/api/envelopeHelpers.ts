import type {ApiEnvelope} from '@directwerk/api/types'

export function envelopeData<T>(
    parser: (value: unknown) => ApiEnvelope<T> | null,
    value: unknown,
    invalidMessage: string,
): T {
    const parsed = parser(value)
    if (parsed === null) {
        throw new Error(invalidMessage)
    }

    return parsed.data
}
