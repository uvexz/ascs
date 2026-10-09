import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export function Markdown({ children }: { children: string }) {
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          a: ({ children, href }) => (
            <a
              href={href}
              rel="nofollow noopener noreferrer ugc"
              target="_blank"
            >
              {children}
            </a>
          ),
          img: ({ alt }) => (
            <span className="text-muted">[图片：{alt || '图片'}]</span>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
