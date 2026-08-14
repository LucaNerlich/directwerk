import type {ReactNode} from 'react'

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '#components/card'

export default function AuthCard({
    title,
    description,
    children,
    footer,
}: {
    title: string
    description?: string
    children: ReactNode
    footer?: ReactNode
}): React.JSX.Element {
    return (
        <main className="grid min-h-[calc(100vh-5rem)] place-items-center px-4 py-12">
            <Card className="w-full max-w-md shadow-lg shadow-foreground/5">
                <CardHeader>
                    <CardTitle className="text-2xl">{title}</CardTitle>
                    {description !== undefined ? (
                        <CardDescription>{description}</CardDescription>
                    ) : null}
                </CardHeader>
                <CardContent className="space-y-5">
                    {children}
                    {footer !== undefined ? (
                        <div className="border-t pt-4 text-sm text-muted-foreground">
                            {footer}
                        </div>
                    ) : null}
                </CardContent>
            </Card>
        </main>
    )
}
