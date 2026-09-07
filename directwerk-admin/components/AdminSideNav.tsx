'use client'

import Link from 'next/link'
import {usePathname} from 'next/navigation'

import {
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuItem,
} from '@directwerk/ui/components/sidebar'

import type {NavigationItem} from '@directwerk/ui/lib/navigation'
import {cn} from '@directwerk/ui/lib/utils'

const NAV_ITEMS: readonly NavigationItem[] = [
    {href: '/', label: 'Overview'},
    {href: '/tenants', label: 'Tenants'},
    {href: '/admins', label: 'Platform admins'},
    {href: '/audit', label: 'Audit log'},
    {href: '/jobs', label: 'Jobs'},
] as const

/**
 * Determines whether a navigation link matches the current pathname.
 *
 * @param pathname - The current URL pathname
 * @param href - The navigation link path
 * @returns `true` if the path is active, `false` otherwise
 */
function isActivePath(pathname: string, href: string): boolean {
    if (href === '/') {
        return pathname === '/'
    }
    return pathname === href || pathname.startsWith(`${href}/`)
}

/**
 * Builds the styling classes for an admin navigation link.
 *
 * @param active - Whether the link represents the current page
 * @returns The combined navigation link class names
 */
function linkClassName(active: boolean): string {
    return cn(
        'flex h-8 w-full items-center rounded-md px-2 text-sm outline-none transition-colors',
        'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
        'focus-visible:ring-2 focus-visible:ring-sidebar-ring',
        active && 'bg-sidebar-accent font-medium text-sidebar-accent-foreground',
    )
}

/**
 * Renders the platform administration navigation.
 *
 * @returns The navigation region containing platform administration links.
 */
export default function AdminSideNav(): React.JSX.Element {
    const pathname = usePathname()

    return (
        <nav aria-label="Main navigation">
            <SidebarGroup>
                <SidebarGroupLabel>Platform</SidebarGroupLabel>
                <SidebarGroupContent>
                    <SidebarMenu>
                        {NAV_ITEMS.map((item) => {
                            const isActive = isActivePath(pathname, item.href)
                            return (
                                <SidebarMenuItem key={item.href}>
                                    <Link
                                        aria-current={isActive ? 'page' : undefined}
                                        className={linkClassName(isActive)}
                                        href={item.href}
                                    >
                                        {item.label}
                                    </Link>
                                </SidebarMenuItem>
                            )
                        })}
                    </SidebarMenu>
                </SidebarGroupContent>
            </SidebarGroup>
        </nav>
    )
}
