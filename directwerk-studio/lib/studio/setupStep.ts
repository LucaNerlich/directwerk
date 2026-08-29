export interface SetupStep {
    id: string
    title: string
    description: string
    done: boolean
    href: string
    actionLabel: string
    primary?: boolean
}
