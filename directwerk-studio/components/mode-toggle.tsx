'use client'

import {MoonIcon, SunIcon} from 'lucide-react'

import {Button} from '@directwerk/ui/components/button'
import {cn} from '@directwerk/ui/lib/utils'

import {useDictionary} from '@/components/i18n/LocaleProvider'
import {useTheme} from '@/components/theme-provider'

/**
 * Light/dark toggle for the studio chrome. Icons swap via `.dark` CSS so the
 * correct glyph shows even before the theme context hydrates.
 */
export default function ModeToggle({
    className,
}: {
    className?: string
}): React.JSX.Element {
    const dict = useDictionary()
    const {resolvedTheme, setTheme} = useTheme()
    const isDark = resolvedTheme === 'dark'
    const label = isDark ? dict.shell.themeToLight : dict.shell.themeToDark

    return (
        <Button
            type="button"
            className={cn('relative min-w-0 flex-1', className)}
            size="icon-sm"
            title={label}
            variant="outline"
            aria-label={label}
            onClick={() => {
                setTheme(isDark ? 'light' : 'dark')
            }}
        >
            <SunIcon className="scale-100 rotate-0 transition-transform dark:scale-0 dark:-rotate-90" />
            <MoonIcon className="absolute scale-0 rotate-90 transition-transform dark:scale-100 dark:rotate-0" />
        </Button>
    )
}
