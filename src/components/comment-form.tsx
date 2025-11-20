"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Cookies from "js-cookie";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github.css";

// 声明全局 Cap 类型
declare global {
  interface Window {
    Cap: any;
  }
}

interface CommentFormProps {
  siteId: string;
  pageId: string;
  parentId?: string;
  onCommentAdded: () => void;
  onCancel?: () => void;
}

export function CommentForm({
  siteId,
  pageId,
  parentId,
  onCommentAdded,
  onCancel,
}: CommentFormProps) {
  const [author, setAuthor] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [submitMessageType, setSubmitMessageType] = useState<
    "success" | "error" | "warning"
  >("success");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaSolutions, setCaptchaSolutions] = useState<any>(null);
  const [captchaLoaded, setCaptchaLoaded] = useState(false);

  // 从 cookies 加载用户信息（同步读取，避免闪烁）
  const [userInfoLoaded, setUserInfoLoaded] = useState(false);

  useEffect(() => {
    if (!userInfoLoaded) {
      const savedAuthor = Cookies.get("ascs-author");
      const savedEmail = Cookies.get("ascs-email");
      const savedWebsite = Cookies.get("ascs-website");

      if (savedAuthor) setAuthor(savedAuthor);
      if (savedEmail) setEmail(savedEmail);
      if (savedWebsite) setWebsite(savedWebsite);
      
      setUserInfoLoaded(true);
    }
  }, [userInfoLoaded]);

  // 加载 Cap.js 脚本（只加载一次）
  useEffect(() => {
    // 检查是否已经加载
    if (window.Cap) {
      setCaptchaLoaded(true);
      return;
    }

    // 检查是否已经有脚本在加载中
    const existingScript = document.querySelector('script[src*="@cap.js/widget"]');
    if (existingScript) {
      // 等待现有脚本加载完成
      const checkInterval = setInterval(() => {
        if (window.Cap) {
          setCaptchaLoaded(true);
          clearInterval(checkInterval);
        }
      }, 100);
      
      // 10秒超时
      setTimeout(() => clearInterval(checkInterval), 10000);
      return;
    }

    // 设置 WASM URL
    (window as any).CAP_CUSTOM_WASM_URL =
      "https://use.sevencdn.com/npm/@cap.js/wasm/browser/cap_wasm.min.js";

    const script = document.createElement("script");
    script.src = "https://use.sevencdn.com/npm/@cap.js/widget";
    script.async = true;
    script.onload = () => {
      setCaptchaLoaded(true);
    };
    script.onerror = () => {
      console.error("Failed to load Cap.js script");
      setSubmitMessage("无法加载验证组件");
      setSubmitMessageType("error");
    };
    document.head.appendChild(script);
  }, []);

  // 初始化 CAPTCHA（使用 ref 避免重复创建）
  const [capInstance, setCapInstance] = useState<any>(null);
  const [isCapSolving, setIsCapSolving] = useState(false);
  const capInitializedRef = useRef(false);

  useEffect(() => {
    if (captchaLoaded && !capInstance && !capInitializedRef.current) {
      capInitializedRef.current = true;
      
      try {
        const cap = new (window as any).Cap({
          apiEndpoint: "/api/",
        });

        cap.addEventListener("progress", (e: any) => {
          console.log("CAPTCHA progress:", e.detail.progress + "%");
        });

        cap.addEventListener("error", (e: any) => {
          console.error("CAPTCHA error:", e.detail);
          setSubmitMessage(
            `CAPTCHA 错误: ${e.detail.message || "Unknown error"}`,
          );
          setSubmitMessageType("error");
          setIsCapSolving(false);
        });

        setCapInstance(cap);
      } catch (error) {
        console.error("Failed to create Cap instance:", error);
        setSubmitMessage("无法初始化验证组件");
        setSubmitMessageType("error");
        capInitializedRef.current = false;
      }
    }
  }, [captchaLoaded, capInstance]);

  // 手动触发 CAPTCHA 解决
  const solveCaptcha = async () => {
    if (!capInstance || isCapSolving) return;

    setIsCapSolving(true);
    setSubmitMessage(
      "正在进行安全验证...若长时间处于验证状态请刷新页面后重试！",
    );
    setSubmitMessageType("success");

    try {
      const result = await capInstance.solve();
      console.log("CAPTCHA solved:", result);
      setCaptchaToken(result.token);
      setCaptchaSolutions(result.solutions || []);

      // 显示成功消息
      setSubmitMessage("验证完成！");
      setSubmitMessageType("success");

      // 3秒后自动隐藏成功消息
      setTimeout(() => {
        setSubmitMessage(null);
      }, 3000);
    } catch (error) {
      console.error("CAPTCHA solve error:", error);
      setSubmitMessage("验证失败，请重新点击进行认证！");
      setSubmitMessageType("error");
    } finally {
      setIsCapSolving(false);
    }
  };

  // 重置 CAPTCHA
  const resetCaptcha = () => {
    setCaptchaToken(null);
    setCaptchaSolutions(null);
  };

  // 保存用户信息到 cookies
  const saveUserInfo = () => {
    if (author.trim()) {
      Cookies.set("ascs-author", author.trim(), { expires: 365 });
    }
    if (email.trim()) {
      Cookies.set("ascs-email", email.trim(), { expires: 365 });
    }
    if (website.trim()) {
      Cookies.set("ascs-website", website.trim(), { expires: 365 });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!author.trim() || !content.trim()) {
      setSubmitMessage("请填写姓名和评论内容");
      setSubmitMessageType("error");
      return;
    }

    if (!captchaToken || !captchaSolutions) {
      setSubmitMessage("请完成 CAPTCHA 验证");
      setSubmitMessageType("error");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/comments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          siteId,
          pageId,
          author: author.trim(),
          email: email.trim() || undefined,
          website: website.trim() || undefined,
          content: content.trim(),
          parentId,
          captchaToken,
          captchaSolutions,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        saveUserInfo(); // 保存用户信息到 cookies
        setContent(""); // 只清空评论内容，保留用户信息

        // 根据返回的消息类型显示不同的提示
        if (result.message && result.message.includes("需要管理员审核")) {
          setSubmitMessage(result.message);
          setSubmitMessageType("warning");
        } else {
          onCommentAdded();
          if (onCancel) onCancel();
        }

        // 重置 CAPTCHA
        resetCaptcha();
      } else {
        const error = await response.json();
        setSubmitMessage(error.error || "提交失败，请重试");
        setSubmitMessageType("error");
      }
    } catch (error) {
      console.error("Error submitting comment:", error);
      setSubmitMessage("提交失败，请重试");
      setSubmitMessageType("error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg">
          {parentId ? "回复评论" : "发表评论"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              placeholder="姓名 *"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              required
            />
            <Input
              type="email"
              placeholder="邮箱"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              type="url"
              placeholder="网站"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </div>
          <Tabs
            value={mode}
            onValueChange={(value) => setMode(value as "edit" | "preview")}
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="edit">编辑</TabsTrigger>
              <TabsTrigger value="preview">预览</TabsTrigger>
            </TabsList>
            <TabsContent value="edit" className="mt-2">
              <Textarea
                placeholder="写下你的评论..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={6}
                required
                className="resize-none"
              />
              <div className="mt-2 text-xs text-gray-500">
                支持 Markdown 格式：
                <Badge
                  variant="secondary"
                  className="text-xs font-normal text-gray-500 me-1"
                >
                  **粗体**
                </Badge>
                <Badge
                  variant="secondary"
                  className="text-xs font-normal text-gray-500 me-1"
                >
                  *斜体*
                </Badge>
                <Badge
                  variant="secondary"
                  className="text-xs font-normal text-gray-500 me-1"
                >
                  `代码`
                </Badge>
                <Badge
                  variant="secondary"
                  className="text-xs font-normal text-gray-500 me-1"
                >
                  [链接](url)
                </Badge>
                <Badge
                  variant="secondary"
                  className="text-xs font-normal text-gray-500 me-1"
                >
                  &gt; 引用
                </Badge>
              </div>
            </TabsContent>
            <TabsContent value="preview" className="mt-2">
              <div className="min-h-[150px] p-4 border border-gray-200 rounded-md bg-gray-50">
                {content ? (
                  <div className="prose prose-sm max-w-none">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      rehypePlugins={[rehypeHighlight]}
                      components={{
                        // 自定义组件渲染
                        p: ({ children }) => <p className="my-2">{children}</p>,
                        h1: ({ children }) => (
                          <h1 className="text-lg font-semibold my-2">
                            {children}
                          </h1>
                        ),
                        h2: ({ children }) => (
                          <h2 className="text-base font-semibold my-2">
                            {children}
                          </h2>
                        ),
                        h3: ({ children }) => (
                          <h3 className="text-sm font-semibold my-2">
                            {children}
                          </h3>
                        ),
                        code: ({ children, ...props }: any) => {
                          return (
                            <code
                              className="bg-gray-100 px-1 py-0.5 rounded text-xs font-mono"
                              {...props}
                            >
                              {children}
                            </code>
                          );
                        },
                        pre: ({ children }) => (
                          <pre className="bg-gray-100 p-3 rounded-md overflow-x-auto my-2 text-xs">
                            {children}
                          </pre>
                        ),
                        blockquote: ({ children }) => (
                          <blockquote className="border-l-4 border-gray-200 pl-4 my-2 text-gray-600 italic">
                            {children}
                          </blockquote>
                        ),
                        ul: ({ children }) => (
                          <ul className="list-disc list-inside my-2 space-y-1">
                            {children}
                          </ul>
                        ),
                        ol: ({ children }) => (
                          <ol className="list-decimal list-inside my-2 space-y-1">
                            {children}
                          </ol>
                        ),
                        li: ({ children }) => (
                          <li className="text-sm">{children}</li>
                        ),
                        a: ({ href, children }) => (
                          <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                          >
                            {children}
                          </a>
                        ),
                      }}
                    >
                      {content}
                    </ReactMarkdown>
                  </div>
                ) : (
                  <div className="text-gray-500 text-center py-8">
                    在编辑标签页输入内容，然后切换到预览查看效果
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>

          {/* 按钮区域 */}
          <div className="flex gap-2">
            {!captchaLoaded ? (
              <Button type="button" disabled>
                正在加载验证组件...
              </Button>
            ) : !captchaToken ? (
              <Button
                type="button"
                onClick={solveCaptcha}
                disabled={isCapSolving}
                className="bg-green-600 hover:bg-green-600/90"
              >
                {isCapSolving ? "验证中..." : "开始安全验证"}
              </Button>
            ) : (
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "提交中..." : "提交评论"}
              </Button>
            )}
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                取消
              </Button>
            )}
          </div>
        </form>
        {submitMessage && (
          <Alert
            className={`mt-4 ${submitMessageType === "error" ? "border-red-200 bg-red-50" : submitMessageType === "warning" ? "border-yellow-200 bg-yellow-50" : "border-green-200 bg-green-50"}`}
          >
            <AlertDescription>{submitMessage}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
