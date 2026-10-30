'use client'

import LocaleLink from '@/components/i18n/LocaleLink'
import {useDictionary} from '@/components/i18n/LocaleProvider'
import type {SetupStep} from '@/lib/studio/setupStep'

import {Badge} from '@directwerk/ui/components/badge'
import {Button} from '@directwerk/ui/components/button'
import SectionHeader from '@directwerk/ui/components/section-header'

export default function SetupChecklist({
    id,
    title,
    description,
    steps,
    activatePrimary,
    collapsedSummary,
    onExpand,
    collapsed = false,
    actions,
}: {
    id: string
    title: string
    description: string
    steps: SetupStep[]
    activatePrimary: boolean
    collapsed?: boolean
    collapsedSummary?: string
    onExpand?: () => void
    actions?: React.ReactNode
}): React.JSX.Element {
    const dict = useDictionary()
    const doneCount = steps.filter((step) => step.done).length

    if (collapsed && collapsedSummary !== undefined) {
        return (
            <section
                aria-labelledby={id}
                className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
                data-dw-surface="panel"
            >
                <div className="min-w-0">
                    <p className="font-medium" id={id}>
                        {collapsedSummary}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {dict.shell.home.setup.progressLabel
                            .replace('{done}', String(doneCount))
                            .replace('{total}', String(steps.length))}
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    {actions}
                    {onExpand !== undefined ? (
                        <Button onClick={onExpand} size="sm" type="button" variant="outline">
                            {dict.shell.home.setup.showSteps}
                        </Button>
                    ) : null}
                </div>
            </section>
        )
    }

    return (
        <section aria-labelledby={id} className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <SectionHeader description={description} id={id} title={title} />
                {actions}
            </div>
            <ol className="grid gap-3">
                {steps.map((step) => {
                    const buttonVariant =
                        step.primary === true && activatePrimary
                            ? 'default'
                            : step.done
                              ? 'outline'
                              : 'secondary'
                    const action =
                        step.external === true ? (
                            <Button
                                nativeButton={false}
                                render={
                                    <a href={step.href} rel="noopener noreferrer" target="_blank" />
                                }
                                size="sm"
                                variant={buttonVariant}
                            >
                                {step.actionLabel}
                            </Button>
                        ) : (
                            <Button
                                nativeButton={false}
                                render={<LocaleLink href={step.href} />}
                                size="sm"
                                variant={buttonVariant}
                            >
                                {step.actionLabel}
                            </Button>
                        )

                    return (
                        <li
                            key={step.id}
                            className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
                            data-dw-surface="panel"
                        >
                            <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                    <p className="font-medium">{step.title}</p>
                                    <Badge variant={step.done ? 'secondary' : 'outline'}>
                                        {step.done ? dict.common.done : dict.common.openStep}
                                    </Badge>
                                </div>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    {step.description}
                                </p>
                            </div>
                            {action}
                        </li>
                    )
                })}
            </ol>
        </section>
    )
}
