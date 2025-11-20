import type { Metadata } from "next";
import "../globals.css";

export const metadata: Metadata = {
  title: "ASCS 评论系统",
  description: "轻量级评论系统",
};

export default function EmbedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <head>
        <link
          rel="preconnect"
          href="https://use.sevencdn.com"
          crossOrigin="anonymous"
        />
        <link
          rel="dns-prefetch"
          href="https://use.sevencdn.com"
        />
      </head>
      <body className="antialiased bg-transparent">
        {children}
      </body>
    </html>
  );
}
