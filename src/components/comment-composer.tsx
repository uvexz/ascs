import { Button, Input } from '@cloudflare/kumo'
import {
  ArrowBendUpLeftIcon,
  ArrowRightIcon,
  EyeIcon,
  XIcon,
} from '@phosphor-icons/react'
import { Markdown } from './markdown'
import type { RefObject } from 'react'
import type { UseMutationResult } from '@tanstack/react-query'
import type { WidgetOptions } from './comment-thread'

type ReplyTarget = { id: string; author: string } | null

export function CommentComposer({
  options,
  session,
  challenge,
  formDisabled,
  send,
  reply,
  setReply,
  text,
  setText,
  preview,
  setPreview,
  editorRef,
  onSubmitStart,
}: {
  options: WidgetOptions
  session: { data: { user: { name: string } } | null }
  challenge: string
  formDisabled: boolean
  send: UseMutationResult<unknown, Error, Record<string, unknown>>
  reply: ReplyTarget
  setReply: (reply: ReplyTarget) => void
  text: string
  setText: (value: string) => void
  preview: boolean
  setPreview: (value: boolean) => void
  editorRef: RefObject<HTMLTextAreaElement | null>
  onSubmitStart: () => void
}) {
  return (
    <form
      className="comment-form"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmitStart()
        const form = new FormData(event.currentTarget)
        send.mutate({
          ...options,
          theme: undefined,
          accent: undefined,
          parentId: reply?.id,
          body: text,
          author: session.data ? undefined : String(form.get('author')),
          email: session.data ? undefined : String(form.get('email')),
          honeypot: String(form.get('website') || ''),
          challenge,
        })
      }}
    >
      {reply && (
        <div className="reply-target">
          <span className="h-lh flex items-center shrink-0">
            <ArrowBendUpLeftIcon size={16} aria-hidden="true" />
          </span>
          <span className="break-words">回复 {reply.author}</span>
          <Button
            type="button"
            shape="square"
            variant="ghost"
            aria-label="取消回复"
            title="取消回复"
            disabled={formDisabled}
            onClick={() => setReply(null)}
          >
            <XIcon size={16} />
          </Button>
        </div>
      )}
      {!session.data && (
        <>
          <div className="anonymous-fields">
            <Input
              label="昵称"
              name="author"
              required
              maxLength={60}
              autoComplete="nickname"
              disabled={formDisabled}
            />
            <Input
              label="邮箱（不公开）"
              name="email"
              type="email"
              required
              maxLength={254}
              autoComplete="email"
              disabled={formDisabled}
            />
          </div>
          <p className="anonymous-hint text-muted">
            邮箱仅用于接收回复通知和防止重复提交，不会展示给其他人。
          </p>
        </>
      )}
      {!preview && (
        <label className="sr-only" htmlFor="comment-text">
          评论内容
        </label>
      )}
      {preview ? (
        <div
          className="preview"
          role="region"
          tabIndex={0}
          aria-label="评论预览"
        >
          <Markdown>{text || ' '}</Markdown>
        </div>
      ) : (
        <textarea
          ref={editorRef}
          id="comment-text"
          name="body"
          value={text}
          onChange={(event) => setText(event.target.value)}
          required
          maxLength={5000}
          rows={5}
          placeholder="写下你的评论…"
          disabled={formDisabled}
          aria-describedby="comment-help"
        />
      )}
      <div className="honeypot" aria-hidden="true">
        <label htmlFor="website">Website</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <div className="composer-footer">
        <div className="composer-help">
          <span id="comment-help" className="text-muted">
            支持 Markdown · {text.length}/5000
          </span>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            shape="square"
            aria-label={preview ? '编辑评论' : '预览评论'}
            title={preview ? '编辑评论' : '预览评论'}
            aria-pressed={preview}
            disabled={formDisabled}
            onClick={() => setPreview(!preview)}
          >
            <EyeIcon size={17} />
          </Button>
          <Button
            type="submit"
            variant="primary"
            icon={ArrowRightIcon}
            disabled={!text.trim() || formDisabled}
            loading={send.isPending}
          >
            发布评论
          </Button>
        </div>
      </div>
    </form>
  )
}
