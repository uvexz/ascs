'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { MessageSquare, Book, Code, Settings } from 'lucide-react'

export function Navigation() {
  const pathname = usePathname()

  const navItems = [
    { href: '/', label: '首页', icon: MessageSquare },
    { href: '/docs', label: '配置教程', icon: Book },
    { href: '/demo', label: '示例', icon: Code },
    { href: '/admin', label: '管理', icon: Settings },
  ]

  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/" className="flex items-center space-x-2">
              <MessageSquare className="h-6 w-6" />
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