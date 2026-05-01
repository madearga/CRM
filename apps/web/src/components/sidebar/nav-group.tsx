'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ChevronRight, type LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@/components/ui/sidebar'
import { type NavItem } from '@/lib/navigation'

export interface NavGroupProps {
  label: string
  icon?: LucideIcon
  items: NavItem[]
  defaultOpen?: boolean
}

export function NavGroup({ label, icon: Icon, items, defaultOpen = false }: NavGroupProps) {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(defaultOpen)

  useEffect(() => {
    const matches = items.some((item) =>
      item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
    )
    if (matches) {
      setIsOpen(true)
    }
  }, [pathname, items])

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <SidebarGroup>
        <CollapsibleTrigger asChild>
          <SidebarGroupLabel className="cursor-pointer">
            {Icon && <Icon className="h-4 w-4" />}
            <span>{label}</span>
            <ChevronRight
              className={cn(
                'ml-auto h-4 w-4 transition-transform duration-200',
                isOpen && 'rotate-90'
              )}
            />
          </SidebarGroupLabel>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {items.map((item) => {
              const isActive =
                item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)

              return (
                <SidebarMenuSubItem key={item.href}>
                  <SidebarMenuSubButton asChild isActive={isActive}>
                    <Link href={item.href}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              )
            })}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  )
}
