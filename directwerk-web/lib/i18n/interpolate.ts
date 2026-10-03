/**
 * Replaces `{name}` placeholders. Unknown placeholders are left unchanged.
 */
export function interpolate(
    template: string,
    vars: Record<string, string | number> = {},
): string {
    return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key: string) => {
        const value = vars[key]
        return value === undefined ? match : String(value)
    })
}
