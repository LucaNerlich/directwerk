import type de from '../../dictionaries/de.json'

export type Dictionary = typeof de

/** Replace `${name}` or `{name}` placeholders in a dictionary string. */
export function t(
    template: string,
    vars?: Record<string, string | number | null | undefined>,
): string {
    if (vars === undefined) {
        return template
    }
    return template
        .replace(/\$\{(\w+(?:\.\w+)*)\}/g, (_, key: string) => {
            const value = vars[key]
            return value === null || value === undefined ? '' : String(value)
        })
        .replace(/\{(\w+)\}/g, (_, key: string) => {
            const value = vars[key]
            return value === null || value === undefined ? '' : String(value)
        })
}
