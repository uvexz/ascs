import { createFileRoute } from '@tanstack/react-router'
import { SystemSettings } from '../../../components/instance/system-settings'
import { useAdminShell } from '../../../components/admin-shell'

export const Route = createFileRoute('/admin/instance/settings')({
  component: SystemSettingsView,
})

function SystemSettingsView() {
  const { setSettingsDirty } = useAdminShell()
  return <SystemSettings onDirtyChange={setSettingsDirty} />
}
