import { Button, Input } from '@cloudflare/kumo'
import { PlusIcon } from '@phosphor-icons/react'
import { errorText, fieldError } from '../../lib/api'
import { AppDialog } from '../ui'
import type { UseMutationResult } from '@tanstack/react-query'

export function CreateSiteDialog({
  open,
  onOpenChange,
  create,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  create: UseMutationResult<unknown, Error, { name: string; origin: string }>
}) {
  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      title="添加站点"
      description="添加博客站点后，需要完成 DNS 验证才能启用公开评论。"
      busy={create.isPending}
    >
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault()
          const form = new FormData(event.currentTarget)
          create.mutate({
            name: String(form.get('name')),
            origin: String(form.get('origin')),
          })
        }}
      >
        <Input
          label="站点名称"
          name="name"
          required
          maxLength={80}
          error={fieldError(create.error, 'name')}
        />
        <Input
          label="站点地址"
          name="origin"
          type="url"
          placeholder="https://blog.example.com"
          required
          error={fieldError(create.error, 'origin')}
        />
        {create.error &&
          !fieldError(create.error, 'name') &&
          !fieldError(create.error, 'origin') && (
            <p role="alert" className="error-box">
              {errorText(create.error)}
            </p>
          )}
        <div className="flex justify-end gap-2">
          <Button type="button" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            type="submit"
            variant="primary"
            icon={PlusIcon}
            loading={create.isPending}
          >
            添加站点
          </Button>
        </div>
      </form>
    </AppDialog>
  )
}

export function UnsavedChangesDialog({
  open,
  onOpenChange,
  onDiscard,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onDiscard: () => void
}) {
  return (
    <AppDialog
      open={open}
      title="放弃未保存的设置？"
      description="当前表单有未保存的修改。离开后这些修改会丢失。"
      alert
      onOpenChange={onOpenChange}
    >
      <div className="flex justify-end gap-2">
        <Button onClick={() => onOpenChange(false)}>继续编辑</Button>
        <Button variant="destructive" onClick={onDiscard}>
          放弃修改
        </Button>
      </div>
    </AppDialog>
  )
}
