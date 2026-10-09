import { Button } from '@cloudflare/kumo'
import { TrashIcon } from '@phosphor-icons/react'
import { errorText } from '../../lib/api'
import { AppDialog } from '../ui'
import type { UseMutationResult } from '@tanstack/react-query'
import type { AdminComments } from '../../server/api.server'

type CommentRow = AdminComments['items'][number]

export function DeleteCommentDialog({
  commentId,
  onClose,
  moderate,
}: {
  commentId: string | null
  onClose: () => void
  moderate: UseMutationResult<
    unknown,
    Error,
    { commentId: string; status: 'approved' | 'spam' | 'deleted' }
  >
}) {
  return (
    <AppDialog
      open={!!commentId}
      onOpenChange={(open) => {
        if (!open && !moderate.isPending) onClose()
      }}
      title="删除评论？"
      description="内容和身份信息将永久清除，嵌套回复会保留。"
      alert
      busy={moderate.isPending}
    >
      <div>
        {moderate.error && (
          <p role="alert" className="error-box mb-4">
            {errorText(moderate.error)}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button onClick={onClose} disabled={moderate.isPending}>
            取消
          </Button>
          <Button
            variant="destructive"
            icon={TrashIcon}
            loading={moderate.isPending}
            onClick={() =>
              commentId && moderate.mutate({ commentId, status: 'deleted' })
            }
          >
            删除
          </Button>
        </div>
      </div>
    </AppDialog>
  )
}

export function BanCommenterDialog({
  target,
  canBanIp,
  onClose,
  ban,
}: {
  target: CommentRow | null
  canBanIp: boolean
  onClose: () => void
  ban: UseMutationResult<
    unknown,
    Error,
    { commentId: string; kind: 'user' | 'email' | 'ip' }
  >
}) {
  return (
    <AppDialog
      open={!!target}
      onOpenChange={(open) => {
        if (!open && !ban.isPending) onClose()
      }}
      title="封禁评论者"
      description={
        target
          ? `当前评论者：${target.author}。仅影响当前站点，不会自动删除历史评论。`
          : ''
      }
      busy={ban.isPending}
    >
      <div>
        {ban.error && (
          <p role="alert" className="error-box mb-4">
            {errorText(ban.error)}
          </p>
        )}
        <div className="grid gap-3">
          <Button
            disabled={ban.isPending || !target?.userId}
            onClick={() =>
              target && ban.mutate({ commentId: target.id, kind: 'user' })
            }
          >
            封禁账号
          </Button>
          <Button
            disabled={ban.isPending || !target?.hasEmail}
            onClick={() =>
              target && ban.mutate({ commentId: target.id, kind: 'email' })
            }
          >
            封禁邮箱
          </Button>
          <Button
            disabled={ban.isPending || !canBanIp || !target?.hasIp}
            onClick={() =>
              target && ban.mutate({ commentId: target.id, kind: 'ip' })
            }
          >
            封禁 IP
          </Button>
          {!canBanIp && (
            <p className="text-muted">
              当前服务未配置可信 IP 来源，无法安全区分不同评论者的 IP。
            </p>
          )}
          <Button variant="ghost" onClick={onClose} disabled={ban.isPending}>
            取消
          </Button>
        </div>
      </div>
    </AppDialog>
  )
}
