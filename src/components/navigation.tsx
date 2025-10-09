'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { MessageSquare, Settings } from 'lucide-react'

export function Navigation() {
  const pathname = usePathname()

  const navItems = [
    { href: '/', label: '首页', icon: MessageSquare },
    { href: '/admin', label: '管理', icon: Settings },
  ]

  return (
    <nav className="border-b border-gray-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/" className="flex items-center space-x-2 text-gray-900">
              <MessageSquare className="h-6 w-6 text-blue-600" />
              <span className="font-bold text-xl">ASCS</span>
            </Link>
          </div>
          
          <div className="flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href || 
                (item.href === '/admin' && pathname.startsWith('/admin'))
              
              return (
                <Button
                  key={item.href}
                  variant={isActive ? 'default' : 'ghost'}
                  size="sm"
                  asChild
                >
                  <Link href={item.href} className="flex items-center space-x-2">
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                </Button>
              )
            })}
          </div>
        </div>
      </div>
    </nav>
  )
}