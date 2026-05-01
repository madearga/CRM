import {
  Activity,
  BarChart3,
  Building2,
  CalendarCheck,
  CalendarDays,
  ClipboardCheck,
  Clock,
  CreditCard,
  FileEdit,
  FileText,
  Handshake,
  Landmark,
  LayoutDashboard,
  LayoutTemplate,
  Package,
  RefreshCw,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Store,
  Users,
  UsersRound,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  title: string
  href: string
  icon: LucideIcon
}

export interface NavGroupConfig {
  id: string
  label: string
  icon?: LucideIcon
  defaultOpen?: boolean
  items: NavItem[]
}

export const navGroups: NavGroupConfig[] = [
  {
    id: 'crm',
    label: 'CRM',
    icon: LayoutDashboard,
    defaultOpen: true,
    items: [
      { title: 'Dashboard', href: '/', icon: LayoutDashboard },
      { title: 'Companies', href: '/companies', icon: Building2 },
      { title: 'Contacts', href: '/contacts', icon: Users },
      { title: 'Deals', href: '/deals', icon: Handshake },
      { title: 'Activities', href: '/activities', icon: Activity },
      { title: 'Products', href: '/products', icon: Package },
    ],
  },
  {
    id: 'finance',
    label: 'Finance',
    icon: Landmark,
    items: [
      { title: 'Sales', href: '/sales', icon: ShoppingCart },
      { title: 'Invoices', href: '/invoices', icon: FileText },
      { title: 'Payments', href: '/payments', icon: Landmark },
      { title: 'Subscriptions', href: '/subscriptions', icon: RefreshCw },
      { title: 'Templates', href: '/templates', icon: LayoutTemplate },
    ],
  },
  {
    id: 'hr',
    label: 'HR',
    icon: UsersRound,
    items: [
      { title: 'Dashboard', href: '/hr', icon: LayoutDashboard },
      { title: 'Branches', href: '/hr/branches', icon: Building2 },
      { title: 'Employees', href: '/hr/employees', icon: Users },
      { title: 'Shifts', href: '/hr/shifts', icon: Clock },
      { title: 'Assignments', href: '/hr/assignments', icon: CalendarCheck },
      { title: 'Attendance', href: '/hr/attendance', icon: ClipboardCheck },
      { title: 'Corrections', href: '/hr/corrections', icon: FileEdit },
      { title: 'Holidays', href: '/hr/holidays', icon: CalendarDays },
      { title: 'Reports', href: '/hr/reports', icon: BarChart3 },
    ],
  },
  {
    id: 'commerce',
    label: 'Commerce',
    icon: ShoppingBag,
    items: [
      { title: 'Products', href: '/products', icon: Package },
      { title: 'Orders', href: '/sales', icon: ShoppingCart },
      { title: 'Payments', href: '/payments', icon: CreditCard },
      { title: 'Settings', href: '/settings/shop', icon: Store },
    ],
  },
  {
    id: 'system',
    label: 'System',
    icon: Settings,
    defaultOpen: true,
    items: [
      { title: 'Settings', href: '/settings', icon: Settings },
    ],
  },
]

export const featureMap: Record<string, string> = {
  '/': 'dashboard',
  '/companies': 'companies',
  '/contacts': 'contacts',
  '/deals': 'deals',
  '/products': 'products',
  '/sales': 'sales',
  '/invoices': 'invoices',
  '/payments': 'payments',
  '/subscriptions': 'subscriptions',
  '/templates': 'templates',
  '/activities': 'activities',
  '/hr': 'hr_employees',
  '/hr/employees': 'hr_employees',
  '/hr/branches': 'hr_branches',
  '/hr/shifts': 'hr_shifts',
  '/hr/assignments': 'hr_shifts',
  '/hr/attendance': 'hr_attendance',
  '/hr/corrections': 'hr_attendance',
  '/hr/holidays': 'hr_holidays',
  '/hr/reports': 'hr_reports',
  '/settings/shop': 'settings',
  '/settings': 'settings',
}

// Pre-sort once at module init for O(1) title lookup
const allItems = navGroups.flatMap((g) => g.items)
const sortedItems = [...allItems].sort((a, b) => b.href.length - a.href.length)

export function getPageTitle(pathname: string, pluginItems?: NavItem[]): string {
  const items = pluginItems ? [...sortedItems, ...pluginItems] : sortedItems
  const match = items.find((item) =>
    item.href === '/' ? pathname === '/' : pathname.startsWith(item.href),
  )
  return match?.title ?? 'Dashboard'
}
