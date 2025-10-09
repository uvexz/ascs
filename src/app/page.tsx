import { Button } from '@/components/ui/button'
import { MessageSquare, LogIn } from 'lucide-react'
import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center">
        <div className="flex items-center justify-center mb-8">
          <MessageSquare className="h-16 w-16 text-blue-600 mr-4" />
          <h1 className="text-6xl font-bold text-gray-900">ASCS</h1>
        </div>
        <p className="text-xl text-gray-600 mb-8">A Simple Comment System</p>
        
        <Button size="lg" asChild>
          <Link href="/admin/login">
            <LogIn className="h-5 w-5 mr-2" />
            登录管理
          </Link>
        </Button>
      </div>
    </div>
  )
}