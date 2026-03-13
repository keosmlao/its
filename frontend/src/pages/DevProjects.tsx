import { useEffect, useMemo, useState } from 'react'
import Select from 'react-select'
import { Activity, ArrowRight, BarChart3, ChevronDown, FileText, FolderKanban, Layers, Plus, Search } from 'lucide-react'
import api from '../lib/api'
import { getStoredUser, type StoredUser } from '../lib/auth'
import { PROJECT_STATUS, PROJECT_TYPES, TASK_STATUS_ORDER, getTaskStatusConfig, isTaskCompletedStatus, normalizeTaskStatus } from '../lib/dashboardConstants'

/* ── Minimal CSS for pseudo-elements & animations that Tailwind can't handle ── */
const injectCSS = `
.p-table-card tr:not(.p-accordion-row):hover td{background:rgba(32,81,198,0.04)}
.p-table-card tr.p-row-expanded td{background:rgba(32,81,198,0.04);border-bottom-color:transparent}
.p-accordion-row td{background:rgba(239,231,219,0.25)!important;border-bottom:1px solid rgba(17,24,39,0.08)!important}
.p-accordion-row:hover td{background:rgba(239,231,219,0.25)!important}
.tbl-section::-webkit-scrollbar{height:6px}
.tbl-section::-webkit-scrollbar-thumb{background:#d1ccc4;border-radius:10px}
.ticket-scroll::-webkit-scrollbar{height:6px}
.ticket-scroll::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:999px}
.p-task-desc{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:4;overflow:hidden}
@keyframes slideUp{from{opacity:0;transform:scale(0.97) translateY(10px)}to{opacity:1;transform:scale(1) translateY(0)}}
@keyframes shellIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@keyframes tableIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
@keyframes accordionIn{from{opacity:0;max-height:0}to{opacity:1;max-height:2000px}}
@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
.fade-up{opacity:0;animation:fadeUp .42s ease forwards}
.fade-up-1{animation-delay:.04s}
.fade-up-2{animation-delay:.08s}
.fade-up-3{animation-delay:.12s}
.fade-up-4{animation-delay:.16s}
@media(max-width:640px){
  .p-table-card thead{display:none}
  .p-table-card tbody{display:flex;flex-direction:column;gap:10px;padding:10px}
  .p-table-card>tbody>tr:not(.p-accordion-row){display:grid;grid-template-columns:1fr 1fr;gap:0;background:#fff;border:1.5px solid rgba(17,24,39,0.08);border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.04)}
  .p-table-card>tbody>tr:not(.p-accordion-row):hover{background:#fff;transform:none}
  .p-table-card>tbody>tr:not(.p-accordion-row)>td{display:flex;flex-direction:column;gap:2px;padding:8px 12px;border-bottom:1px solid rgba(0,0,0,0.04);font-size:12px;white-space:normal;overflow:hidden;word-break:break-word}
  .p-table-card>tbody>tr:not(.p-accordion-row)>td::before{content:attr(data-label);font-size:9px;font-weight:700;color:#7B8197;text-transform:uppercase;letter-spacing:0.3px}
  .p-table-card>tbody>tr:not(.p-accordion-row)>td.cell-id{grid-column:1/-1;gap:4px;background:rgba(32,81,198,0.04);border-bottom:1.5px solid rgba(17,24,39,0.08);padding:10px 12px}
  .p-table-card>tbody>tr:not(.p-accordion-row)>td.cell-id::before{display:none}
  .p-table-card>tbody>tr:not(.p-accordion-row)>td:nth-child(7){grid-column:1/-1;min-width:0!important}
  .p-table-card>tbody>tr:not(.p-accordion-row)>td:last-child{grid-column:1/-1;border-bottom:none;padding:8px 12px;background:rgba(0,0,0,0.02);flex-direction:row}
  .p-table-card>tbody>tr:not(.p-accordion-row)>td:last-child::before{display:none}
  .p-table-card .p-btn-m{padding:9px 14px;font-size:11px;border-radius:10px;flex:1;min-width:0;text-align:center;justify-content:center;display:inline-flex}
  .p-accordion-row{display:block!important;border:1.5px solid rgba(17,24,39,0.08);border-radius:0 0 14px 14px;margin-top:-14px;overflow:hidden}
  .p-accordion-row td{padding:0!important}
  .kanban-grid{grid-template-columns:1fr!important;gap:8px}
}
@media(max-width:1366px) and (min-width:641px){
  .p-table-card th{padding:10px!important;font-size:9.5px!important}
  .p-table-card td{padding:10px!important;font-size:11px!important;line-height:1.45;vertical-align:middle}
}
`

// ────────────────────────────────────────────────────────────
// Interfaces
// ────────────────────────────────────────────────────────────

interface Project {
  id: number
  project_number?: string
  title: string
  description?: string
  type?: string
  status: string
  department_code?: string
  department_name?: string
  requester_code?: string
  requester_name?: string
  project_lead_id?: number | string | null
  start_date?: string
  expected_done_date?: string
  requirements_text?: string | object | null
  requirements_items?: string | string[] | object | null
  [key: string]: unknown
}

interface Task {
  id: number
  task_number?: string
  project_id: number
  title: string
  sub_title?: string
  description?: string
  status: string
  assigned_to?: number | string | null
  estimated_hours?: number | null
  reject_reason?: string
  [key: string]: unknown
}

interface User {
  id: number
  name: string
  username?: string
  role: string
  avatar?: string
  [key: string]: unknown
}

interface Department {
  code: string
  name: string
  [key: string]: unknown
}

interface Requester {
  code: string
  name: string
  [key: string]: unknown
}

interface SelectOption {
  value: string | number
  label: string
}

interface ModalState {
  type: string | null
  data: Project | Task | null
}

interface FormDataState {
  title?: string
  description?: string
  type?: string
  department_code?: string
  department_name?: string
  requester_code?: string
  requester_name?: string
  start_date?: string
  expected_done_date?: string
  project_lead_id?: number | string | null
  sub_title?: string
  assigned_to?: number | string | null
  estimated_hours?: number | null
  requirements_text?: string
  requirements_items?: string[]
  reject_reason?: string
  [key: string]: unknown
}

interface ProgressInfo {
  total: number
  done: number
  pct: number
}

interface WorkflowStep {
  key: string
  label: string
}



interface Counts {
  all: number
  registered: number
  requirements: number
  development: number
  completed: number
  [key: string]: number
}

// ────────────────────────────────────────────────────────────
// Select styles & portal props
// ────────────────────────────────────────────────────────────

