export interface StatusConfigItem {
  label: string
  icon: string
  color: string
}

export const PROJECT_TYPES: Record<string, { label: string; icon: string; color: string }> = {
  new_system: { label: 'ລະບົບໃໝ່', icon: '🆕', color: '#3B82F6' },
  system_improvement: { label: 'ປັບປຸງລະບົບ', icon: '🛠️', color: '#F59E0B' },
}

export const PROJECT_STATUS: Record<string, StatusConfigItem> = {
  registered: { label: 'ລົງທະບຽນ', icon: '📝', color: '#6B7280' },
  requirements: { label: 'ເກັບຄວາມຕ້ອງການ', icon: '📋', color: '#F59E0B' },
  subtasks: { label: 'ກຳນົດໜ້າວຽກ', icon: '📑', color: '#8B5CF6' },
  development: { label: 'ກຳລັງພັດທະນາ', icon: '🔄', color: '#2563EB' },
  completed: { label: 'ສຳເລັດ', icon: '✅', color: '#10B981' },
  golive: { label: 'Go Live', icon: '🚀', color: '#0EA5E9' },
}

export const TASK_STATUS: Record<string, StatusConfigItem> = {
  pending: { label: 'ຈັດຜູ້ພັດທະນາ', icon: '📋', color: '#6B7280' },
  assigned: { label: 'ຮັບວຽກ', icon: '👤', color: '#F59E0B' },
  in_progress: { label: 'ກຳລັງພັດທະນາ', icon: '🔄', color: '#3B82F6' },
  submitted: { label: 'ສະເໜີກວດວຽກ', icon: '📤', color: '#8B5CF6' },
  rejected: { label: 'ປັບປຸງຄືນ', icon: '🔧', color: '#EF4444' },
  completed: { label: 'ສຳເລັດ', icon: '✅', color: '#10B981' },
}

const TASK_STATUS_ALIAS: Record<string, string> = {
  testing: 'submitted',
  lead_approved: 'submitted',
  manager_approved: 'completed',
}

export const normalizeTaskStatus = (status: string | undefined | null): string => {
  const key = String(status || '').trim().toLowerCase()
  if (!key) return 'pending'
  if (TASK_STATUS[key]) return key
  return TASK_STATUS_ALIAS[key] || key
}

export const getTaskStatusConfig = (status: string | undefined | null): StatusConfigItem => {
  const key = normalizeTaskStatus(status)
  return TASK_STATUS[key] || { label: String(status || '-'), icon: '❔', color: '#6B7280' }
}

export const isTaskCompletedStatus = (status: string | undefined | null): boolean =>
  normalizeTaskStatus(status) === 'completed'

export const TASK_STATUS_ORDER = Object.keys(TASK_STATUS)

export const countTasksByStatus = (tasks: Array<{ status?: string }>): Record<string, number> => {
  const counts: Record<string, number> = {}
  TASK_STATUS_ORDER.forEach((key) => { counts[key] = 0 })
  tasks.forEach((task) => {
    const key = normalizeTaskStatus(task?.status)
    if (key in counts) counts[key] += 1
  })
  return counts
}

export const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  open: { label: 'ລໍຖ້າຮັບງານ', color: 'info' },
  in_progress: { label: 'ກຳລັງດຳເນີນງານ', color: 'warning' },
  waiting: { label: 'ລໍຖ້າອາໄຫຼ່', color: 'purple' },
  closed: { label: 'ປິດ Job', color: 'success' },
}

export const PRIORITY_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  low: { label: 'ຕ່ຳ', color: 'low', dot: '#94a3b8' },
  medium: { label: 'ກາງ', color: 'medium', dot: '#3b82f6' },
  high: { label: 'ສູງ', color: 'high', dot: '#f59e0b' },
  critical: { label: 'ວິກິດ', color: 'critical', dot: '#ef4444' },
}
