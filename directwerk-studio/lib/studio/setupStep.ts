export interface SetupStep {
    id: string
    title: string
    description: string
    done: boolean
    href: string
    actionLabel: string
    primary?: boolean
    /** Absolute URL opened in a new tab (e.g. public site). */
    external?: boolean
}