const selectStyles = {
  control: (base: Record<string, unknown>, state: { isFocused: boolean }) => ({
    ...base,
    minHeight: 36,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    borderColor: state.isFocused ? '#38bdf8' : '#e2e8f0',
    boxShadow: state.isFocused ? '0 0 0 3px rgba(56, 189, 248, 0.08)' : 'none',
    ':hover': { borderColor: '#38bdf8' },
    fontSize: 12,
    fontFamily: 'var(--font-lao, "Noto Sans Lao", sans-serif)',
  }),
  menu: (base: Record<string, unknown>) => ({ ...base, borderRadius: 10, overflow: 'hidden', zIndex: 20, background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 10px 30px -8px rgba(15,23,42,0.12)' }),
  menuPortal: (base: Record<string, unknown>) => ({ ...base, zIndex: 10000 }),
  option: (base: Record<string, unknown>, state: { isFocused: boolean }) => ({
    ...base,
    fontSize: 12,
    backgroundColor: state.isFocused ? 'rgba(56,189,248,0.06)' : 'transparent',
    color: '#1C1E26',
    fontFamily: 'var(--font-lao, "Noto Sans Lao", sans-serif)',
  }),
}

const selectPortalProps: Record<string, unknown> = typeof document !== 'undefined'
  ? { menuPortalTarget: document.body, menuPosition: 'fixed', menuPlacement: 'auto' }
  : {}

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

const formatDate = (value: string | null | undefined): string => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('lo-LA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}

const getUserName = (userId: number | string | null | undefined, users: User[]): string => {
  if (!userId) return '-'
  const u = users.find(u => String(u.id) === String(userId))
  return u ? u.name : '-'
}

const collectTextParts = (value: unknown, parts: string[] = []): string[] => {
  if (value == null) return parts
  if (typeof value === 'string') {
    const t = value.trim()
    if (t) parts.push(t)
    return parts
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    parts.push(String(value))
    return parts
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectTextParts(item, parts))
    return parts
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const preferredKeys = ['text', 'description', 'detail', 'value', 'content', 'label', 'title', 'insert']
    preferredKeys.forEach((key) => {
      if (key in obj) collectTextParts(obj[key], parts)
    })
    if (parts.length === 0) {
      Object.values(obj).forEach((v) => collectTextParts(v, parts))
    }
  }
  return parts
}

const normalizeRequirementsText = (value: unknown): string => {
  const toText = (v: unknown): string => {
    if (v == null) return ''
    if (typeof v === 'string') return v.trim()
    if (typeof v === 'number' || typeof v === 'boolean') return String(v)
    if (Array.isArray(v)) {
      const parts = collectTextParts(v, [])
      return [...new Set(parts)].join('\n').trim()
    }
    if (typeof v === 'object') {
      const parts = collectTextParts(v, [])
      if (parts.length > 0) return [...new Set(parts)].join('\n').trim()
      try {
        return JSON.stringify(v)
      } catch {
        return ''
      }
    }
    return ''
  }

  if (typeof value === 'string') {
    const raw = value.trim()
    if (!raw) return ''
    try {
      const parsed = JSON.parse(raw)
      const parsedText = toText(parsed)
      return parsedText || raw
    } catch {
      return raw
    }
  }
  return toText(value)
}

const normalizeRequirementsItems = (value: unknown): string[] => {
  let source: unknown = value
  if (typeof source === 'string') {
    const raw = source.trim()
    if (!raw) return []
    try {
      source = JSON.parse(raw)
    } catch {
      return []
    }
  }
  if (!Array.isArray(source)) return []
  return source
    .map((item) => normalizeRequirementsText(item))
    .filter(Boolean)
}

const normalizeNullableNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const WORKFLOW_STEPS: WorkflowStep[] = [
  { key: 'registered', label: '\u0EA5\u0EBB\u0E87\u0E97\u0EB0\u0E9A\u0EBD\u0E99' },
  { key: 'requirements', label: '\u0EC0\u0E81\u0EB1\u0E9A\u0E84\u0EA7\u0EB2\u0EA1\u0E95\u0EC9\u0EAD\u0E87\u0E81\u0EB2\u0E99' },
  { key: 'subtasks', label: '\u0E81\u0ECD\u0EB2\u0E99\u0EBB\u0E94\u0EDC\u0EC9\u0EB2\u0EA7\u0EBD\u0E81' },
  { key: 'development', label: '\u0E81\u0ECD\u0EB2\u0EA5\u0EB1\u0E87\u0E9E\u0EB1\u0E94\u0E97\u0EB0\u0E99\u0EB2' },
  { key: 'completed', label: '\u0EAA\u0ECD\u0EB2\u0EC0\u0EA5\u0EB1\u0E94' },
]

const STEP_INDEX: Record<string, number> = {}
WORKFLOW_STEPS.forEach((s, i) => { STEP_INDEX[s.key] = i })

// ── Reusable Tailwind class strings ─────────────────────────
const CLS = {
  input: 'w-full rounded-lg border border-slate-200/80 bg-white px-3 py-2 text-[12px] text-slate-800 transition-all duration-200 focus:outline-none focus:border-sky-400 focus:ring-4 focus:ring-sky-400/10 font-[var(--font-lao,sans-serif)] placeholder:text-slate-300',
  field: 'mb-3',
  fieldLabel: 'mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400',
  grid2: 'grid grid-cols-1 gap-3 sm:grid-cols-2',
  btnMini: 'p-btn-m inline-flex items-center justify-center gap-1 rounded-lg px-2.5 py-1.5 text-[8px] font-bold text-white transition-all duration-150 hover:-translate-y-0.5 font-[var(--font-lao,sans-serif)] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none',
  btnMiniDefault: 'bg-gradient-to-br from-[#2051C6] to-[#4B7BFF]',
  btnMiniGreen: 'bg-gradient-to-br from-emerald-500 to-emerald-600',
  btnMiniOrange: 'bg-gradient-to-br from-amber-400 to-amber-600',
  btnMiniRed: 'bg-gradient-to-br from-red-500 to-red-600',
  btnMiniPurple: 'bg-gradient-to-br from-violet-500 to-violet-600',
  modalOverlay: 'fixed inset-0 z-[9999] flex items-start justify-center overflow-y-auto bg-slate-900/50 p-3 backdrop-blur-md sm:items-center sm:p-4',
  modalBox: 'my-auto w-full max-w-[480px] overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-2xl shadow-slate-900/15 animate-[slideUp_0.24s_ease-out]',
  modalBoxWide: 'my-auto w-full max-w-[680px] overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-2xl shadow-slate-900/15 animate-[slideUp_0.24s_ease-out]',
  modalHeader: 'border-b border-slate-100 px-4 pb-3 pt-4 text-center sm:px-5 sm:pb-3.5',
  modalBody: 'max-h-[70vh] overflow-y-auto px-4 py-4 sm:px-5',
  modalFooter: 'flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50/70 px-4 py-3 sm:flex-row sm:px-5 sm:py-3.5',
  iconWrap: 'mx-auto mb-3 grid h-9 w-9 place-items-center rounded-lg text-[16px] text-white shadow-md',
  iconWrapDefault: 'bg-gradient-to-br from-[#2051C6] via-[#4B7BFF] to-[#F35B4F]',
  btn: 'flex-1 rounded-lg px-3.5 py-2 text-[11px] font-semibold cursor-pointer border-none transition-all duration-200 hover:-translate-y-0.5 font-[var(--font-lao,sans-serif)] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none',
  btnConfirm: 'bg-gradient-to-br from-[#2051C6] via-[#4B7BFF] to-[#F35B4F] text-white shadow-[0_8px_20px_-10px_rgba(32,81,198,0.5)]',
  btnCancel: 'bg-[rgba(239,231,219,0.6)] text-slate-600 border border-[rgba(17,24,39,0.08)]',
  btnDanger: 'bg-gradient-to-br from-red-500 to-red-600 text-white shadow-[0_8px_20px_-10px_rgba(239,68,68,0.5)]',
  statusPill: 'inline-flex items-center gap-1.5 rounded-lg border border-transparent px-2 py-0.5 text-[8px] font-bold whitespace-nowrap',
  detailCard: 'overflow-hidden rounded-xl border border-slate-200/60 bg-white shadow-sm',
  detailCardHeader: 'flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-4 py-3',
  detailCardBody: 'p-4',
  eyebrow: 'inline-flex items-center gap-1.5 text-[8px] uppercase tracking-[0.18em] text-slate-400 font-semibold',
} as const

// ────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────

export default function DevProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [currentUser, setCurrentUser] = useState<StoredUser | null>(null)
  const [loading, setLoading] = useState(true)

  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null)
  const [expandedProjectId, setExpandedProjectId] = useState<number | null>(null)
  const [historyLogs, setHistoryLogs] = useState<{ id: number; from_status: string | null; to_status: string; note: string | null; created_at: string; changed_by_name: string | null }[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<string>('all')
  const [search, setSearch] = useState<string>('')
  const [activeModal, setActiveModal] = useState<ModalState>({ type: null, data: null })
  const [formData, setFormData] = useState<FormDataState>({})
  const [modalError, setModalError] = useState<string>('')
  const [departments, setDepartments] = useState<Department[]>([])
  const [requesters, setRequesters] = useState<Requester[]>([])

  // ── Fetch data ──────────────────────────────────────────
  useEffect(() => {
    const stored = getStoredUser()
    setCurrentUser(stored)

    Promise.all([api.listProjects(), api.listTasks(), api.listUsers()])
      .then(([pRes, tRes, uRes]) => {
        setProjects((pRes.data as Project[]) || [])
        setTasks((tRes.data as Task[]) || [])
        setUsers((uRes.data as User[]) || [])
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    Promise.all([api.listDepartments(), api.listRequesters()])
      .then(([dRes, rRes]) => {
        setDepartments((dRes.data as Department[]) || [])
        setRequesters((rRes.data as Requester[]) || [])
      })
      .catch(console.error)
  }, [])

  // ── Derived state ───────────────────────────────────────
  const user = useMemo<StoredUser>(() => currentUser || ({ id: 0, name: '', username: '', role: '' } as StoredUser), [currentUser])
  const role = useMemo<string>(() => String(user?.role || '').toLowerCase(), [user])
  const isLead = role === 'lead_programmer'
  const isProgrammer = role === 'programmer'
  const isManager = role === 'manager'
  const canExecuteTask = isProgrammer || isLead || isManager
  const canManageProject = isLead || isManager
  const canManageTasks = isLead || isManager
  const canDeleteProject = isManager

  const selectedProject = useMemo<Project | null>(() => {
    if (!selectedProjectId) return null
    return projects.find(p => p.id === selectedProjectId) || null
  }, [selectedProjectId, projects])

  useEffect(() => {
    if (!loading && selectedProjectId && !selectedProject) {
      setSelectedProjectId(null)
    }
  }, [loading, selectedProject, selectedProjectId])

  useEffect(() => {
    if (!selectedProjectId) { setHistoryLogs([]); return }
    setHistoryLoading(true)
    api.getProjectHistory(selectedProjectId)
      .then(res => {
        const d = res.data as { statusLogs?: typeof historyLogs } | null
        setHistoryLogs(d?.statusLogs || [])
      })
      .catch(() => setHistoryLogs([]))
      .finally(() => setHistoryLoading(false))
  }, [selectedProjectId]) // eslint-disable-line react-hooks/exhaustive-deps

  const filteredProjects = useMemo<Project[]>(() => {
    let result = projects.filter(p =>
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      (p.project_number && p.project_number.includes(search))
    )
    if (activeTab === 'registered') return result.filter(p => p.status === 'registered')
    if (activeTab === 'requirements') return result.filter(p => p.status === 'requirements')
    if (activeTab === 'development') return result.filter(p => ['subtasks', 'development'].includes(p.status))
    if (activeTab === 'completed') return result.filter(p => p.status === 'completed')
    return result
  }, [projects, activeTab, search])

  const counts = useMemo<Counts>(() => ({
    all: projects.length,
    registered: projects.filter(p => p.status === 'registered').length,
    requirements: projects.filter(p => p.status === 'requirements').length,
    development: projects.filter(p => ['subtasks', 'development'].includes(p.status)).length,
    completed: projects.filter(p => p.status === 'completed').length,
  }), [projects])

  const completionRate = useMemo<number>(
    () => (projects.length > 0 ? Math.round((counts.completed / projects.length) * 100) : 0),
    [counts.completed, projects.length]
  )

  const statusTabs = useMemo(
    () => ([
      { id: 'all', label: 'ທັງໝົດ', count: counts.all, color: '#0ea5e9' },
      { id: 'registered', label: 'ລົງທະບຽນ', count: counts.registered, color: '#64748b' },
      { id: 'requirements', label: 'ເກັບຄວາມຕ້ອງການ', count: counts.requirements, color: '#f59e0b' },
      { id: 'development', label: 'ກຳລັງພັດທະນາ', count: counts.development, color: '#2563eb' },
      { id: 'completed', label: 'ສຳເລັດ', count: counts.completed, color: '#10b981' },
    ]),
    [counts]
  )

  const devUsers = useMemo<User[]>(() =>
    users.filter(u => ['programmer', 'lead_programmer', 'manager'].includes(u.role)),
    [users]
  )

  const leadUsers = useMemo<User[]>(() =>
    users.filter(u => ['lead_programmer', 'manager'].includes(u.role)),
    [users]
  )

  const getProjectProgress = (projId: number): ProgressInfo => {
    const pTasks = tasks.filter(t => t.project_id === projId)
    if (pTasks.length === 0) return { total: 0, done: 0, pct: 0 }
    const done = pTasks.filter(t => isTaskCompletedStatus(t.status)).length
    return { total: pTasks.length, done, pct: Math.round((done / pTasks.length) * 100) }
  }

  const canCompleteProject = (projId: number): boolean => {
    const pTasks = tasks.filter(t => t.project_id === projId)
    return pTasks.length > 0 && pTasks.every(t => isTaskCompletedStatus(t.status))
  }

  // ── CRUD handlers (self-contained) ──────────────────────
  const onCreateProject = async (payload: Record<string, unknown>): Promise<boolean> => {
    try {
      const res = await api.createProject(payload)
      const created = (res.data as Project) || null
      if (created) setProjects(prev => [...prev, created])
      return true
    } catch (err) {
      console.error(err)
      return false
    }
  }

  const onUpdateProject = async (payload: Record<string, unknown> & { id: number; __localOnly?: boolean }): Promise<boolean> => {
    try {
      if (payload.__localOnly) {
        setProjects(prev => prev.map(p => p.id === payload.id ? { ...p, ...payload } as Project : p))
        return true
      }
      const { id, __localOnly, ...rest } = payload
      const res = await api.updateProject(id, rest)
      const updated = (res.data as Project) || null
      if (updated) {
        setProjects(prev => prev.map(p => p.id === id ? { ...p, ...updated } : p))
      } else {
        setProjects(prev => prev.map(p => p.id === id ? { ...p, ...rest } as Project : p))
      }
      return true
    } catch (err) {
      console.error(err)
      return false
    }
  }

  const onDeleteProject = async (id: number): Promise<boolean> => {
    try {
      await api.deleteProject(id)
      setProjects(prev => prev.filter(p => p.id !== id))
      setTasks(prev => prev.filter(t => t.project_id !== id))
      return true
    } catch (err) {
      console.error(err)
      return false
    }
  }

  const onCreateTask = async (payload: Record<string, unknown>): Promise<boolean> => {
    try {
      const res = await api.createTask(payload)
      const created = (res.data as Task) || null
      if (created) setTasks(prev => [...prev, created])
      return true
    } catch (err) {
      console.error(err)
      return false
    }
  }

  const onUpdateTask = async (payload: Task): Promise<boolean> => {
    try {
      const { id, ...rest } = payload
      const res = await api.updateTask(id, rest as Record<string, unknown>)
      const updated = (res.data as Task) || null
      if (updated) {
        setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updated } : t))
      } else {
        setTasks(prev => prev.map(t => t.id === id ? { ...t, ...rest } as Task : t))
      }
      return true
    } catch (err) {
      console.error(err)
      return false
    }
  }

  const onDeleteTask = async (id: number): Promise<boolean> => {
    try {
      await api.deleteTask(id)
      setTasks(prev => prev.filter(t => t.id !== id))
      return true
    } catch (err) {
      console.error(err)
      return false
    }
  }

  // ── Action helpers ──────────────────────────────────────
  const handleStatusChange = async (projectId: number, newStatus: string): Promise<void> => {
    await onUpdateProject({ id: projectId, status: newStatus })
  }

  const handleSaveRequirements = async (): Promise<boolean> => {
    const projId = (activeModal.data as Project | null)?.id
    if (!projId) return false
    setModalError('')
    try {
      const payload = {
        requirements_text: formData.requirements_text || '',
        requirements_items: formData.requirements_items || [],
      }
      const res = await api.setProjectRequirements(projId, payload)
      const updated = (res?.data as Record<string, unknown>) || {}
      const ok = await onUpdateProject({ id: projId, ...updated, __localOnly: true })
      if (ok === false) {
        setModalError('\u0E9A\u0EB1\u0E99\u0E97\u0EC6\u0E81\u0EA5\u0EB2\u0E8D\u0E81\u0EB2\u0E99\u0E9A\u0ECD\u0EC8\u0EAA\u0ECD\u0EB2\u0EC0\u0EA5\u0EB1\u0E94')
        return false
      }
      closeModal()
      return true
    } catch (err: unknown) {
      console.error(err)
      const axiosErr = err as { response?: { data?: { error?: string } }; message?: string }
      const message = axiosErr?.response?.data?.error || axiosErr?.message || '\u0E9A\u0EB1\u0E99\u0E97\u0EC6\u0E81\u0EA5\u0EB2\u0E8D\u0E81\u0EB2\u0E99\u0E9A\u0ECD\u0EC8\u0EAA\u0ECD\u0EB2\u0EC0\u0EA5\u0EB1\u0E94'
      setModalError(message)
      return false
    }
  }

  const handleTaskAction = async (task: Task, newStatus: string, extra: Record<string, unknown> = {}): Promise<void> => {
    await onUpdateTask({ ...task, status: newStatus, ...extra } as Task)
  }

  const openCreateProjectModal = (): void => {
    setModalError('')
    setFormData({
      title: '',
      description: '',
      type: 'new_system',
      department_code: '',
      department_name: '',
      requester_code: '',
      requester_name: '',
      start_date: '',
      expected_done_date: '',
      project_lead_id: null,
    })
    setActiveModal({ type: 'create', data: null })
  }

  const openEditProjectModal = (proj: Project): void => {
    setModalError('')
    setFormData({
      title: proj.title,
      description: proj.description || '',
      type: proj.type || 'new_system',
      department_code: proj.department_code,
      department_name: proj.department_name,
      requester_code: proj.requester_code,
      requester_name: proj.requester_name,
      start_date: proj.start_date || '',
      expected_done_date: proj.expected_done_date || '',
      project_lead_id: proj.project_lead_id,
    })
    setActiveModal({ type: 'edit', data: proj })
  }

  const openRequirementsModal = (proj: Project): void => {
    setModalError('')
    setFormData({
      requirements_text: normalizeRequirementsText(proj.requirements_text),
      requirements_items: (() => {
        const items = normalizeRequirementsItems(proj.requirements_items)
        return items.length > 0 ? items : ['']
      })(),
    })
    setActiveModal({ type: 'requirements', data: proj })
  }

  const openCreateTaskModal = (proj: Project): void => {
    setModalError('')
    setFormData({
      title: '',
      sub_title: '',
      description: '',
      assigned_to: null,
      estimated_hours: null,
    })
    setActiveModal({ type: 'createTask', data: proj })
  }

  const openEditTaskModal = (task: Task): void => {
    setModalError('')
    setFormData({
      title: task.title,
      sub_title: task.sub_title || '',
      description: task.description || '',
      estimated_hours: normalizeNullableNumber(task.estimated_hours),
    })
    setActiveModal({ type: 'editTask', data: task })
  }

  const openAssignTaskModal = (task: Task, assignedTo: number | string | null): void => {
    setModalError('')
    setFormData({ assigned_to: assignedTo })
    setActiveModal({ type: 'assignTask', data: task })
  }

  const openRejectTaskModal = (task: Task): void => {
    setModalError('')
    setFormData({ reject_reason: '' })
    setActiveModal({ type: 'rejectTask', data: task })
  }

  const openDeleteTaskModal = (task: Task): void => {
    setModalError('')
    setActiveModal({ type: 'deleteTask', data: task })
  }

  const openDeleteProjectModal = (proj: Project): void => {
    setModalError('')
    setActiveModal({ type: 'deleteProject', data: proj })
  }

  const closeModal = (): void => {
    setActiveModal({ type: null, data: null })
    setFormData({})
    setModalError('')
  }

  // ── Modal error fragment ──────────────────────────────────
  const renderModalError = () => modalError ? (
    <div className="mt-2 text-red-500 text-[11px] font-semibold">{modalError}</div>
  ) : null

  // ── Reusable task actions renderer ─────────────────────────
  const renderTaskActionsFor = (task: Task, projStatus: string): React.ReactNode => {
    const rawStatus = String(task.status || '').toLowerCase()
    const normalizedStatus = normalizeTaskStatus(task.status)
    const isOwner = String(task.assigned_to) === String(user.id)
    const canMutate = canManageTasks && ['subtasks', 'development'].includes(projStatus)

    return (
      <div className="flex gap-1.5 flex-wrap justify-start">
        {canMutate && (
          <button className={`${CLS.btnMini} ${CLS.btnMiniOrange}`} onClick={() => openEditTaskModal(task)}>&#9998; ແກ້ໄຂ</button>
        )}
        {canManageTasks && normalizedStatus === 'pending' && (
          <button className={`${CLS.btnMini} ${CLS.btnMiniOrange}`} onClick={() => openAssignTaskModal(task, task.assigned_to || null)}>&#128100; ມອບໝາຍ</button>
        )}
        {canManageTasks && task.assigned_to && normalizedStatus === 'assigned' && (
          <button className={`${CLS.btnMini} ${CLS.btnMiniOrange}`} onClick={() => openAssignTaskModal(task, null)}>&#128260; ປ່ຽນ</button>
        )}
        {canExecuteTask && isOwner && normalizedStatus === 'assigned' && (
          <button className={`${CLS.btnMini} ${CLS.btnMiniGreen}`} onClick={() => handleTaskAction(task, 'in_progress')}>&#10003; ຮັບງານ</button>
        )}
        {canExecuteTask && isOwner && normalizedStatus === 'in_progress' && (
          <button className={`${CLS.btnMini} ${CLS.btnMiniPurple}`} onClick={() => handleTaskAction(task, 'submitted')}>&#128228; ສະເໜີກວດ</button>
        )}
        {canExecuteTask && isOwner && normalizedStatus === 'rejected' && (
          <button className={`${CLS.btnMini} ${CLS.btnMiniDefault}`} onClick={() => handleTaskAction(task, 'in_progress')}>&#128295; ແກ້ໄຂ</button>
        )}
        {canManageTasks && ['submitted', 'testing'].includes(rawStatus) && (
          <>
            <button className={`${CLS.btnMini} ${CLS.btnMiniGreen}`} onClick={() => handleTaskAction(task, isManager ? 'manager_approved' : 'lead_approved')}>&#10003; {isManager ? 'ສຳເລັດ' : 'ຜ່ານກວດ'}</button>
            <button className={`${CLS.btnMini} ${CLS.btnMiniRed}`} onClick={() => openRejectTaskModal(task)}>&#10007; ສົ່ງຄືນ</button>
          </>
        )}
        {isManager && rawStatus === 'lead_approved' && (
          <button className={`${CLS.btnMini} ${CLS.btnMiniGreen}`} onClick={() => handleTaskAction(task, 'manager_approved')}>&#127942; ຢືນຢັນ</button>
        )}
        {canMutate && (
          <button className={`${CLS.btnMini} ${CLS.btnMiniRed}`} onClick={() => openDeleteTaskModal(task)}>&#128465; ລຶບ</button>
        )}
      </div>
    )
  }

  // ── Reusable kanban renderer ──────────────────────────────
  const renderKanbanBoard = (filteredTasks: Task[], projStatus: string) => (
    <div className="kanban-grid grid grid-cols-[repeat(6,minmax(260px,1fr))] gap-3.5 overflow-x-auto p-[4px_2px_2px]">
      {TASK_STATUS_ORDER.map(statusKey => {
        const colTasks = filteredTasks.filter(t => normalizeTaskStatus(t.status) === statusKey)
        const columnConfig = getTaskStatusConfig(statusKey)
        return (
          <div key={statusKey} className="min-w-[260px] bg-[rgba(255,253,249,0.78)] border border-[rgba(17,24,39,0.08)] rounded-[18px] overflow-hidden" style={{ borderColor: `${columnConfig.color}22` }}>
            <div className="flex items-center justify-between gap-2.5 px-3.5 py-3 border-b border-[rgba(17,24,39,0.06)]" style={{ background: `${columnConfig.color}10` }}>
              <div className="flex items-center gap-2.5 text-[11px] font-bold text-slate-800">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: columnConfig.color, boxShadow: `0 0 0 4px ${columnConfig.color}18` }} />
                <span>{columnConfig.icon} {columnConfig.label}</span>
              </div>
              <span className="inline-flex items-center justify-center min-w-[26px] h-[26px] px-2 rounded-full bg-[rgba(255,253,249,0.95)] border border-[rgba(17,24,39,0.08)] text-[10px] font-bold text-slate-400">{colTasks.length}</span>
            </div>
            <div className="flex flex-col gap-2.5 p-3 min-h-[220px]">
              {colTasks.length > 0 ? colTasks.map(task => {
                const tCfg = getTaskStatusConfig(task.status)
                return (
                  <article key={task.id} className="flex flex-col gap-2.5 p-3 rounded-2xl border border-[rgba(17,24,39,0.08)] bg-[rgba(255,253,249,0.96)] shadow-[0_10px_24px_-22px_rgba(17,24,39,0.4)]" style={{ boxShadow: `inset 3px 0 0 ${tCfg.color}, 0 10px 24px -22px rgba(17,24,39,0.4)` }}>
                    <div className="flex items-start justify-between gap-2.5">
                      <span className="text-[#2051C6] font-bold text-[10px] font-mono">{task.task_number || `#${task.id}`}</span>
                      <span className={CLS.statusPill} style={{ background: `${tCfg.color}18`, color: tCfg.color, borderColor: tCfg.color }}>
                        {tCfg.icon} {tCfg.label}
                      </span>
                    </div>
                    <div className="text-xs font-bold text-slate-800 leading-[1.45]">{task.title}</div>
                    {task.sub_title && <div className="text-[10.5px] text-slate-400 leading-normal">{task.sub_title}</div>}
                    {task.description && <div className="p-task-desc text-[11px] text-slate-600 leading-relaxed">{task.description}</div>}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex flex-col gap-0.5 p-2 px-2.5 rounded-xl bg-[rgba(239,231,219,0.28)] border border-[rgba(17,24,39,0.06)]">
                        <span className="text-[9px] font-semibold tracking-wider uppercase text-slate-400">ຜູ້ພັດທະນາ</span>
                        <strong className="text-[11px] text-slate-800">{getUserName(task.assigned_to, users)}</strong>
                      </div>
                      <div className="flex flex-col gap-0.5 p-2 px-2.5 rounded-xl bg-[rgba(239,231,219,0.28)] border border-[rgba(17,24,39,0.06)]">
                        <span className="text-[9px] font-semibold tracking-wider uppercase text-slate-400">ເວລາ</span>
                        <strong className="text-[11px] text-slate-800">{task.estimated_hours || '-'} ຊມ</strong>
                      </div>
                    </div>
                    {task.status === 'rejected' && task.reject_reason && (
                      <div className="p-2 px-2.5 rounded-xl bg-red-500/[0.08] border border-red-500/[0.18] text-red-700 text-[10.5px] font-semibold leading-normal">&#10007; {task.reject_reason}</div>
                    )}
                    {renderTaskActionsFor(task, projStatus)}
                  </article>
                )
              }) : (
                <div className="grid place-items-center min-h-[120px] p-4 border border-dashed border-[rgba(17,24,39,0.12)] rounded-[14px] text-slate-400 text-[11px] bg-[rgba(239,231,219,0.18)]">ບໍ່ມີ task</div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )

  // ============================================================
  // MODALS
  // ============================================================

  const renderModalContent = (): React.ReactNode => {
    if (!activeModal.type) return null
    const { type, data } = activeModal

    // --- Create Project ---
    if (type === 'create') {
      return (
        <div className={CLS.modalBoxWide}>
          <div className={CLS.modalHeader}>
            <div className={`${CLS.iconWrap} ${CLS.iconWrapDefault}`}>&#128193;</div>
            <h3 className="text-base font-bold font-[var(--font-display,serif)] m-0">ສ້າງໂຄງການໃໝ່</h3>
            <p className="text-slate-400 text-[11px] mt-1">ປ້ອນລາຍລະອຽດໂຄງການເພື່ອເລີ່ມຕົ້ນ</p>
          </div>
          <div className={CLS.modalBody}>
            <div className={CLS.field}><label className={CLS.fieldLabel}>ຫົວຂໍ້ *</label><input className={CLS.input} placeholder="ຊື່ໂຄງການ..." value={formData.title || ''} onChange={e => setFormData({ ...formData, title: e.target.value })} /></div>
            <div className={CLS.field}><label className={CLS.fieldLabel}>ລາຍລະອຽດ</label><textarea className={CLS.input} rows={3} placeholder="ອະທິບາຍໂຄງການ..." value={formData.description || ''} onChange={e => setFormData({ ...formData, description: e.target.value })} /></div>
            <div className={CLS.grid2}>
              <div className={CLS.field}><label className={CLS.fieldLabel}>ປະເພດ</label>
                <Select styles={selectStyles} {...selectPortalProps} value={formData.type ? { value: formData.type, label: `${PROJECT_TYPES[formData.type]?.icon || ''} ${PROJECT_TYPES[formData.type]?.label || formData.type}` } : null} options={Object.entries(PROJECT_TYPES).map(([k, v]) => ({ value: k, label: `${v.icon} ${v.label}` }))} onChange={(opt: SelectOption | null) => setFormData({ ...formData, type: opt?.value as string })} placeholder="ເລືອກ..." />
              </div>
              <div className={CLS.field}><label className={CLS.fieldLabel}>ຫົວໜ້າໂຄງການ</label>
                <Select styles={selectStyles} {...selectPortalProps} value={formData.project_lead_id ? { value: formData.project_lead_id, label: getUserName(formData.project_lead_id, users) } : null} options={leadUsers.map(u => ({ value: u.id, label: u.name }))} onChange={(opt: SelectOption | null) => setFormData({ ...formData, project_lead_id: opt?.value })} placeholder="ເລືອກ..." isClearable />
              </div>
            </div>
            <div className={CLS.grid2}>
              <div className={CLS.field}><label className={CLS.fieldLabel}>ພະແນກ</label>
                <Select styles={selectStyles} {...selectPortalProps} value={formData.department_code ? { value: formData.department_code, label: formData.department_name || '' } : null} options={departments.map(d => ({ value: d.code, label: d.name }))} onChange={(opt: SelectOption | null) => setFormData({ ...formData, department_code: opt?.value as string, department_name: opt?.label })} placeholder="ເລືອກ..." isClearable />
              </div>
              <div className={CLS.field}><label className={CLS.fieldLabel}>ຜູ້ຮ້ອງຂໍ</label>
                <Select styles={selectStyles} {...selectPortalProps} value={formData.requester_code ? { value: formData.requester_code, label: formData.requester_name || '' } : null} options={requesters.map(r => ({ value: r.code, label: r.name }))} onChange={(opt: SelectOption | null) => setFormData({ ...formData, requester_code: opt?.value as string, requester_name: opt?.label })} placeholder="ເລືອກ..." isClearable />
              </div>
            </div>
            <div className={CLS.grid2}>
              <div className={CLS.field}><label className={CLS.fieldLabel}>ວັນເລີ່ມ</label><input type="date" className={CLS.input} value={formData.start_date || ''} onChange={e => setFormData({ ...formData, start_date: e.target.value })} /></div>
              <div className={CLS.field}><label className={CLS.fieldLabel}>ກຳນົດແລ້ວ</label><input type="date" className={CLS.input} value={formData.expected_done_date || ''} onChange={e => setFormData({ ...formData, expected_done_date: e.target.value })} /></div>
            </div>
            {renderModalError()}
          </div>
          <div className={CLS.modalFooter}>
            <button className={`${CLS.btn} ${CLS.btnCancel}`} type="button" onClick={closeModal}>ຍົກເລີກ</button>
            <button className={`${CLS.btn} ${CLS.btnConfirm}`} type="button" onClick={async () => {
              setModalError('')
              if (!formData.title) {
                setModalError('ກະລຸນາປ້ອນຫົວຂໍ້ໂຄງການ')
                return
              }
              const ok = await onCreateProject({ ...formData, type: formData.type || 'new_system' })
              if (!ok) {
                setModalError('ສ້າງໂຄງການບໍ່ສຳເລັດ')
                return
              }
              closeModal()
            }}>ສ້າງເລີຍ</button>
          </div>
        </div>
      )
    }

    // --- Edit Project ---
    if (type === 'edit') {
      const proj = data as Project
      return (
        <div className={CLS.modalBoxWide}>
          <div className={CLS.modalHeader}>
            <div className={CLS.iconWrap} style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>&#9998;</div>
            <h3 className="text-base font-bold font-[var(--font-display,serif)] m-0">ແກ້ໄຂໂຄງການ</h3>
            <p className="text-slate-400 text-[11px] mt-1">ແກ້ໄຂຂໍ້ມູນໂຄງການ #{proj?.project_number}</p>
          </div>
          <div className={CLS.modalBody}>
            <div className={CLS.field}><label className={CLS.fieldLabel}>ຫົວຂໍ້ *</label><input className={CLS.input} value={formData.title || ''} onChange={e => setFormData({ ...formData, title: e.target.value })} /></div>
            <div className={CLS.field}><label className={CLS.fieldLabel}>ລາຍລະອຽດ</label><textarea className={CLS.input} rows={3} value={formData.description || ''} onChange={e => setFormData({ ...formData, description: e.target.value })} /></div>
            <div className={CLS.grid2}>
              <div className={CLS.field}><label className={CLS.fieldLabel}>ປະເພດ</label>
                <Select styles={selectStyles} {...selectPortalProps} value={formData.type ? { value: formData.type, label: `${PROJECT_TYPES[formData.type]?.icon || ''} ${PROJECT_TYPES[formData.type]?.label || formData.type}` } : null} options={Object.entries(PROJECT_TYPES).map(([k, v]) => ({ value: k, label: `${v.icon} ${v.label}` }))} onChange={(opt: SelectOption | null) => setFormData({ ...formData, type: opt?.value as string })} />
              </div>
              <div className={CLS.field}><label className={CLS.fieldLabel}>ຫົວໜ້າໂຄງການ</label>
                <Select styles={selectStyles} {...selectPortalProps} value={formData.project_lead_id ? { value: formData.project_lead_id, label: getUserName(formData.project_lead_id, users) } : null} options={leadUsers.map(u => ({ value: u.id, label: u.name }))} onChange={(opt: SelectOption | null) => setFormData({ ...formData, project_lead_id: opt?.value })} />
              </div>
            </div>
            <div className={CLS.grid2}>
              <div className={CLS.field}><label className={CLS.fieldLabel}>ພະແນກ</label>
                <Select styles={selectStyles} {...selectPortalProps} value={formData.department_code ? { value: formData.department_code, label: formData.department_name || '' } : null} options={departments.map(d => ({ value: d.code, label: d.name }))} onChange={(opt: SelectOption | null) => setFormData({ ...formData, department_code: opt?.value as string, department_name: opt?.label })} />
              </div>
              <div className={CLS.field}><label className={CLS.fieldLabel}>ຜູ້ຮ້ອງຂໍ</label>
                <Select styles={selectStyles} {...selectPortalProps} value={formData.requester_code ? { value: formData.requester_code, label: formData.requester_name || '' } : null} options={requesters.map(r => ({ value: r.code, label: r.name }))} onChange={(opt: SelectOption | null) => setFormData({ ...formData, requester_code: opt?.value as string, requester_name: opt?.label })} />
              </div>
            </div>
            <div className={CLS.grid2}>
              <div className={CLS.field}><label className={CLS.fieldLabel}>ວັນເລີ່ມ</label><input type="date" className={CLS.input} value={formData.start_date || ''} onChange={e => setFormData({ ...formData, start_date: e.target.value })} /></div>
              <div className={CLS.field}><label className={CLS.fieldLabel}>ກຳນົດແລ້ວ</label><input type="date" className={CLS.input} value={formData.expected_done_date || ''} onChange={e => setFormData({ ...formData, expected_done_date: e.target.value })} /></div>
            </div>
            {renderModalError()}
          </div>
          <div className={CLS.modalFooter}>
            <button className={`${CLS.btn} ${CLS.btnCancel}`} type="button" onClick={closeModal}>ຍົກເລີກ</button>
            <button className={`${CLS.btn} ${CLS.btnConfirm}`} onClick={async () => {
              setModalError('')
              if (!formData.title) {
                setModalError('ກະລຸນາປ້ອນຫົວຂໍ້ໂຄງການ')
                return
              }
              const ok = await onUpdateProject({ id: proj.id, ...formData })
              if (!ok) {
                setModalError('ບັນທຶກການແກ້ໄຂບໍ່ສຳເລັດ')
                return
              }
              closeModal()
            }}>ບັນທຶກ</button>
          </div>
        </div>
      )
    }

    // --- Requirements ---
    if (type === 'requirements') {
      const proj = data as Project
      const items = formData.requirements_items || []
      return (
        <div className={CLS.modalBoxWide}>
          <div className={CLS.modalHeader}>
            <div className={CLS.iconWrap} style={{ background: 'linear-gradient(135deg, #f59e0b, #ea580c)' }}>&#128203;</div>
            <h3 className="text-base font-bold font-[var(--font-display,serif)] m-0">ເກັບຄວາມຕ້ອງການ</h3>
            <p className="text-slate-400 text-[11px] mt-1">ບັນທຶກຄວາມຕ້ອງການຂອງໂຄງການ #{proj?.project_number}</p>
          </div>
          <div className={CLS.modalBody}>
            <div className={CLS.field}>
              <label className={CLS.fieldLabel}>ລາຍລະອຽດຄວາມຕ້ອງການ</label>
              <textarea className={CLS.input} rows={5} value={formData.requirements_text || ''} placeholder="ອະທິບາຍຄວາມຕ້ອງການ..." onChange={e => setFormData({ ...formData, requirements_text: e.target.value })} />
            </div>
            <div className={CLS.field}>
              <label className={CLS.fieldLabel}>ລາຍການຄວາມຕ້ອງການ</label>
              {items.map((item: string, idx: number) => (
                <div key={idx} className="flex gap-2 items-center mb-2">
                  <input className={`${CLS.input} flex-1`} value={item} onChange={e => {
                    const value = e.target.value
                    setFormData((prev) => {
                      const currentItems = Array.isArray(prev.requirements_items) ? prev.requirements_items : []
                      const next = [...currentItems]
                      next[idx] = value
                      return { ...prev, requirements_items: next }
                    })
                  }} />
                  <button type="button" className="w-7 h-7 rounded-lg border border-red-500/30 bg-red-500/[0.06] text-red-500 text-sm cursor-pointer grid place-items-center" onClick={() => {
                    setFormData((prev) => {
                      const currentItems = Array.isArray(prev.requirements_items) ? prev.requirements_items : []
                      return { ...prev, requirements_items: currentItems.filter((_: string, i: number) => i !== idx) }
                    })
                  }}>&times;</button>
                </div>
              ))}
              <button type="button" className={`${CLS.btnMini} ${CLS.btnMiniDefault} mt-1`} onClick={() => {
                setFormData((prev) => {
                  const currentItems = Array.isArray(prev.requirements_items) ? prev.requirements_items : []
                  return { ...prev, requirements_items: [...currentItems, ''] }
                })
              }}>+ ເພີ່ມລາຍການ</button>
            </div>
            {renderModalError()}
          </div>
          <div className={CLS.modalFooter}>
            <button className={`${CLS.btn} ${CLS.btnCancel}`} type="button" onClick={closeModal}>ຍົກເລີກ</button>
            <button className={`${CLS.btn} ${CLS.btnConfirm}`} type="button" onClick={handleSaveRequirements}>ບັນທຶກ</button>
          </div>
        </div>
      )
    }

    // --- Create Task ---
    if (type === 'createTask') {
      return (
        <div className={CLS.modalBox}>
          <div className={CLS.modalHeader}>
            <div className={CLS.iconWrap} style={{ background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)' }}>&#128209;</div>
            <h3 className="text-base font-bold font-[var(--font-display,serif)] m-0">ເພີ່ມໜ້າວຽກ</h3>
            <p className="text-slate-400 text-[11px] mt-1">ເພີ່ມໜ້າວຽກສຳລັບໂຄງການ</p>
          </div>
          <div className={CLS.modalBody}>
            <div className={CLS.field}><label className={CLS.fieldLabel}>ຫົວຂໍ້ *</label><input className={CLS.input} placeholder="ຊື່ໜ້າວຽກ..." onChange={e => setFormData({ ...formData, title: e.target.value })} /></div>
            <div className={CLS.field}><label className={CLS.fieldLabel}>ຫົວຂໍ້ຍ່ອຍ</label><input className={CLS.input} placeholder="ຫົວຂໍ້ຍ່ອຍ..." onChange={e => setFormData({ ...formData, sub_title: e.target.value })} /></div>
            <div className={CLS.field}><label className={CLS.fieldLabel}>ລາຍລະອຽດ</label><textarea className={CLS.input} rows={3} placeholder="ອະທິບາຍໜ້າວຽກ..." onChange={e => setFormData({ ...formData, description: e.target.value })} /></div>
            <div className={CLS.grid2}>
              <div className={CLS.field}><label className={CLS.fieldLabel}>ຜູ້ຮັບວຽກ</label>
                <Select styles={selectStyles} {...selectPortalProps} options={devUsers.map(u => ({ value: u.id, label: u.name }))} onChange={(opt: SelectOption | null) => setFormData({ ...formData, assigned_to: opt?.value })} placeholder="ເລືອກ..." isClearable />
              </div>
              <div className={CLS.field}><label className={CLS.fieldLabel}>ເວລາຄາດຄະເນ (ຊມ)</label><input type="number" className={CLS.input} placeholder="0" onChange={e => setFormData({ ...formData, estimated_hours: normalizeNullableNumber(e.target.value) })} /></div>
            </div>
            {renderModalError()}
          </div>
          <div className={CLS.modalFooter}>
            <button className={`${CLS.btn} ${CLS.btnCancel}`} type="button" onClick={closeModal}>ຍົກເລີກ</button>
            <button className={`${CLS.btn} ${CLS.btnConfirm}`} type="button" onClick={async () => {
              setModalError('')
              if (!formData.title) {
                setModalError('ກະລຸນາປ້ອນຫົວຂໍ້ໜ້າວຽກ')
                return
              }
              const proj = data as Project
              const ok = await onCreateTask({
                project_id: proj?.id || selectedProjectId,
                title: formData.title,
                sub_title: formData.sub_title || '',
                description: formData.description || '',
                assigned_to: formData.assigned_to || null,
                estimated_hours: formData.estimated_hours ?? null,
                status: formData.assigned_to ? 'assigned' : 'pending',
              })
              if (!ok) {
                setModalError('ບັນທຶກໜ້າວຽກບໍ່ສຳເລັດ')
                return
              }
              closeModal()
            }}>ເພີ່ມ</button>
          </div>
        </div>
      )
    }

    // --- Edit Task ---
    if (type === 'editTask') {
      const task = data as Task
      return (
        <div className={CLS.modalBox}>
          <div className={CLS.modalHeader}>
            <div className={CLS.iconWrap} style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>&#9998;</div>
            <h3 className="text-base font-bold font-[var(--font-display,serif)] m-0">ແກ້ໄຂໜ້າວຽກ</h3>
            <p className="text-slate-400 text-[11px] mt-1">ປັບຂໍ້ມູນຂອງ: {task?.title}</p>
          </div>
          <div className={CLS.modalBody}>
            <div className={CLS.field}><label className={CLS.fieldLabel}>ຫົວຂໍ້ *</label><input className={CLS.input} value={formData.title || ''} onChange={e => setFormData({ ...formData, title: e.target.value })} /></div>
            <div className={CLS.field}><label className={CLS.fieldLabel}>ຫົວຂໍ້ຍ່ອຍ</label><input className={CLS.input} value={formData.sub_title || ''} onChange={e => setFormData({ ...formData, sub_title: e.target.value })} /></div>
            <div className={CLS.field}><label className={CLS.fieldLabel}>ລາຍລະອຽດ</label><textarea className={CLS.input} rows={3} value={formData.description || ''} onChange={e => setFormData({ ...formData, description: e.target.value })} /></div>
            <div className={CLS.field}><label className={CLS.fieldLabel}>ເວລາຄາດຄະເນ (ຊມ)</label><input type="number" className={CLS.input} value={formData.estimated_hours ?? ''} onChange={e => setFormData({ ...formData, estimated_hours: normalizeNullableNumber(e.target.value) })} /></div>
            {renderModalError()}
          </div>
          <div className={CLS.modalFooter}>
            <button className={`${CLS.btn} ${CLS.btnCancel}`} type="button" onClick={closeModal}>ຍົກເລີກ</button>
            <button className={`${CLS.btn} ${CLS.btnConfirm}`} type="button" onClick={async () => {
              setModalError('')
              if (!formData.title) {
                setModalError('ກະລຸນາປ້ອນຫົວຂໍ້ໜ້າວຽກ')
                return
              }
              const ok = await onUpdateTask({
                ...task,
                title: formData.title,
                sub_title: formData.sub_title || '',
                description: formData.description || '',
                estimated_hours: formData.estimated_hours ?? null,
              } as Task)
              if (!ok) {
                setModalError('ບັນທຶກການແກ້ໄຂບໍ່ສຳເລັດ')
                return
              }
              closeModal()
            }}>ບັນທຶກ</button>
          </div>
        </div>
      )
    }

    // --- Assign Task ---
    if (type === 'assignTask') {
      const task = data as Task
      const currentAssigneeId = task?.assigned_to ?? null
      const isReassign = !!task?.assigned_to
      const selectedAssigneeId = formData.assigned_to ?? null
      const assignOptions: SelectOption[] = devUsers
        .filter(u => !isReassign || String(u.id) !== String(currentAssigneeId))
        .map(u => ({ value: u.id, label: u.name }))
      return (
        <div className={CLS.modalBox}>
          <div className={CLS.modalHeader}>
            <div className={CLS.iconWrap} style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>&#128100;</div>
            <h3 className="text-base font-bold font-[var(--font-display,serif)] m-0">{isReassign ? 'ປ່ຽນຜູ້ຮັບວຽກ' : 'ມອບໝາຍໜ້າວຽກ'}</h3>
            <p className="text-slate-400 text-[11px] mt-1">{isReassign ? 'ເລືອກຜູ້ຮັບວຽກຄົນໃໝ່ສຳລັບ' : 'ເລືອກຜູ້ຮັບວຽກສຳລັບ'}: {task?.title}</p>
          </div>
          <div className={CLS.modalBody}>
            {isReassign && (
              <div className={CLS.field}>
                <label className={CLS.fieldLabel}>ຜູ້ຮັບວຽກປັດຈຸບັນ</label>
                <div className={`${CLS.input} flex items-center min-h-[40px]`}>
                  {getUserName(currentAssigneeId, users)}
                </div>
              </div>
            )}
            <div className={CLS.field}><label className={CLS.fieldLabel}>ຜູ້ຮັບວຽກ</label>
              <Select
                styles={selectStyles}
                {...selectPortalProps}
                value={selectedAssigneeId ? { value: selectedAssigneeId, label: getUserName(selectedAssigneeId, users) } : null}
                options={assignOptions}
                onChange={(opt: SelectOption | null) => setFormData({ ...formData, assigned_to: opt?.value })}
                placeholder={isReassign ? 'ເລືອກຄົນໃໝ່...' : 'ເລືອກ...'}
              />
            </div>
            {isReassign && assignOptions.length === 0 && (
              <div className="text-xs text-red-500 mt-1">
                ບໍ່ມີຜູ້ຮັບວຽກຄົນອື່ນໃຫ້ປ່ຽນ
              </div>
            )}
          </div>
          <div className={CLS.modalFooter}>
            <button className={`${CLS.btn} ${CLS.btnCancel}`} onClick={closeModal}>ຍົກເລີກ</button>
            <button className={`${CLS.btn} ${CLS.btnConfirm}`} onClick={async () => {
              if (!formData.assigned_to) return
              await onUpdateTask({
                ...task,
                assigned_to: formData.assigned_to,
                status: 'assigned',
                reject_reason: '',
              } as Task)
              closeModal()
            }}>{isReassign ? 'ປ່ຽນຜູ້ພັດທະນາ' : 'ມອບໝາຍ'}</button>
          </div>
        </div>
      )
    }

    // --- Reject Task ---
    if (type === 'rejectTask') {
      const task = data as Task
      return (
        <div className={CLS.modalBox}>
          <div className={CLS.modalHeader}>
            <div className={CLS.iconWrap} style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)' }}>&#10007;</div>
            <h3 className="text-base font-bold font-[var(--font-display,serif)] m-0">ປະຕິເສດໜ້າວຽກ</h3>
            <p className="text-slate-400 text-[11px] mt-1">ລະບຸເຫດຜົນສຳລັບ: {task?.title}</p>
          </div>
          <div className={CLS.modalBody}>
            <div className={CLS.field}><label className={CLS.fieldLabel}>ເຫດຜົນ *</label>
              <textarea className={CLS.input} rows={4} placeholder="ອະທິບາຍເຫດຜົນ..." onChange={e => setFormData({ ...formData, reject_reason: e.target.value })} />
            </div>
          </div>
          <div className={CLS.modalFooter}>
            <button className={`${CLS.btn} ${CLS.btnCancel}`} onClick={closeModal}>ຍົກເລີກ</button>
            <button className={`${CLS.btn} ${CLS.btnDanger}`} onClick={async () => {
              if (!formData.reject_reason) return
              await onUpdateTask({ ...task, status: 'rejected', reject_reason: formData.reject_reason } as Task)
              closeModal()
            }}>ປະຕິເສດ</button>
          </div>
        </div>
      )
    }

    // --- Delete Task ---
    if (type === 'deleteTask') {
      const task = data as Task
      return (
        <div className={CLS.modalBox}>
          <div className={CLS.modalHeader}>
            <div className={CLS.iconWrap} style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)' }}>&#128465;</div>
            <h3 className="text-base font-bold font-[var(--font-display,serif)] m-0">ລຶບໜ້າວຽກ</h3>
            <p className="text-slate-400 text-[11px] mt-1">ຢືນຢັນການລຶບ: {task?.title}</p>
          </div>
          <div className={CLS.modalBody}>
            <p className="text-[13px] text-slate-400 text-center py-3">
              ຕ້ອງການລຶບໜ້າວຽກນີ້ແທ້ບໍ? ຂໍ້ມູນຈະຖືກລຶບຖາວອນ.
            </p>
            {modalError && <div className="mt-2 text-red-500 text-[11px] font-semibold text-center">{modalError}</div>}
          </div>
          <div className={CLS.modalFooter}>
            <button className={`${CLS.btn} ${CLS.btnCancel}`} type="button" onClick={closeModal}>ຍົກເລີກ</button>
            <button className={`${CLS.btn} ${CLS.btnDanger}`} type="button" onClick={async () => {
              setModalError('')
              const ok = await onDeleteTask(task.id)
              if (!ok) {
                setModalError('ລຶບໜ້າວຽກບໍ່ສຳເລັດ')
                return
              }
              closeModal()
            }}>ລຶບເລີຍ</button>
          </div>
        </div>
      )
    }

    // --- Delete Project ---
    if (type === 'deleteProject') {
      const proj = data as Project
      return (
        <div className={CLS.modalBox}>
          <div className={CLS.modalHeader}>
            <div className={CLS.iconWrap} style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)' }}>&#128465;</div>
            <h3 className="text-base font-bold font-[var(--font-display,serif)] m-0">ລຶບໂຄງການ</h3>
            <p className="text-slate-400 text-[11px] mt-1">ຢືນຢັນການລຶບ: {proj?.title}</p>
          </div>
          <div className={CLS.modalBody}>
            <p className="text-[13px] text-slate-400 text-center py-3">
              ທ່ານແນ່ໃຈບໍ? ການລຶບຈະບໍ່ສາມາດກູ້ຄືນໄດ້.
            </p>
            {modalError && <div className="mt-2 text-red-500 text-[11px] font-semibold text-center">{modalError}</div>}
          </div>
          <div className={CLS.modalFooter}>
            <button className={`${CLS.btn} ${CLS.btnCancel}`} type="button" onClick={closeModal}>ຍົກເລີກ</button>
            <button className={`${CLS.btn} ${CLS.btnDanger}`} type="button" onClick={async () => {
              setModalError('')
              const ok = await onDeleteProject(proj.id)
              if (!ok) {
                setModalError('ລຶບໂຄງການບໍ່ສຳເລັດ')
                return
              }
              setSelectedProjectId(null)
              closeModal()
            }}>ລຶບເລີຍ</button>
          </div>
        </div>
      )
    }

    // --- Complete Project ---
    if (type === 'completeProject') {
      const proj = data as Project
      const pTasks = tasks.filter(t => t.project_id === proj?.id)
      const allDone = pTasks.length > 0 && pTasks.every(t => isTaskCompletedStatus(t.status))
      const incompleteCount = pTasks.filter(t => !isTaskCompletedStatus(t.status)).length
      return (
        <div className={CLS.modalBox}>
          <div className={CLS.modalHeader}>
            <div className={CLS.iconWrap} style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>&#10003;</div>
            <h3 className="text-base font-bold font-[var(--font-display,serif)] m-0">ສຳເລັດໂຄງການ</h3>
            <p className="text-slate-400 text-[11px] mt-1">ຢືນຢັນການສຳເລັດ: {proj?.title}</p>
          </div>
          <div className={CLS.modalBody}>
            {!allDone && (
              <div className="p-3 bg-amber-50 border border-amber-400 rounded-xl mb-3 text-xs text-amber-800">
                &#9888; ຍັງມີ {incompleteCount || pTasks.length} ໜ້າວຽກທີ່ບໍ່ທັນສຳເລັດ. ຕ້ອງໃຫ້ສຳເລັດທັງໝົດກ່ອນ.
              </div>
            )}
            <p className="text-[13px] text-slate-400 text-center py-2">
              {allDone ? 'ໜ້າວຽກທັງໝົດສຳເລັດແລ້ວ. ຕ້ອງການປິດໂຄງການບໍ?' : 'ຍັງບໍ່ສາມາດສຳເລັດໂຄງການໄດ້.'}
            </p>
          </div>
          <div className={CLS.modalFooter}>
            <button className={`${CLS.btn} ${CLS.btnCancel}`} type="button" onClick={closeModal}>ຍົກເລີກ</button>
            <button
              className={`${CLS.btn} ${CLS.btnConfirm}`}
              type="button"
              disabled={!allDone}
              style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}
              onClick={async () => {
                if (!allDone) return
                await handleStatusChange(proj.id, 'completed')
                closeModal()
              }}
            >ສຳເລັດ</button>
          </div>
        </div>
      )
    }

    return null
  }

  // ============================================================
  // DETAIL VIEW
  // ============================================================

  const renderDetailView = (): React.ReactNode => {
    if (!selectedProject) {
      return null
    }
    const proj = selectedProject
    const sCfg = PROJECT_STATUS[proj.status] || { label: proj.status, icon: '?', color: '#6B7280' }
    const currentStepIdx = STEP_INDEX[proj.status] ?? -1
    const progress = getProjectProgress(proj.id)

    const formatDateTime = (value: string | null | undefined): string => {
      if (!value) return '-'
      const d = new Date(value)
      if (Number.isNaN(d.getTime())) return '-'
      return new Intl.DateTimeFormat('lo-LA', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(d)
    }

    return (
      <div className="font-[var(--font-lao,'Noto_Sans_Lao',sans-serif)] min-h-screen text-slate-800 text-[13px] relative w-full overflow-x-hidden">
        <style>{injectCSS}</style>
        <div className="relative z-[1] mx-auto max-w-[1320px] px-3 py-4 sm:px-5 lg:px-6">
          <div className="w-full animate-[shellIn_0.4s_ease-out]">
            <button
              className="mb-4 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold text-slate-500 transition-all duration-200 hover:border-sky-300 hover:bg-sky-50 hover:text-sky-600"
              onClick={() => setSelectedProjectId(null)}
            >&#8592; ກັບຄືນ</button>

            <div className="flex items-start gap-4 max-lg:flex-col">
              {/* ===== LEFT SIDEBAR ===== */}
              <div className="sticky top-5 flex w-[260px] shrink-0 flex-col gap-3.5 max-lg:static max-lg:w-full max-lg:flex-row max-lg:flex-wrap max-lg:[&>*]:min-w-[240px] max-lg:[&>*]:flex-1">
                {/* Project Identity Card */}
                <div className={CLS.detailCard}>
                  <div className="px-[18px] pt-5 pb-4 bg-gradient-to-br from-[rgba(32,81,198,0.07)] to-[rgba(243,91,79,0.04)] border-b border-[rgba(17,24,39,0.06)]">
                    <div className="flex justify-between items-start mb-2">
                      <span className={CLS.eyebrow}>{proj.project_number}</span>
                      <span className={CLS.statusPill} style={{ background: `${sCfg.color}18`, color: sCfg.color, borderColor: sCfg.color }}>
                        {sCfg.icon} {sCfg.label}
                      </span>
                    </div>
                    <div className="text-[17px] font-bold font-[var(--font-display,'Fraunces',serif)] leading-tight mt-1">
                      {proj.title}
                    </div>
                    {proj.description && (
                      <p className="text-slate-400 text-[11.5px] mt-1.5 leading-relaxed">{proj.description}</p>
                    )}
                  </div>

                  {/* Progress Ring */}
                  <div className="px-[18px] py-4 flex items-center gap-3.5 border-b border-[rgba(17,24,39,0.06)]">
                    <svg width="48" height="48" viewBox="0 0 48 48">
                      <circle cx="24" cy="24" r="20" fill="none" stroke="rgba(17,24,39,0.06)" strokeWidth="4" />
                      <circle cx="24" cy="24" r="20" fill="none" stroke="url(#progGrad)" strokeWidth="4"
                        strokeDasharray={`${2 * Math.PI * 20}`}
                        strokeDashoffset={`${2 * Math.PI * 20 * (1 - progress.pct / 100)}`}
                        strokeLinecap="round" transform="rotate(-90 24 24)" className="transition-all duration-600 ease-out" />
                      <defs><linearGradient id="progGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#2051C6" /><stop offset="100%" stopColor="#F35B4F" /></linearGradient></defs>
                      <text x="24" y="24" textAnchor="middle" dominantBaseline="central" fontSize="11" fontWeight="700" fontFamily="var(--font-mono, monospace)" fill="currentColor">{progress.pct}%</text>
                    </svg>
                    <div>
                      <div className="text-[11px] font-bold text-slate-800">ຄວາມຄືບໜ້າ</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{progress.done}/{progress.total} ໜ້າວຽກສຳເລັດ</div>
                    </div>
                  </div>

                  {/* Project Info */}
                  <div className="px-[18px] py-3.5">
                    <div className="flex flex-col gap-2.5">
                      <div className="flex justify-between items-center"><label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">ປະເພດ</label><span className="text-xs font-semibold text-slate-800">{PROJECT_TYPES[proj.type || '']?.icon || ''} {PROJECT_TYPES[proj.type || '']?.label || proj.type || '-'}</span></div>
                      <div className="flex justify-between items-center"><label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">ພະແນກ</label><span className="text-xs font-semibold text-slate-800">{proj.department_name || '-'}</span></div>
                      <div className="flex justify-between items-center"><label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">ຜູ້ຮ້ອງຂໍ</label><span className="text-xs font-semibold text-slate-800">{proj.requester_name || '-'}</span></div>
                      <div className="flex justify-between items-center"><label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">ຫົວໜ້າໂຄງການ</label><span className="text-xs font-semibold text-slate-800">{getUserName(proj.project_lead_id, users)}</span></div>
                      <div className="flex justify-between items-center"><label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">ວັນເລີ່ມ</label><span className="text-[11px] font-semibold text-slate-800 font-mono">{formatDate(proj.start_date)}</span></div>
                      <div className="flex justify-between items-center"><label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">ກຳນົດແລ້ວ</label><span className="text-[11px] font-semibold text-slate-800 font-mono">{formatDate(proj.expected_done_date)}</span></div>
                    </div>
                  </div>
                </div>

                {/* Workflow Steps Card */}
                <div className={CLS.detailCard}>
                  <div className={CLS.detailCardHeader}>
                    <span className="text-xs font-semibold text-slate-800">&#9881; ຂັ້ນຕອນ</span>
                  </div>
                  <div className="px-3.5 py-3">
                    <div className="flex flex-col gap-1">
                      {WORKFLOW_STEPS.map((step, idx) => {
                        const isDone = idx < currentStepIdx
                        const isCurrent = idx === currentStepIdx
                        return (
                          <div key={step.key} className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-[10px] text-[11px] font-semibold ${isCurrent ? 'bg-[rgba(32,81,198,0.08)] text-[#2051C6]' : isDone ? 'bg-emerald-500/[0.06] text-emerald-500' : 'text-slate-400'}`}>
                            <span className={`w-5 h-5 rounded-full grid place-items-center text-[9px] font-bold shrink-0 ${isCurrent ? 'bg-[#2051C6] text-white' : isDone ? 'bg-emerald-500 text-white' : 'bg-[rgba(17,24,39,0.08)] text-slate-400'}`}>
                              {isDone ? '\u2713' : idx + 1}
                            </span>
                            {step.label}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* ===== RIGHT MAIN ===== */}
              <div className="flex-1 min-w-0">
                {/* Kanban tasks for development */}
                {['subtasks', 'development'].includes(proj.status) && (() => {
                  const devTasks = tasks.filter(t => t.project_id === proj.id)
                  const filteredTasks = isProgrammer ? devTasks.filter(t => String(t.assigned_to) === String(user.id)) : devTasks
                  const canMutateTasks = canManageTasks && ['subtasks', 'development'].includes(proj.status)
                  return (
                    <div className={`${CLS.detailCard} mb-4`}>
                      <div className={CLS.detailCardHeader}>
                        <span className="text-xs font-semibold text-slate-800">&#128209; ໜ້າວຽກ ({filteredTasks.length})</span>
                        {canMutateTasks && (
                          <button className={`${CLS.btnMini} ${CLS.btnMiniDefault}`} onClick={() => openCreateTaskModal(proj)}>+ ເພີ່ມໜ້າວຽກ</button>
                        )}
                      </div>
                      {filteredTasks.length > 0 ? (
                        renderKanbanBoard(filteredTasks, proj.status)
                      ) : (
                        <div className="text-center py-10 text-slate-400">
                          <div className="text-4xl mb-2 opacity-50">&#128209;</div>
                          <div className="text-xs">ຍັງບໍ່ມີໜ້າວຽກ</div>
                        </div>
                      )}
                    </div>
                  )
                })()}

                {/* History Timeline */}
                <div className={CLS.detailCard}>
                  <div className={CLS.detailCardHeader}>
                    <span className="text-xs font-semibold text-slate-800">&#128339; ປະຫວັດການດຳເນີນງານ</span>
                  </div>
                  <div className={CLS.detailCardBody}>
                    {historyLoading ? (
                      <p className="text-slate-400 text-xs text-center py-6">ກຳລັງໂຫລດ...</p>
                    ) : historyLogs.length === 0 ? (
                      <p className="text-slate-400 text-xs text-center py-6">ຍັງບໍ່ມີປະຫວັດ</p>
                    ) : (
                      <div className="flex flex-col gap-0 py-1">
                        {historyLogs.map((log, idx) => {
                          const toCfg = PROJECT_STATUS[log.to_status] || { label: log.to_status, icon: '?', color: '#6B7280' }
                          const fromCfg = log.from_status ? (PROJECT_STATUS[log.from_status] || { label: log.from_status, icon: '?', color: '#6B7280' }) : null
                          const isLast = idx === historyLogs.length - 1
                          return (
                            <div key={log.id} className="flex gap-3.5 min-h-[56px]">
                              <div className="flex flex-col items-center w-3.5 shrink-0">
                                <div className="w-3 h-3 rounded-full shrink-0 mt-0.5" style={{ background: toCfg.color, boxShadow: `0 0 0 4px ${toCfg.color}18` }} />
                                {!isLast && <div className="w-0.5 flex-1 bg-[rgba(17,24,39,0.08)] my-1 min-h-[20px]" />}
                              </div>
                              <div className="flex-1 pb-5">
                                <div className="flex items-center gap-1 flex-wrap mb-1">
                                  {fromCfg ? (
                                    <span className="text-xs font-semibold text-slate-800">
                                      <span className={CLS.statusPill} style={{ background: `${fromCfg.color}18`, color: fromCfg.color, borderColor: fromCfg.color, fontSize: 10 }}>
                                        {fromCfg.icon} {fromCfg.label}
                                      </span>
                                      <span className="mx-1.5 text-slate-400">&#8594;</span>
                                      <span className={CLS.statusPill} style={{ background: `${toCfg.color}18`, color: toCfg.color, borderColor: toCfg.color, fontSize: 10 }}>
                                        {toCfg.icon} {toCfg.label}
                                      </span>
                                    </span>
                                  ) : (
                                    <span className={CLS.statusPill} style={{ background: `${toCfg.color}18`, color: toCfg.color, borderColor: toCfg.color, fontSize: 10 }}>
                                      {toCfg.icon} {toCfg.label}
                                    </span>
                                  )}
                                </div>
                                {log.note && <div className="text-xs text-slate-800 font-medium mb-0.5">{log.note}</div>}
                                <div className="text-[10px] text-slate-400 font-mono">
                                  <span>{formatDateTime(log.created_at)}</span>
                                  {log.changed_by_name && <span> &middot; {log.changed_by_name}</span>}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {activeModal.type && (
          <div className={CLS.modalOverlay} onClick={e => e.target === e.currentTarget && closeModal()}>
            {renderModalContent()}
          </div>
        )}
      </div>
    )
  }

  // ============================================================
  // LIST VIEW
  // ============================================================

  if (loading) {
    return (
      <div className="font-[var(--font-lao,'Noto_Sans_Lao',sans-serif)] min-h-screen text-slate-800 text-[13px] relative w-full overflow-x-hidden">
        <style>{injectCSS}</style>
        <div className="relative z-[1] mx-auto max-w-[1320px] px-3 py-4 sm:px-5 lg:px-6">
          <div className="text-center py-20 text-slate-400">
            <div className="text-[13px]">ກຳລັງໂຫລດ...</div>
          </div>
        </div>
      </div>
    )
  }

  if (selectedProjectId) {
    return renderDetailView()
  }

  return (
    <div className="font-[var(--font-lao,'Noto_Sans_Lao',sans-serif)] min-h-screen text-slate-800 text-[13px] relative w-full overflow-x-hidden">
      <style>{injectCSS}</style>
      <div className="relative z-[1] mx-auto max-w-[1320px] px-3 py-4 sm:px-5 lg:px-6">
        <header className="mb-6 fade-up">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-2.5 flex items-center gap-2.5">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-500/25">
                  <FolderKanban size={16} />
                </div>
                <div>
                  <span className="block text-[8px] font-bold uppercase tracking-[0.18em] text-slate-400">IT DEVELOPMENT</span>
                  <h1 className="text-lg font-extrabold leading-none tracking-tight text-slate-900 sm:text-xl">
                    ໂຄງການພັດທະນາ
                  </h1>
                </div>
              </div>
              <p className="max-w-md pl-0.5 text-[11px] text-slate-400">
                ຈັດການໂຄງການ, ຕິດຕາມຄວາມຄືບໜ້າ ແລະ ບໍລິຫານ task ໃນຄິວດຽວ
              </p>
            </div>

            {canManageProject && (
              <button
                className="group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-2.5 text-[11px] font-bold text-white shadow-lg shadow-sky-500/25 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-sky-500/30 active:scale-[0.98] sm:w-auto"
                onClick={openCreateProjectModal}
              >
                <div className="grid h-5 w-5 place-items-center rounded-md bg-white/20">
                  <Plus size={13} strokeWidth={3} />
                </div>
                ສ້າງໂຄງການໃໝ່
                <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
              </button>
            )}
          </div>
        </header>

        <div className="mb-6 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'ໂຄງການທັງໝົດ', value: counts.all, icon: Layers, gradient: 'from-sky-500 to-blue-600' },
            { label: 'ລໍຖ້າເກັບຄວາມຕ້ອງການ', value: counts.requirements, icon: FileText, gradient: 'from-amber-500 to-orange-500' },
            { label: 'ກຳລັງພັດທະນາ', value: counts.development, icon: Activity, gradient: 'from-violet-500 to-purple-600' },
            { label: 'ອັດຕາສຳເລັດ', value: `${completionRate}%`, icon: BarChart3, gradient: 'from-emerald-500 to-green-600' },
          ].map((card, index) => {
            const Icon = card.icon
            return (
              <div key={card.label} className={`fade-up fade-up-${index + 1} group relative overflow-hidden rounded-xl border border-slate-200/60 bg-white p-3.5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-200/50 sm:p-4`}>
                <div className={`absolute -right-7 -top-7 h-20 w-20 rounded-full bg-gradient-to-br ${card.gradient} opacity-[0.07] blur-sm transition-all duration-500 group-hover:scale-125 group-hover:opacity-[0.12]`} />
                <div className="relative">
                  <div className={`mb-2.5 grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br ${card.gradient} text-white shadow-md sm:mb-3 sm:h-8 sm:w-8`}>
                    <Icon size={15} />
                  </div>
                  <div className="text-lg font-extrabold leading-none tracking-tight text-slate-900 sm:text-xl">{card.value}</div>
                  <div className="mt-1 text-[9px] font-semibold uppercase tracking-wide text-slate-400">{card.label}</div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="flex gap-4 fade-up fade-up-3">
          <div className="sticky top-5 hidden w-[184px] shrink-0 self-start rounded-xl border border-slate-200/60 bg-white p-2.5 shadow-sm lg:flex lg:flex-col lg:gap-1">
            <span className="px-2.5 pb-1.5 pt-0.5 text-[8px] font-bold uppercase tracking-wider text-slate-400">ສະຖານະ</span>
            {statusTabs.map((tab) => {
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  className={`relative flex w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-[10px] font-semibold transition-all duration-200 ${
                    isActive ? 'text-white shadow-md' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                  }`}
                  style={isActive ? {
                    background: `linear-gradient(135deg, ${tab.color}, ${tab.id === 'all' ? '#2563eb' : tab.color})`,
                    boxShadow: `0 4px 12px -2px ${tab.color}40`,
                  } : undefined}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <span className="h-2 w-2 shrink-0 rounded-full bg-current opacity-80" />
                  <span className="flex-1 text-left">{tab.label}</span>
                  <span className={`min-w-[18px] rounded-md px-1.5 py-0.5 text-center text-[8px] font-bold ${
                    isActive ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {tab.count}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="min-w-0 flex-1">
            <div className="ticket-scroll flex items-center gap-1.5 overflow-x-auto px-1 pb-4 lg:hidden">
              {statusTabs.map((tab) => {
                const isActive = activeTab === tab.id
                return (
                  <button
                    key={tab.id}
                    type="button"
                    className={`relative flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-2.5 py-1.5 text-[10px] font-semibold transition-all duration-200 ${
                      isActive
                        ? 'text-white shadow-md'
                        : 'border border-slate-200/60 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                    }`}
                    style={isActive ? {
                      background: `linear-gradient(135deg, ${tab.color}, ${tab.id === 'all' ? '#2563eb' : tab.color})`,
                      boxShadow: `0 4px 12px -2px ${tab.color}40`,
                    } : undefined}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    <span className="h-2 w-2 shrink-0 rounded-full bg-current opacity-80" />
                    {tab.label}
                    <span className={`min-w-[18px] rounded-md px-1.5 py-0.5 text-center text-[8px] font-bold ${
                      isActive ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {tab.count}
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="mb-4 rounded-xl border border-slate-200/60 bg-white px-3 py-3 shadow-sm sm:px-3.5">
              <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative flex-1 sm:max-w-md">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
                  <input
                    value={search}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50/50 py-2 pl-9 pr-3 text-[11px] text-slate-700 outline-none transition-all duration-200 placeholder:text-slate-300 focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-400/10"
                    placeholder="ຄົ້ນຫາດ້ວຍຫົວຂໍ້ ຫຼື ເລກໂຄງການ..."
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                <div className="flex flex-wrap items-center gap-1.5 text-[9px] font-semibold">
                  <span className="rounded-md bg-slate-100 px-2.5 py-1 text-slate-500">
                    {filteredProjects.length} ໂຄງການ
                  </span>
                  <span className="rounded-md bg-sky-50 px-2.5 py-1 text-sky-600">
                    {counts.development} ກຳລັງພັດທະນາ
                  </span>
                  {search.trim() && (
                    <span className="rounded-md bg-amber-50 px-2.5 py-1 text-amber-600">
                      &quot;{search.trim()}&quot;
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="fade-up fade-up-4">
              {filteredProjects.length > 0 ? (
                <div className="space-y-2.5">
                  {filteredProjects.map((proj) => {
                    const sCfg = PROJECT_STATUS[proj.status] || { label: proj.status, icon: '❔', color: '#6B7280' }
                    const typeCfg = PROJECT_TYPES[proj.type || ''] || { label: proj.type || '-', icon: '•', color: '#94a3b8' }
                    const progress = getProjectProgress(proj.id)
                    const isExpanded = expandedProjectId === proj.id
                    const isDev = ['subtasks', 'development'].includes(proj.status)
                    const pTasks = isExpanded && isDev ? (() => {
                      const all = tasks.filter(t => t.project_id === proj.id)
                      if (!isProgrammer) return all
                      return all.filter(t => String(t.assigned_to) === String(user.id))
                    })() : []
                    const canMutateTheseTasks = canManageTasks && isDev

                    return (
                      <div
                        key={proj.id}
                        className={`group relative overflow-hidden rounded-xl border bg-white transition-all duration-200 ${
                          isExpanded
                            ? 'border-slate-300 shadow-lg shadow-slate-200/50'
                            : 'border-slate-200/60 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-200/40'
                        }`}
                      >
                        <div className="absolute bottom-0 left-0 top-0 w-1 rounded-l-xl" style={{ background: sCfg.color }} />

                        <div
                          className="flex cursor-pointer flex-col gap-3 p-3 pl-[16px] sm:flex-row sm:items-center sm:gap-4 sm:p-4 sm:pl-5"
                          onClick={() => setSelectedProjectId(proj.id)}
                        >
                          <div className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-sm sm:flex">
                            <FolderKanban size={15} />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="mb-1 flex flex-wrap items-start gap-2">
                              <span className="shrink-0 rounded-md bg-sky-50 px-1.5 py-0.5 font-mono text-[8px] font-bold text-sky-500">
                                #{proj.project_number || proj.id}
                              </span>
                              <span className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-2 py-0.5 text-[8px] font-bold text-slate-500">
                                <span style={{ color: typeCfg.color }}>{typeCfg.icon}</span> {typeCfg.label}
                              </span>
                              <span
                                className="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[8px] font-bold sm:hidden"
                                style={{ background: `${sCfg.color}14`, color: sCfg.color, borderColor: `${sCfg.color}40` }}
                              >
                                {sCfg.icon} {sCfg.label}
                              </span>
                            </div>
                            <h3 className="truncate text-[11px] font-bold leading-snug text-slate-900 transition-colors group-hover:text-sky-700">
                              {proj.title}
                            </h3>
                            <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
                              <span className="text-[9px] text-slate-500">{proj.department_name || '-'}</span>
                              <span className="text-[9px] text-slate-400">{proj.requester_name || '-'}</span>
                              <span className="hidden text-[9px] text-slate-400 sm:inline">
                                Lead · {getUserName(proj.project_lead_id, users)}
                              </span>
                            </div>
                          </div>

                          <div className="flex w-full shrink-0 flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap sm:gap-3">
                            <div className="hidden min-w-[72px] text-right md:block">
                              <div className="text-[8px] font-medium text-slate-400">ຫົວໜ້າ</div>
                              <div className="mt-0.5 text-[10px] font-semibold text-slate-700">
                                {getUserName(proj.project_lead_id, users)}
                              </div>
                            </div>

                            <div className="min-w-[96px] rounded-lg bg-slate-50 px-2.5 py-1.5">
                              <div className="mb-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                                <div
                                  className="h-full rounded-full bg-gradient-to-r from-sky-500 to-blue-600 transition-[width] duration-500"
                                  style={{ width: `${progress.pct}%` }}
                                />
                              </div>
                              <div className="text-[8px] font-bold text-slate-500">
                                {progress.done}/{progress.total} ({progress.pct}%)
                              </div>
                            </div>

                            <span
                              className="hidden whitespace-nowrap rounded-lg border px-2 py-0.5 text-[8px] font-bold sm:inline-flex sm:items-center sm:gap-1.5"
                              style={{ background: `${sCfg.color}14`, color: sCfg.color, borderColor: `${sCfg.color}40` }}
                            >
                              <span>{sCfg.icon}</span> {sCfg.label}
                            </span>

                            <div className="ml-auto flex w-full flex-wrap items-center justify-end gap-1 transition-opacity duration-200 sm:ml-0 sm:w-auto sm:flex-nowrap sm:justify-start sm:opacity-0 sm:group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
                              {canManageProject && proj.status === 'registered' && (
                                <button className={`${CLS.btnMini} ${CLS.btnMiniOrange}`} type="button" onClick={() => openRequirementsModal(proj)}>ຄວາມຕ້ອງການ</button>
                              )}
                              {canManageProject && proj.status === 'requirements' && (
                                <button className={`${CLS.btnMini} ${CLS.btnMiniGreen}`} type="button" onClick={async () => {
                                  await handleStatusChange(proj.id, 'subtasks')
                                  setExpandedProjectId(proj.id)
                                }}>ກຳນົດ Task</button>
                              )}
                              {canManageProject && proj.status === 'subtasks' && (
                                <button className={`${CLS.btnMini} ${CLS.btnMiniGreen}`} type="button" onClick={() => handleStatusChange(proj.id, 'development')}>ເລີ່ມພັດທະນາ</button>
                              )}
                              {canManageProject && proj.status === 'development' && (
                                <button className={`${CLS.btnMini} ${CLS.btnMiniGreen}`} type="button" disabled={!canCompleteProject(proj.id)} onClick={() => {
                                  if (canCompleteProject(proj.id)) setActiveModal({ type: 'completeProject', data: proj })
                                }}>ສຳເລັດ</button>
                              )}
                              {isManager && proj.status === 'completed' && (
                                <button className={`${CLS.btnMini} ${CLS.btnMiniOrange}`} type="button" onClick={() => handleStatusChange(proj.id, 'development')}>ເປີດໃໝ່</button>
                              )}
                              {canManageProject && (
                                <button className={`${CLS.btnMini} ${CLS.btnMiniOrange}`} type="button" onClick={() => openEditProjectModal(proj)}>ແກ້ໄຂ</button>
                              )}
                              {canDeleteProject && (
                                <button className={`${CLS.btnMini} ${CLS.btnMiniRed}`} type="button" onClick={() => openDeleteProjectModal(proj)}>ລຶບ</button>
                              )}
                            </div>

                            {isDev && (
                              <button
                                type="button"
                                className={`ml-auto grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-slate-200 bg-white transition-all duration-300 sm:ml-0 ${isExpanded ? 'rotate-180 border-sky-300 bg-sky-50 text-sky-600' : 'text-slate-400'}`}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setExpandedProjectId(isExpanded ? null : proj.id)
                                }}
                              >
                                <ChevronDown size={13} />
                              </button>
                            )}
                          </div>
                        </div>

                        {isExpanded && isDev && (
                          <div className="border-t border-slate-100">
                            <div className="px-4 pb-5 pt-4 sm:px-5">
                              <div className="mb-3 flex items-center justify-between gap-2">
                                <span className="text-[11px] font-bold text-slate-800">ໜ້າວຽກ ({pTasks.length})</span>
                                {canMutateTheseTasks && (
                                  <button className={`${CLS.btnMini} ${CLS.btnMiniDefault}`} type="button" onClick={() => openCreateTaskModal(proj)}>+ ເພີ່ມໜ້າວຽກ</button>
                                )}
                              </div>
                              {pTasks.length > 0 ? (
                                renderKanbanBoard(pTasks, proj.status)
                              ) : (
                                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 py-8 text-center text-slate-400">
                                  <div className="mb-2 text-3xl opacity-50">&#128209;</div>
                                  <div className="text-[11px]">ຍັງບໍ່ມີໜ້າວຽກ</div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200/60 bg-white p-8 text-center sm:p-10">
                  <div className="mx-auto mb-3.5 grid h-12 w-12 place-items-center rounded-xl bg-slate-100">
                    <FolderKanban size={22} className="text-slate-300" />
                  </div>
                  <h3 className="mb-1 text-sm font-bold text-slate-700">ບໍ່ພົບໂຄງການ</h3>
                  <p className="mx-auto max-w-xs text-[11px] text-slate-400">
                    ລອງປ່ຽນ filter ຫຼື ລ້າງຄຳຄົ້ນຫາເພື່ອເບິ່ງໂຄງການອື່ນໆ
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {activeModal.type && (
        <div className={CLS.modalOverlay} onClick={e => e.target === e.currentTarget && closeModal()}>
          {renderModalContent()}
        </div>
      )}
    </div>
  )
}
