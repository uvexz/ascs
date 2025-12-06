import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, MessageSquare, Shield, Zap, Github, Code2, Lock } from "lucide-react";
import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Navbar */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-xl tracking-tight">
            <div className="bg-primary text-primary-foreground p-1.5 rounded-lg">
              <MessageSquare className="h-5 w-5" />
            </div>
            <span>ASCS</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
            <Link href="#features" className="hover:text-foreground transition-colors">Features</Link>
            <Link href="#docs" className="hover:text-foreground transition-colors">Documentation</Link>
            <Link href="https://github.com" target="_blank" className="hover:text-foreground transition-colors">GitHub</Link>
          </nav>
          <div className="flex items-center gap-4">
            <Link href="/admin/login">
              <Button variant="ghost" size="sm" className="hidden sm:flex">
                Log in
              </Button>
            </Link>
            <Link href="/admin/login">
              <Button size="sm">Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-24 sm:py-32 lg:py-40">
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:14px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]"></div>
        <div className="container mx-auto px-4 text-center">
          <Badge variant="secondary" className="mb-6 px-3 py-1 text-sm font-normal rounded-full border-primary/20 bg-primary/5 text-primary">
            v1.1.0 is now available
          </Badge>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl mb-6 bg-gradient-to-b from-foreground to-muted-foreground bg-clip-text text-transparent pb-2">
            A Simple Comment System <br className="hidden sm:block" />
            for Modern Blogs
          </h1>
          <p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
            Lightweight, privacy-focused, and easy to deploy.
            Built with Next.js and Tailwind CSS for optimal performance.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/admin/login">
              <Button size="lg" className="px-8 h-12 text-base shadow-lg shadow-primary/20">
                Start for Free <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Button variant="outline" size="lg" className="px-8 h-12 text-base">
              <Github className="mr-2 h-4 w-4" /> View on GitHub
            </Button>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight mb-4">Why Choose ASCS?</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Designed to be the commenting engine you've always wanted. No bloat, just essential features.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="bg-background border-none shadow-sm ring-1 ring-border/50 hover:ring-primary/20 transition-all duration-300">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center mb-4 text-blue-500">
                  <Zap className="h-6 w-6" />
                </div>
                <CardTitle>Lightning Fast</CardTitle>
                <CardDescription>
                  Optimized for speed. Zero layout shift and minimal bundle size ensure your page loads instantly.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="bg-background border-none shadow-sm ring-1 ring-border/50 hover:ring-primary/20 transition-all duration-300">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-green-500/10 flex items-center justify-center mb-4 text-green-500">
                  <Shield className="h-6 w-6" />
                </div>
                <CardTitle>Privacy First</CardTitle>
                <CardDescription>
                  No tracking, no ads. Your users' data stays yours. Compliant with GDPR and modern privacy standards.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="bg-background border-none shadow-sm ring-1 ring-border/50 hover:ring-primary/20 transition-all duration-300">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-purple-500/10 flex items-center justify-center mb-4 text-purple-500">
                  <Code2 className="h-6 w-6" />
                </div>
                <CardTitle>Developer Friendly</CardTitle>
                <CardDescription>
                  Open source and easy to customize. Built with TypeScript and Prisma for a great developer experience.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t mt-auto">
        <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className="h-6 w-6 rounded-md bg-muted flex items-center justify-center">
              <MessageSquare className="h-3 w-3" />
            </div>
            <span className="text-sm">© 2025 ASCS. Open Source.</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="#" className="hover:text-foreground">Privacy</Link>
            <Link href="#" className="hover:text-foreground">Terms</Link>
            <Link href="#" className="hover:text-foreground">Twitter</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}