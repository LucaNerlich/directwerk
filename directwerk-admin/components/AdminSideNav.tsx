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

const NAV_ITEMS: readonly NavigationItem[] = [
    {href: '/', label: 'Overview'},
    {href: '/tenants', label: 'Tenants'},
    {href: '/admins', label: 'Platform admins'},
    {href: '/audit', label: 'Audit log'},
    {href: '/jobs', label: 'Jobs'},
] as const

function isActivePath(pathname: string, href: string): boolean {
    if (href === '/') {
        return pathname === '/'
    }
    return pathname === href || pathname.startsWith(`${href}/`)
}

function linkClassName(active: boolean): string {
    return [
        'flex h-8 w-full items-center rounded-md px-2 text-sm outline-none transition-colors',
        'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
        'focus-visible:ring-2 focus-visible:ring-sidebar-ring',
        active
            ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
            : '',
    ]
        .filter((part) => part.length > 0)
        .join(' ')
}

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
