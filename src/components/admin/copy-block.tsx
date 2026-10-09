import { useEffect, useRef, useState } from 'react'
import { Button } from '@cloudflare/kumo'
import { CheckIcon, CopyIcon } from '@phosphor-icons/react'

export function CopyBlock({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    },
    [],
  )
  return (
    <div>
      <div className="copy-block">
        <pre>{text}</pre>
        <Button
          shape="square"
          aria-label={copied ? '已复制' : '复制'}
          title={copied ? '已复制' : '复制'}
          onClick={async () => {
            setError('')
            if (timeoutRef.current) clearTimeout(timeoutRef.current)
            try {
              await navigator.clipboard.writeText(text)
              setCopied(true)
              timeoutRef.current = setTimeout(() => setCopied(false), 1800)
            } catch {
              setCopied(false)
              setError('浏览器不允许访问剪贴板，请手动选择代码复制。')
            }
          }}
        >
          {copied ? <CheckIcon size={17} /> : <CopyIcon size={17} />}
        </Button>
      </div>
      {copied && (
        <p role="status" className="sr-only">
          已复制到剪贴板
        </p>
      )}
      {error && (
        <p role="alert" className="error-box mt-2">
          {error}
        </p>
      )}
    </div>
  )
}
