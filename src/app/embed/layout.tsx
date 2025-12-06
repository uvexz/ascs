import type { Metadata } from "next";

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
    <div className="bg-transparent">
      {children}
    </div>
  );
}
