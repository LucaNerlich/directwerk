'use client'

import {Button} from '@directwerk/ui/components/button'
import {cn} from '@directwerk/ui/lib/utils'

import {useTheme} from '@/components/theme-provider'
import {useDictionary} from '@/lib/i18n/LocaleProvider'

function SunGlyph({className}: {className?: string}): React.JSX.Element {
    return (
        <svg
            aria-hidden
            className={className}
            fill="none"
            height="1em"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            width="1em"
        >
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
    )
}

function MoonGlyph({className}: {className?: string}): React.JSX.Element {
    return (
        <svg
            aria-hidden
            className={className}
            fill="none"
            height="1em"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            width="1em"
        >
            <path d="M21 14.5A8.5 8.5 0 1 1 9.5 3a7 7 0 0 0 11.5 11.5z" />
        </svg>
    )
}

/**
 * Light/dark toggle for the public-site chrome. Icons swap via `.dark` CSS so
 * the correct glyph shows even before the theme context hydrates.
 */
export default function ModeToggle({
    className,
}: {
    className?: string
}): React.JSX.Element {
    const dictionary = useDictionary()
    const {resolvedTheme, setTheme} = useTheme()
    const isDark = resolvedTheme === 'dark'
    const label = isDark ? dictionary.nav.themeToLight : dictionary.nav.themeToDark

    return (
        <Button
            type="button"
            className={cn('relative', className)}
            size="icon-sm"
            title={label}
            variant="ghost"
            aria-label={label}
            onClick={() => {
                setTheme(isDark ? 'light' : 'dark')
            }}
        >
            <SunGlyph className="size-4 scale-100 rotate-0 transition-transform dark:scale-0 dark:-rotate-90" />
            <MoonGlyph className="absolute size-4 scale-0 rotate-90 transition-transform dark:scale-100 dark:rotate-0" />
        </Button>
    )
}
