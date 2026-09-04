/**
 * Strictly parses a non-negative ("0", "12") or positive ("1", "12") integer
 * from free-text input. Unlike `Number.parseInt`, trailing garbage ("12abc",
 * "3.5", "0x10") is rejected instead of silently truncated.
 */
export function parseOptionalInt(
    value: string,
    minimum: number,
): number | undefined {
    const trimmed = value.trim()
    if (trimmed.length === 0) {
        return undefined
    }
    if (!/^\d+$/.test(trimmed)) {
        return undefined
    }
    const parsed = Number.parseInt(trimmed, 10)
    if (!Number.isSafeInteger(parsed) || parsed < minimum) {
        return undefined
    }
    return parsed
}
