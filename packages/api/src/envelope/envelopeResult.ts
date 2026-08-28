import type {ApiEnvelope} from '../types'

export function envelopeResult<T>(
    parser: (value: unknown) => ApiEnvelope<T> | null,
    value: unknown,
    invalidMessage: string,
): ApiEnvelope<T> {
    const parsed = parser(value)
    if (parsed === null) {
        throw new Error(invalidMessage)
    }

    return parsed
}
