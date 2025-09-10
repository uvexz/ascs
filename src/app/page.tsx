import { Navigation } from '@/components/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { MessageSquare, Zap, Shield, Smartphone, Globe, Code, Palette, Rocket, Book } from 'lucide-react'
import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto text-center">
          <div className="flex items-center justify-center mb-6">
            <MessageSquare className="h-12 w-12 text-primary mr-4" />
            <h1 className="text-5xl font-bold">ASCS</h1>
          </div>
          <p className="text-xl text-muted-foreground mb-2">A Simple Comment System</p>
          <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
            基于 Next.js 和 shadcn/ui 构建的现代化、轻量且易于部署的博客评论系统
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Button size="lg" asChild>
              <Link href="/docs">
                <Book className="h-5 w-5 mr-2" />
                快速开始
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/demo">
                <Code className="h-5 w-5 mr-2" />
                查看示例
              </Link>
            </Button>
          </div>

          <div className="flex flex-wrap justify-center gap-2 mb-8">
            <Badge variant="secondary">Next.js 15</Badge>
            <Badge variant="secondary">TypeScript</Badge>
            <Badge variant="secondary">shadcn/ui</Badge>
            <Badge variant="secondary">Tailwind CSS</Badge>
            <Badge variant="secondary">Prisma</Badge>
            <Badge variant="secondary">PostgreSQL</Badge>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-4 bg-muted/50">
        <div className="container mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">核心特性</h2>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader>
                <Zap className="h-8 w-8 text-primary mb-2" />
                <CardTitle className="text-lg">快速集成</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  只需一个脚本标签即可集成到任何网站，支持多种配置方式
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Palette className="h-8 w-8 text-primary mb-2" />
                <CardTitle className="text-lg">现代化设计</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  基于 shadcn/ui 构建，提供美观的用户界面和流畅的交互体验
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Smartphone className="h-8 w-8 text-primary mb-2" />
                <CardTitle className="text-lg">响应式设计</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  完美适配各种设备尺寸，在手机、平板、桌面端都有优秀体验
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Shield className="h-8 w-8 text-primary mb-2" />
                <CardTitle className="text-lg">安全可靠</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  内置管理后台，支持评论审核、垃圾评论过滤等安全功能
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Globe className="h-8 w-8 text-primary mb-2" />
                <CardTitle className="text-lg">多站点支持</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  一个部署支持多个网站，自动根据域名管理不同站点的评论
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <MessageSquare className="h-8 w-8 text-primary mb-2" />
                <CardTitle className="text-lg">多层级回复</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  支持评论回复功能，构建更好的讨论氛围和用户互动
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Rocket className="h-8 w-8 text-primary mb-2" />
                <CardTitle className="text-lg">通知系统</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  支持邮件和 Telegram 通知，及时了解新评论和用户互动
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Code className="h-8 w-8 text-primary mb-2" />
                <CardTitle className="text-lg">易于部署</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  支持 Vercel、Netlify 等平台一键部署，也可部署到自己的服务器
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Quick Start Section */}
      <section className="py-16 px-4">
        <div className="container mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">快速开始</h2>
          
          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-2 gap-8">
              <Card>
                <CardHeader>
                  <CardTitle>1. 部署评论系统</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    将 ASCS 部署到 Vercel 或其他平台
                  </p>
                  <div className="bg-muted p-3 rounded-md">
                    <code className="text-sm">
                      git clone https://github.com/your-repo/ascs<br/>
                      cd ascs<br/>
                      pnpm install<br/>
                      pnpm dev
                    </code>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>2. 嵌入到网站</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    在你的网站中添加以下代码
                  </p>
                  <div className="bg-muted p-3 rounded-md">
                    <code className="text-sm">
                      {'<div id="comments"></div>'}<br/>
                      {'<script src="https://your-domain.com/comments.js" defer></script>'}
                    </code>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="text-center mt-8">
              <Button size="lg" asChild>
                <Link href="/docs">
                  查看完整文档
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8 px-4">
        <div className="container mx-auto text-center">
          <p className="text-muted-foreground">
            Made with ❤️ using Next.js and shadcn/ui
          </p>
        </div>
      </footer>
    </div>
  )
}