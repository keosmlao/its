import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type MouseEvent,
  type ReactNode,
} from 'react'
import Select from 'react-select'
import type { SingleValue, StylesConfig } from 'react-select'
import {
  Activity,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Clock,
  HandMetal,
  Layers,
  Package,
  Pencil,
  Plus,
  Search,
  TicketIcon,
  Timer,
  Trash2,
  UserPlus,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import api from '../lib/api'
import { getStoredUser } from '../lib/auth'
import { MANAGER_ROLES } from '../lib/roles'

interface User {
  id: number | string
  role: string
  name?: string
}

interface Ticket {
  id: number
  ticket_number?: string | null
  title: string
  description?: string | null
  status: string
  priority?: string | null
  category_id?: number | string | null
  division_code?: string | null
  division_name?: string | null
  department_code?: string | null
  department_name?: string | null
  requester_code?: string | null
  requester_name?: string | null
  assignee_id?: number | string | null
  assignee_name?: string | null
  close_reason?: string | null
  spare_part_date?: string | null
  expected_done_date?: string | null
  created_at?: string | null
  updated_at?: string | null
  closed_at?: string | null
}

interface Division {
  code: string
  name: string
}

interface Department {
  code: string
  name: string
}

interface Requester {
  code: string
  name: string
  division_code?: string | null
  department_code?: string | null
}

interface Category {
  id: number | string
  name: string
}

interface SystemUser {
  id: number | string
  username?: string
  name?: string
  role?: string
}

interface SelectOption {
  value: string | number
  label: string
}

interface StatusConfig {
  label: string
  icon: LucideIcon
  dot: string
  text: string
  border: string
  bg: string
  gradient: string
}

interface PriorityConfig {
  label: string
  dot: string
  color: string
  emoji: string
}

interface StatusLogRecord {
  id: number
  from_status: string | null
  to_status: string
  note: string | null
  created_at: string
  changed_by_name: string | null
  changed_by_username: string | null
}

interface TicketHistory {
  ticket: {
    id: number
    title: string
    status: string
    priority: string
    created_at: string
    updated_at: string | null
    closed_at: string | null
    requester_name: string | null
    assignee_id: number | null
  }
  statusLogs: StatusLogRecord[]
}

interface Resources {
  divisions: Division[]
  departments: Department[]
  requesters: Requester[]
  categories: Category[]
  users: SystemUser[]
}

type ModalType = 'create' | 'edit' | 'close' | 'waiting' | 'delete' | 'assign' | null

interface ModalState {
  type: ModalType
  ticket: Ticket | null
}

interface TicketFormData {
  title?: string
  category_id?: number | string | null
  division_code?: string
  division_name?: string
  department_code?: string
  department_name?: string
  requester_code?: string
  requester_name?: string
  description?: string
  reason?: string
  spare_part_date?: string
  expected_done_date?: string
  assignee_id?: number | string
  [key: string]: unknown
}

const ticketCSS = `
@keyframes ticketFadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
@keyframes accordionIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
@keyframes overlayIn{from{opacity:0}to{opacity:1}}
.fade-up{opacity:0;animation:ticketFadeUp .42s ease forwards}
.fade-up-1{animation-delay:.04s}
.fade-up-2{animation-delay:.08s}
.fade-up-3{animation-delay:.12s}
.fade-up-4{animation-delay:.16s}
.accordion-enter{animation:accordionIn .22s ease-out}
.ticket-scroll::-webkit-scrollbar{height:6px}
.ticket-scroll::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:999px}
.dm-timeline{position:relative;padding-left:18px}
.dm-timeline::before{content:'';position:absolute;left:5px;top:8px;bottom:8px;width:2px;background:linear-gradient(180deg,#dbeafe 0%,#e2e8f0 100%);border-radius:999px}
@media (prefers-reduced-motion: reduce){
  .fade-up,.accordion-enter{animation:none;opacity:1;transform:none}
}
`

const STATUS_CONFIG: Record<string, StatusConfig> = {
  open: {
    label: 'ລໍຖ້າມອບໝາຍ',
    icon: CircleDot,
    dot: '#0ea5e9',
    text: '#0369a1',
    border: '#7dd3fc',
    bg: 'rgba(14, 165, 233, 0.08)',
    gradient: 'from-sky-500 to-blue-600',
  },
  assigned: {
    label: 'ຈັດຊ່າງແລ້ວ',
    icon: UserPlus,
    dot: '#f59e0b',
    text: '#b45309',
    border: '#fcd34d',
    bg: 'rgba(245, 158, 11, 0.09)',
    gradient: 'from-amber-500 to-orange-500',
  },
  accepted: {
    label: 'ຮັບງານແລ້ວ',
    icon: HandMetal,
    dot: '#14b8a6',
    text: '#0f766e',
    border: '#5eead4',
    bg: 'rgba(20, 184, 166, 0.09)',
    gradient: 'from-teal-500 to-cyan-500',
  },
  in_progress: {
    label: 'ກຳລັງດຳເນີນ',
    icon: Activity,
    dot: '#8b5cf6',
    text: '#6d28d9',
    border: '#c4b5fd',
    bg: 'rgba(139, 92, 246, 0.09)',
    gradient: 'from-violet-500 to-purple-600',
  },
  waiting: {
    label: 'ລໍຖ້າອາໄຫຼ່',
    icon: Package,
    dot: '#ec4899',
    text: '#be185d',
    border: '#f9a8d4',
    bg: 'rgba(236, 72, 153, 0.09)',
    gradient: 'from-pink-500 to-rose-500',
  },
  closed: {
    label: 'ສຳເລັດ',
    icon: CheckCircle2,
    dot: '#10b981',
    text: '#047857',
    border: '#6ee7b7',
    bg: 'rgba(16, 185, 129, 0.09)',
    gradient: 'from-emerald-500 to-green-600',
  },
}

const PRIORITY_CONFIG: Record<string, PriorityConfig> = {
  low: { label: 'ຕ່ຳ', dot: '#94a3b8', color: '#64748b', emoji: '·' },
  medium: { label: 'ກາງ', dot: '#3b82f6', color: '#1d4ed8', emoji: '•' },
  high: { label: 'ສູງ', dot: '#f59e0b', color: '#b45309', emoji: '▲' },
  critical: { label: 'ວິກິດ', dot: '#ef4444', color: '#dc2626', emoji: '!' },
}

const selectStyles: StylesConfig<SelectOption, false> = {
  control: (base, state) => ({
    ...base,
    minHeight: 36,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    borderColor: state.isFocused ? '#38bdf8' : '#e2e8f0',
    boxShadow: state.isFocused ? '0 0 0 3px rgba(56, 189, 248, 0.08)' : 'none',
    ':hover': { borderColor: '#38bdf8' },
    fontSize: 12,
    fontFamily: '"Noto Sans Lao", sans-serif',
  }),
  menu: (base) => ({
    ...base,
    borderRadius: 10,
    overflow: 'hidden',
    border: '1px solid #e2e8f0',
    boxShadow: '0 10px 30px -8px rgba(15, 23, 42, 0.12)',
    fontFamily: '"Noto Sans Lao", sans-serif',
  }),
  option: (base, state) => ({
    ...base,
    fontSize: 12,
    fontFamily: '"Noto Sans Lao", sans-serif',
    backgroundColor: state.isFocused ? 'rgba(56, 189, 248, 0.06)' : 'white',
    color: '#0f172a',
  }),
  placeholder: (base) => ({
    ...base,
    fontSize: 11,
  }),
  singleValue: (base) => ({
    ...base,
    fontSize: 12,
  }),
}

const getStatusKey = (value: string | null | undefined) => String(value || '').trim().toLowerCase()

const formatElapsed = (start?: string | null, end: string | number | Date | null = Date.now()): string => {
  if (!start) return '-'
  const diff = Math.max(0, new Date(end as string | number).getTime() - new Date(start).getTime())
  const totalSec = Math.floor(diff / 1000)
  const mins = Math.floor(totalSec / 60)
  if (mins < 60) return `${mins}m ${totalSec % 60}s`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ${mins % 60}m`
  return `${Math.floor(hrs / 24)}d ${hrs % 24}h`
}

const selectOptionByValue = (
  options: SelectOption[],
  value: string | number | null | undefined
): SelectOption | null => {
  if (value === undefined || value === null || value === '') return null
  return options.find((opt) => String(opt.value) === String(value)) || null
}

const inputClass =
  'w-full rounded-lg border border-slate-200/80 bg-white px-3 py-2 text-[12px] text-slate-800 transition-all duration-200 placeholder:text-slate-300 focus:border-sky-400 focus:outline-none focus:ring-4 focus:ring-sky-400/10'

interface ModalShellProps {
  icon: LucideIcon
  title: string
  subtitle?: string
  iconClassName: string
  children: ReactNode
}

const ModalShell = ({ icon: Icon, title, subtitle, iconClassName, children }: ModalShellProps) => (
  <div
    className="my-auto w-full max-w-[480px] overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-2xl shadow-slate-900/15"
    style={{ animation: 'accordionIn 0.22s ease-out' }}
  >
    <div className="relative border-b border-slate-100 px-4 pb-3 pt-4 sm:px-5 sm:pb-3.5">
      <div className="flex items-start gap-2.5 sm:gap-3">
        <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg text-white shadow-md ${iconClassName}`}>
          <Icon size={16} />
        </div>
        <div className="min-w-0">
          <h3 className="text-[14px] font-bold text-slate-900">{title}</h3>
          {subtitle && <p className="mt-0.5 text-[10px] text-slate-400">{subtitle}</p>}
        </div>
      </div>
    </div>
    {children}
  </div>
)

const ModalField = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="mb-3">
    <label className="mb-1.5 block text-[9px] font-bold uppercase tracking-wider text-slate-400">{label}</label>
    {children}
  </div>
)

interface ModalFooterProps {
  confirmLabel: string
  confirmClassName?: string
  onCancel: () => void
  onConfirm: () => void
  confirmDisabled?: boolean
}

const ModalFooter = ({
  confirmLabel,
  confirmClassName,
  onCancel,
  onConfirm,
  confirmDisabled,
}: ModalFooterProps) => (
  <div className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50/70 px-4 py-3 sm:flex-row sm:px-5 sm:py-3.5">
    <button
      type="button"
      className="flex-1 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-[11px] font-semibold text-slate-500 transition-all duration-200 hover:border-slate-300 hover:bg-slate-50"
      onClick={onCancel}
    >
      ຍົກເລີກ
    </button>
    <button
      type="button"
      disabled={confirmDisabled}
      className={`flex-1 rounded-lg px-3.5 py-2 text-[11px] font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 ${confirmClassName || 'bg-gradient-to-r from-sky-500 to-blue-600'}`}
      onClick={onConfirm}
    >
      {confirmLabel}
    </button>
  </div>
)

export default function TicketsPage() {
  const PAGE_SIZE = 10
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [activeTab, setActiveTab] = useState<string>('all')
  const [tick, setTick] = useState(0)
  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [activeModal, setActiveModal] = useState<ModalState>({ type: null, ticket: null })
  const [formData, setFormData] = useState<TicketFormData>({})
  const [historyData, setHistoryData] = useState<TicketHistory | null>(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [expandedTicketId, setExpandedTicketId] = useState<number | null>(null)
  const [divisionDepartments, setDivisionDepartments] = useState<Department[]>([])
  const [resources, setResources] = useState<Resources>({
    divisions: [],
    departments: [],
    requesters: [],
    categories: [],
    users: [],
  })

  const user = useMemo<User>(() => getStoredUser() || { id: 0, role: '' }, [])
  const role = useMemo(() => String(user.role || '').toLowerCase(), [user])
  const isManager = useMemo(() => MANAGER_ROLES.includes(role), [role])
  const isHelpdesk = role === 'helpdesk'
  const isSupport = role === 'it_support' || role === 'helpdesk'
  const isPersonalAssigneeRole = ['it_support', 'programmer', 'programer', 'lead_programmer'].includes(role)
  const canAssignTickets = isHelpdesk || isManager
  const canEditOrDeleteTicket = canAssignTickets
  const now = useMemo(() => Date.now(), [tick])

  useEffect(() => {
    const timer = window.setInterval(() => setTick((prev) => prev + 1), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const fetchData = useCallback(async () => {
    try {
      const [ticketRes, divisionRes, departmentRes, requesterRes, categoryRes, userRes] = await Promise.all([
        api.listTickets(),
        api.listDivisions(),
        api.listDepartments(),
        api.listRequesters(),
        api.listCategories(),
        canAssignTickets ? api.listUsers() : Promise.resolve({ data: [] }),
      ])
      setTickets(ticketRes.data || [])
      setResources({
        divisions: divisionRes.data || [],
        departments: departmentRes.data || [],
        requesters: requesterRes.data || [],
        categories: categoryRes.data || [],
        users: userRes.data || [],
      })
    } catch (error) {
      console.error(error)
    }
  }, [canAssignTickets])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const categoryMap = useMemo(
    () => new Map((resources.categories || []).map((item) => [String(item.id), item.name])),
    [resources.categories]
  )

  const categoryOptions = useMemo<SelectOption[]>(
    () => resources.categories.map((item) => ({ value: item.id, label: item.name })),
    [resources.categories]
  )

  const divisionOptions = useMemo<SelectOption[]>(
    () => resources.divisions.map((item) => ({ value: item.code, label: item.name })),
    [resources.divisions]
  )

  useEffect(() => {
    const modalType = activeModal.type
    const divisionCode = String(formData.division_code || '').trim()

    if (modalType !== 'create' && modalType !== 'edit') {
      setDivisionDepartments([])
      return
    }

    if (!divisionCode) {
      setDivisionDepartments(resources.departments)
      return
    }

    let cancelled = false

    api.listDepartmentsByDivision(divisionCode)
      .then((response) => {
        if (!cancelled) {
          setDivisionDepartments(Array.isArray(response.data) ? response.data : [])
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDivisionDepartments([])
        }
      })

    return () => {
      cancelled = true
    }
  }, [activeModal.type, formData.division_code, resources.departments])

  const availableDepartments = useMemo<Department[]>(() => {
    const base = String(formData.division_code || '').trim() ? divisionDepartments : resources.departments
    const currentCode = String(formData.department_code || '').trim()
    const currentName = String(formData.department_name || '').trim()

    if (!currentCode || base.some((item) => String(item.code) === currentCode)) return base

    return [{ code: currentCode, name: currentName || currentCode }, ...base]
  }, [divisionDepartments, formData.department_code, formData.department_name, formData.division_code, resources.departments])

  const departmentOptions = useMemo<SelectOption[]>(
    () => availableDepartments.map((item) => ({ value: item.code, label: item.name })),
    [availableDepartments]
  )

  const availableRequesters = useMemo<Requester[]>(() => {
    const divisionCode = String(formData.division_code || '').trim()
    const departmentCode = String(formData.department_code || '').trim()
    const filteredRequesters = resources.requesters.filter((item) => {
      if (divisionCode && String(item.division_code || '') !== divisionCode) return false
      if (departmentCode && String(item.department_code || '') !== departmentCode) return false
      return true
    })

    const currentCode = String(formData.requester_code || '').trim()
    const currentName = String(formData.requester_name || '').trim()

    if (!currentCode || filteredRequesters.some((item) => String(item.code) === currentCode)) return filteredRequesters

    return [
      {
        code: currentCode,
        name: currentName || currentCode,
        division_code: divisionCode || null,
        department_code: departmentCode || null,
      },
      ...filteredRequesters,
    ]
  }, [
    formData.department_code,
    formData.division_code,
    formData.requester_code,
    formData.requester_name,
    resources.requesters,
  ])

  const requesterOptions = useMemo<SelectOption[]>(
    () => availableRequesters.map((item) => ({ value: item.code, label: item.name })),
    [availableRequesters]
  )

  const userOptions = useMemo<SelectOption[]>(
    () =>
      resources.users
        .filter((item) => {
          const itemRole = String(item.role || '').toLowerCase()
          const allowedRoles = isManager
            ? ['helpdesk', 'it_support', 'programmer', 'programer', 'lead_programmer', 'manager', 'superviser']
            : ['it_support', 'programmer', 'programer', 'lead_programmer', 'manager', 'superviser']
          return allowedRoles.includes(itemRole)
        })
        .map((item) => ({
          value: item.id,
          label: `${item.name || item.username || `User ${item.id}`} (${item.role || '-'})`,
        })),
    [isManager, resources.users]
  )

  const scopedTickets = useMemo(
    () => (isPersonalAssigneeRole ? tickets.filter((item) => String(item.assignee_id) === String(user.id)) : tickets),
    [isPersonalAssigneeRole, tickets, user.id]
  )

  const counts = useMemo(
    () => ({
      all: scopedTickets.length,
      open: scopedTickets.filter((item) => getStatusKey(item.status) === 'open').length,
      assigned: scopedTickets.filter((item) => getStatusKey(item.status) === 'assigned').length,
      accepted: scopedTickets.filter((item) => getStatusKey(item.status) === 'accepted').length,
      in_progress: scopedTickets.filter((item) => getStatusKey(item.status) === 'in_progress').length,
      waiting: scopedTickets.filter((item) => getStatusKey(item.status) === 'waiting').length,
      closed: scopedTickets.filter((item) => getStatusKey(item.status) === 'closed').length,
    }),
    [scopedTickets]
  )

  const visibleUrgentCount = useMemo(
    () =>
      scopedTickets.filter((item) => {
        const priority = String(item.priority || '').toLowerCase()
        return priority === 'high' || priority === 'critical'
      }).length,
    [scopedTickets]
  )

  const activeWorkCount = useMemo(
    () =>
      scopedTickets.filter((item) => {
        const status = getStatusKey(item.status)
        return status === 'accepted' || status === 'in_progress' || status === 'waiting'
      }).length,
    [scopedTickets]
  )

  const resolutionRate = useMemo(
    () => (scopedTickets.length > 0 ? Math.round((counts.closed / scopedTickets.length) * 100) : 0),
    [counts.closed, scopedTickets.length]
  )

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    const bySearch = scopedTickets.filter((item) => {
      if (!query) return true
      const haystack = [
        item.title,
        item.ticket_number,
        item.requester_name,
        item.division_name,
        item.department_name,
        categoryMap.get(String(item.category_id || '')),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(query)
    })

    if (activeTab === 'all') return bySearch
    return bySearch.filter((item) => getStatusKey(item.status) === activeTab)
  }, [activeTab, categoryMap, scopedTickets, search])

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)), [filtered.length])
  const activePageNumber = Math.min(currentPage, totalPages)

  useEffect(() => {
    setCurrentPage(1)
  }, [activeTab, search])

  useEffect(() => {
    setCurrentPage((prev) => Math.min(prev, totalPages))
  }, [totalPages])

  const paginatedTickets = useMemo(() => {
    const start = (activePageNumber - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [activePageNumber, filtered])

  const pageStart = filtered.length === 0 ? 0 : (activePageNumber - 1) * PAGE_SIZE + 1
  const pageEnd = Math.min(activePageNumber * PAGE_SIZE, filtered.length)

  const visiblePages = useMemo(() => {
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, index) => index + 1)
    const start = Math.max(1, Math.min(activePageNumber - 2, totalPages - 4))
    return Array.from({ length: 5 }, (_, index) => start + index)
  }, [activePageNumber, totalPages])

  const scopeLabel = isManager
    ? 'MANAGER VIEW'
    : isHelpdesk
      ? 'HELPDESK DESK'
      : isPersonalAssigneeRole
        ? 'MY WORK QUEUE'
        : 'TICKET CENTER'

  const closeModal = useCallback(() => {
    setActiveModal({ type: null, ticket: null })
    setFormData({})
  }, [])

  const openCreateModal = () => {
    setFormData({})
    setActiveModal({ type: 'create', ticket: null })
  }

  const openEditModal = (ticket: Ticket) => {
    setFormData({
      title: ticket.title || '',
      category_id: ticket.category_id ?? null,
      division_code: ticket.division_code || '',
      division_name: ticket.division_name || '',
      department_code: ticket.department_code || '',
      department_name: ticket.department_name || '',
      requester_code: ticket.requester_code || '',
      requester_name: ticket.requester_name || '',
      description: ticket.description || '',
    })
    setActiveModal({ type: 'edit', ticket })
  }

  const openCloseModal = (ticket: Ticket) => {
    setFormData({ reason: ticket.close_reason || '' })
    setActiveModal({ type: 'close', ticket })
  }

  const openWaitingModal = (ticket: Ticket) => {
    setFormData({
      spare_part_date: ticket.spare_part_date || '',
      expected_done_date: ticket.expected_done_date || '',
    })
    setActiveModal({ type: 'waiting', ticket })
  }

  const openAssignModal = (ticket: Ticket) => {
    setFormData({ assignee_id: ticket.assignee_id || '' })
    setActiveModal({ type: 'assign', ticket })
  }

  const toggleAccordion = useCallback(
    async (ticket: Ticket) => {
      if (expandedTicketId === ticket.id) {
        setExpandedTicketId(null)
        setHistoryData(null)
        setHistoryLoading(false)
        return
      }

      setExpandedTicketId(ticket.id)
      setHistoryLoading(true)

      try {
        const response = await api.getTicketHistory(ticket.id)
        setHistoryData(response.data || null)
      } catch (error) {
        console.error('History fetch error:', error)
        setHistoryData(null)
      } finally {
        setHistoryLoading(false)
      }
    },
    [expandedTicketId]
  )

  const buildTicketPayload = () => ({
    title: String(formData.title || '').trim(),
    category_id: formData.category_id ?? null,
    division_code: String(formData.division_code || '').trim() || null,
    division_name: String(formData.division_name || '').trim() || null,
    department_code: String(formData.department_code || '').trim() || null,
    department_name: String(formData.department_name || '').trim() || null,
    requester_code: String(formData.requester_code || '').trim() || null,
    requester_name: String(formData.requester_name || '').trim() || null,
    expected_done_date: String(formData.expected_done_date || '').trim() || null,
    description: String(formData.description || '').trim() || null,
  })

  const handleCreate = async () => {
    const payload = buildTicketPayload()
    if (!payload.title) return

    try {
      await api.createTicket(payload)
      closeModal()
      fetchData()
    } catch (error) {
      console.error(error)
    }
  }

  const handleEdit = async () => {
    if (!activeModal.ticket) return
    const payload = buildTicketPayload()
    if (!payload.title || !payload.description) return

    try {
      await api.updateTicket(activeModal.ticket.id, payload)
      closeModal()
      fetchData()
    } catch (error) {
      console.error(error)
    }
  }

  const handleClose = async () => {
    if (!activeModal.ticket) return

    try {
      await api.updateTicketStatus(activeModal.ticket.id, {
        status: 'closed',
        close_reason: String(formData.reason || '').trim() || null,
      })
      closeModal()
      fetchData()
    } catch (error) {
      console.error(error)
    }
  }

  const handleWaiting = async () => {
    if (!activeModal.ticket) return

    try {
      await api.updateTicketStatus(activeModal.ticket.id, {
        status: 'waiting',
        spare_part_date: String(formData.spare_part_date || '').trim() || null,
        expected_done_date: String(formData.expected_done_date || '').trim() || null,
      })
      closeModal()
      fetchData()
    } catch (error) {
      console.error(error)
    }
  }

  const handleDelete = async () => {
    if (!activeModal.ticket) return

    try {
      await api.deleteTicket(activeModal.ticket.id)
      closeModal()
      fetchData()
    } catch (error) {
      console.error(error)
    }
  }

  const handleAssign = async () => {
    if (!activeModal.ticket || !formData.assignee_id) return

    try {
      await api.assignTicket(activeModal.ticket.id, { assignee_id: Number(formData.assignee_id) })
      closeModal()
      fetchData()
    } catch (error) {
      console.error(error)
    }
  }

  const renderModalContent = () => {
    if (!activeModal.type) return null

    if (activeModal.type === 'create') {
      return (
        <ModalShell
          icon={Plus}
          title="ສ້າງບັດແຈ້ງໃໝ່"
          subtitle="ປ້ອນຂໍ້ມູນພື້ນຖານໃຫ້ຄົບ ແລ້ວສົ່ງເຂົ້າຄິວ"
          iconClassName="bg-gradient-to-br from-sky-500 to-blue-600"
        >
          <div className="px-5 py-4">
            <ModalField label="ຫົວຂໍ້">
              <input
                value={String(formData.title || '')}
                className={inputClass}
                onChange={(event: ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, title: event.target.value })}
              />
            </ModalField>

            <ModalField label="ໝວດໝູ່">
              <Select
                styles={selectStyles}
                options={categoryOptions}
                value={selectOptionByValue(categoryOptions, formData.category_id as string | number | null | undefined)}
                onChange={(option: SingleValue<SelectOption>) => {
                  setFormData({ ...formData, category_id: option?.value ?? null })
                }}
              />
            </ModalField>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <ModalField label="ຝ່າຍ">
                <Select
                  styles={selectStyles}
                  options={divisionOptions}
                  value={selectOptionByValue(divisionOptions, formData.division_code as string | number | null | undefined)}
                  onChange={(option: SingleValue<SelectOption>) => {
                    setFormData({
                      ...formData,
                      division_code: String(option?.value || ''),
                      division_name: String(option?.label || ''),
                      department_code: '',
                      department_name: '',
                      requester_code: '',
                      requester_name: '',
                    })
                  }}
                />
              </ModalField>

              <ModalField label="ພະແນກ">
                <Select
                  styles={selectStyles}
                  options={departmentOptions}
                  value={selectOptionByValue(departmentOptions, formData.department_code as string | number | null | undefined)}
                  onChange={(option: SingleValue<SelectOption>) => {
                    setFormData({
                      ...formData,
                      department_code: String(option?.value || ''),
                      department_name: String(option?.label || ''),
                      requester_code: '',
                      requester_name: '',
                    })
                  }}
                />
              </ModalField>
            </div>

            <ModalField label="ຜູ້ແຈ້ງ">
              <Select
                styles={selectStyles}
                options={requesterOptions}
                value={selectOptionByValue(requesterOptions, formData.requester_code as string | number | null | undefined)}
                onChange={(option: SingleValue<SelectOption>) => {
                  setFormData({
                    ...formData,
                    requester_code: String(option?.value || ''),
                    requester_name: String(option?.label || ''),
                  })
                }}
              />
            </ModalField>

            <ModalField label="ວັນຄາດວ່າຈະສິນສຸດ">
              <input
                type="date"
                value={String(formData.expected_done_date || '')}
                className={inputClass}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setFormData({ ...formData, expected_done_date: event.target.value })
                }
              />
            </ModalField>

            <ModalField label="ລາຍລະອຽດ">
              <textarea
                value={String(formData.description || '')}
                rows={4}
                className={`${inputClass} min-h-[96px] resize-y`}
                onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
                  setFormData({ ...formData, description: event.target.value })
                }
              />
            </ModalField>
          </div>

          <ModalFooter
            confirmLabel="ສ້າງ"
            confirmClassName="bg-gradient-to-r from-sky-500 to-blue-600"
            confirmDisabled={!String(formData.title || '').trim()}
            onCancel={closeModal}
            onConfirm={handleCreate}
          />
        </ModalShell>
      )
    }

    if (activeModal.type === 'edit' && activeModal.ticket) {
      return (
        <ModalShell
          icon={Pencil}
          title="ແກ້ໄຂບັດແຈ້ງ"
          subtitle={`Ticket #${activeModal.ticket.ticket_number || activeModal.ticket.id}`}
          iconClassName="bg-gradient-to-br from-amber-500 to-orange-500"
        >
          <div className="px-5 py-4">
            <ModalField label="ຫົວຂໍ້">
              <input
                value={String(formData.title || '')}
                className={inputClass}
                onChange={(event: ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, title: event.target.value })}
              />
            </ModalField>

            <ModalField label="ໝວດໝູ່">
              <Select
                styles={selectStyles}
                options={categoryOptions}
                value={selectOptionByValue(categoryOptions, formData.category_id as string | number | null | undefined)}
                onChange={(option: SingleValue<SelectOption>) => {
                  setFormData({ ...formData, category_id: option?.value ?? null })
                }}
              />
            </ModalField>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <ModalField label="ຝ່າຍ">
                <Select
                  styles={selectStyles}
                  options={divisionOptions}
                  value={selectOptionByValue(divisionOptions, formData.division_code as string | number | null | undefined)}
                  onChange={(option: SingleValue<SelectOption>) => {
                    setFormData({
                      ...formData,
                      division_code: String(option?.value || ''),
                      division_name: String(option?.label || ''),
                      department_code: '',
                      department_name: '',
                      requester_code: '',
                      requester_name: '',
                    })
                  }}
                />
              </ModalField>

              <ModalField label="ພະແນກ">
                <Select
                  styles={selectStyles}
                  options={departmentOptions}
                  value={selectOptionByValue(departmentOptions, formData.department_code as string | number | null | undefined)}
                  onChange={(option: SingleValue<SelectOption>) => {
                    setFormData({
                      ...formData,
                      department_code: String(option?.value || ''),
                      department_name: String(option?.label || ''),
                      requester_code: '',
                      requester_name: '',
                    })
                  }}
                />
              </ModalField>
            </div>

            <ModalField label="ຜູ້ແຈ້ງ">
              <Select
                styles={selectStyles}
                options={requesterOptions}
                value={selectOptionByValue(requesterOptions, formData.requester_code as string | number | null | undefined)}
                onChange={(option: SingleValue<SelectOption>) => {
                  setFormData({
                    ...formData,
                    requester_code: String(option?.value || ''),
                    requester_name: String(option?.label || ''),
                  })
                }}
              />
            </ModalField>

            <ModalField label="ລາຍລະອຽດ">
              <textarea
                value={String(formData.description || '')}
                rows={4}
                className={`${inputClass} min-h-[96px] resize-y`}
                onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
                  setFormData({ ...formData, description: event.target.value })
                }
              />
            </ModalField>
          </div>

          <ModalFooter
            confirmLabel="ບັນທຶກ"
            confirmClassName="bg-gradient-to-r from-amber-500 to-orange-500"
            confirmDisabled={!String(formData.title || '').trim() || !String(formData.description || '').trim()}
            onCancel={closeModal}
            onConfirm={handleEdit}
          />
        </ModalShell>
      )
    }

    if (activeModal.type === 'close' && activeModal.ticket) {
      return (
        <ModalShell
          icon={CheckCircle2}
          title="ປິດວຽກ"
          subtitle={`Ticket #${activeModal.ticket.ticket_number || activeModal.ticket.id}`}
          iconClassName="bg-gradient-to-br from-emerald-500 to-green-600"
        >
          <div className="px-5 py-4">
            <ModalField label="ໝາຍເຫດການແກ້ໄຂ">
              <textarea
                value={String(formData.reason || '')}
                rows={4}
                className={`${inputClass} min-h-[100px] resize-y`}
                onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
                  setFormData({ ...formData, reason: event.target.value })
                }
              />
            </ModalField>
          </div>

          <ModalFooter
            confirmLabel="ປິດ Ticket"
            confirmClassName="bg-gradient-to-r from-emerald-500 to-green-600"
            onCancel={closeModal}
            onConfirm={handleClose}
          />
        </ModalShell>
      )
    }

    if (activeModal.type === 'waiting' && activeModal.ticket) {
      return (
        <ModalShell
          icon={Package}
          title="ລໍຖ້າອາໄຫຼ່"
          subtitle={`Ticket #${activeModal.ticket.ticket_number || activeModal.ticket.id}`}
          iconClassName="bg-gradient-to-br from-pink-500 to-rose-500"
        >
          <div className="px-5 py-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <ModalField label="ວັນທີອາໄຫຼ່ມາ">
                <input
                  type="date"
                  value={String(formData.spare_part_date || '')}
                  className={inputClass}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    setFormData({ ...formData, spare_part_date: event.target.value })
                  }
                />
              </ModalField>

              <ModalField label="ວັນທີຄາດວ່າຈະແລ້ວ">
                <input
                  type="date"
                  value={String(formData.expected_done_date || '')}
                  className={inputClass}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    setFormData({ ...formData, expected_done_date: event.target.value })
                  }
                />
              </ModalField>
            </div>
          </div>

          <ModalFooter
            confirmLabel="ບັນທຶກ"
            confirmClassName="bg-gradient-to-r from-pink-500 to-rose-500"
            onCancel={closeModal}
            onConfirm={handleWaiting}
          />
        </ModalShell>
      )
    }

    if (activeModal.type === 'assign' && activeModal.ticket) {
      return (
        <ModalShell
          icon={UserPlus}
          title="ມອບໝາຍງານ"
          subtitle={`Ticket #${activeModal.ticket.ticket_number || activeModal.ticket.id}`}
          iconClassName="bg-gradient-to-br from-violet-500 to-purple-600"
        >
          <div className="px-5 py-4">
            <ModalField label="ຜູ້ຮັບຜິດຊອບ">
              <Select
                styles={selectStyles}
                options={userOptions}
                value={selectOptionByValue(userOptions, formData.assignee_id as string | number | null | undefined)}
                onChange={(option: SingleValue<SelectOption>) => {
                  setFormData({ ...formData, assignee_id: option?.value || '' })
                }}
              />
            </ModalField>
          </div>

          <ModalFooter
            confirmLabel="ມອບໝາຍ"
            confirmClassName="bg-gradient-to-r from-violet-500 to-purple-600"
            confirmDisabled={!formData.assignee_id}
            onCancel={closeModal}
            onConfirm={handleAssign}
          />
        </ModalShell>
      )
    }

    if (activeModal.type === 'delete' && activeModal.ticket) {
      return (
        <ModalShell
          icon={Trash2}
          title="ລົບບັດແຈ້ງ"
          subtitle={`Ticket #${activeModal.ticket.ticket_number || activeModal.ticket.id}`}
          iconClassName="bg-gradient-to-br from-red-500 to-rose-600"
        >
          <div className="px-5 py-4">
            <p className="text-[12px] leading-relaxed text-slate-600">
              ການລົບຈະບໍ່ສາມາດກູ້ຄືນໄດ້. ກະລຸນາກວດສອບກ່ອນຢືນຢັນ.
            </p>
          </div>

          <ModalFooter
            confirmLabel="ລົບ"
            confirmClassName="bg-gradient-to-r from-red-500 to-rose-600"
            onCancel={closeModal}
            onConfirm={handleDelete}
          />
        </ModalShell>
      )
    }

    return null
  }

  const statusTabs = [
    { id: 'all', label: 'ທັງໝົດ', count: counts.all, icon: Layers },
    { id: 'open', label: 'ລໍຖ້າມອບໝາຍ', count: counts.open, icon: CircleDot },
    { id: 'assigned', label: 'ຈັດຊ່າງແລ້ວ', count: counts.assigned, icon: UserPlus },
    { id: 'accepted', label: 'ຮັບງານແລ້ວ', count: counts.accepted, icon: HandMetal },
    { id: 'in_progress', label: 'ກຳລັງດຳເນີນ', count: counts.in_progress, icon: Activity },
    { id: 'waiting', label: 'ລໍຖ້າອາໄຫຼ່', count: counts.waiting, icon: Package },
    { id: 'closed', label: 'ສຳເລັດ', count: counts.closed, icon: CheckCircle2 },
  ]

  return (
    <div className="min-h-screen overflow-x-hidden font-[var(--font-lao,'Noto_Sans_Lao',sans-serif)] text-[13px] text-slate-800">
      <style>{ticketCSS}</style>

      <div className="mx-auto max-w-[1320px] px-3 py-4 sm:px-5 lg:px-6">

        {/* ── Header ──────────────────────────────────────── */}
        <header className="mb-6 fade-up">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-2.5 flex items-center gap-2.5">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-500/25">
                  <TicketIcon size={16} />
                </div>
                <div>
                  <span className="block text-[8px] font-bold uppercase tracking-[0.18em] text-slate-400">{scopeLabel}</span>
                  <h1 className="text-lg font-extrabold leading-none tracking-tight text-slate-900 sm:text-xl">
                    ບໍລິການຊ່ວຍເຫຼືອ
                  </h1>
                </div>
              </div>
              <p className="max-w-md pl-0.5 text-[11px] text-slate-400">
                ຈັດການ ແລະ ຕິດຕາມ ບັດແຈ້ງທັງໝົດຂອງທີມ IT
              </p>
            </div>

            {(isHelpdesk || isManager) && (
              <button
                className="group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-2.5 text-[11px] font-bold text-white shadow-lg shadow-sky-500/25 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-sky-500/30 active:scale-[0.98] sm:w-auto"
                onClick={openCreateModal}
              >
                <div className="grid h-5 w-5 place-items-center rounded-md bg-white/20">
                  <Plus size={13} strokeWidth={3} />
                </div>
                ສ້າງບັດແຈ້ງໃໝ່
                <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
              </button>
            )}
          </div>
        </header>

        {/* ── Stat Cards ──────────────────────────────────── */}
        <div className="mb-6 grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'ທັງໝົດ', value: counts.all, icon: Layers, gradient: 'from-sky-500 to-blue-600' },
            { label: 'ດ່ວນ / ວິກິດ', value: visibleUrgentCount, icon: Zap, gradient: 'from-rose-500 to-red-600' },
            { label: 'ກຳລັງດຳເນີນ', value: activeWorkCount, icon: Activity, gradient: 'from-violet-500 to-purple-600' },
            { label: 'ອັດຕາສຳເລັດ', value: `${resolutionRate}%`, icon: BarChart3, gradient: 'from-emerald-500 to-green-600' },
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

        {/* ── Main Layout: Left Tabs + Right Content ────── */}
        <div className="flex gap-4 fade-up fade-up-3">

          {/* ── Left Status Tabs ──────────────────────────── */}
          <div className="sticky top-5 hidden w-[168px] shrink-0 self-start rounded-xl border border-slate-200/60 bg-white p-2 shadow-sm lg:flex lg:flex-col lg:gap-0.5">
            <span className="px-2 pb-1 pt-0.5 text-[7px] font-bold uppercase tracking-[0.18em] text-slate-400">ສະຖານະ</span>
            {statusTabs.map((tab) => {
              const isActive = activeTab === tab.id
              const TabIcon = tab.icon
              const cfg = STATUS_CONFIG[tab.id]
              return (
                <button
                  key={tab.id}
                  type="button"
                  className={`relative flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-[9px] font-semibold leading-tight transition-all duration-200 ${
                    isActive
                      ? 'text-white shadow-md'
                      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                  }`}
                  style={isActive && cfg ? {
                    background: `linear-gradient(135deg, ${cfg.dot}, ${cfg.text})`,
                    boxShadow: `0 4px 10px -3px ${cfg.dot}40`,
                  } : isActive ? { background: '#334155' } : undefined}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <TabIcon size={11} />
                  <span className="flex-1 text-left">{tab.label}</span>
                  <span className={`min-w-[16px] rounded-md px-1.5 py-0.5 text-center text-[7px] font-bold ${
                    isActive ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {tab.count}
                  </span>
                </button>
              )
            })}
          </div>

          {/* ── Right Content ─────────────────────────────── */}
          <div className="flex-1 min-w-0">

            {/* Mobile: horizontal tabs */}
            <div className="flex items-center gap-1 overflow-x-auto px-1 pb-4 ticket-scroll lg:hidden">
              {statusTabs.map((tab) => {
                const isActive = activeTab === tab.id
                const TabIcon = tab.icon
                const cfg = STATUS_CONFIG[tab.id]
                return (
                  <button
                    key={tab.id}
                    type="button"
                    className={`relative flex shrink-0 items-center gap-1 whitespace-nowrap rounded-lg px-2 py-1.5 text-[9px] font-semibold leading-tight transition-all duration-200 ${
                      isActive
                        ? 'text-white shadow-md'
                        : 'border border-slate-200/60 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                    }`}
                    style={isActive && cfg ? {
                      background: `linear-gradient(135deg, ${cfg.dot}, ${cfg.text})`,
                      boxShadow: `0 4px 10px -3px ${cfg.dot}40`,
                    } : isActive ? { background: '#334155' } : undefined}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    <TabIcon size={11} />
                    {tab.label}
                    <span className={`min-w-[16px] rounded-md px-1.5 py-0.5 text-center text-[7px] font-bold ${
                      isActive ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {tab.count}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Search + info row */}
            <div className="mb-4 rounded-xl border border-slate-200/60 bg-white px-3 py-3 shadow-sm sm:px-3.5">
              <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative flex-1 sm:max-w-md">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
                  <input
                    value={search}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50/50 py-2 pl-9 pr-9 text-[11px] text-slate-700 outline-none transition-all duration-200 placeholder:text-slate-300 focus:border-sky-400 focus:bg-white focus:ring-4 focus:ring-sky-400/10"
                    placeholder="ຄົ້ນຫາດ້ວຍຫົວຂໍ້ ຫຼື ເລກບັດແຈ້ງ..."
                    onChange={(event: ChangeEvent<HTMLInputElement>) => setSearch(event.target.value)}
                  />
                  {search && (
                    <button
                      type="button"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md bg-slate-200/60 p-1 text-slate-400 transition hover:bg-slate-200 hover:text-slate-600"
                      onClick={() => setSearch('')}
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5 text-[9px] font-semibold">
                  <span className="rounded-md bg-slate-100 px-2.5 py-1 text-slate-500">
                    {filtered.length} ລາຍການ
                  </span>
                  {filtered.length > 0 && (
                    <span className="rounded-md bg-sky-50 px-2.5 py-1 text-sky-600">
                      ໜ້າ {activePageNumber}/{totalPages}
                    </span>
                  )}
                  {search.trim() && (
                    <span className="rounded-md bg-amber-50 px-2.5 py-1 text-amber-600">
                      &quot;{search.trim()}&quot;
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* ── Ticket Cards ────────────────────────────── */}
            <div className="fade-up fade-up-4">
              {paginatedTickets.length > 0 ? (
                <div className="space-y-2.5">
                  {paginatedTickets.map((t) => {
                    const sKey = getStatusKey(t.status)
                    const sCfg = STATUS_CONFIG[sKey] || STATUS_CONFIG.open
                    const pCfg = PRIORITY_CONFIG[String(t.priority || '').toLowerCase()] || {
                      label: '-',
                      dot: '#cbd5e1',
                      color: '#94a3b8',
                      emoji: '–',
                    }
                    const isOwner = String(t.assignee_id) === String(user.id)
                    const categoryName = categoryMap.get(String(t.category_id)) || '-'
                    const orgLabel = [t.division_name, t.department_name].filter(Boolean).join(' / ') || '-'
                    const elapsed = sKey === 'closed' ? formatElapsed(t.created_at, t.closed_at) : formatElapsed(t.created_at, now)
                    const StatusIcon = sCfg.icon
                    const isExpanded = expandedTicketId === t.id

                    const fmtDate = (date?: string | null) => {
                      if (!date) return '-'
                      return new Date(date).toLocaleString('lo-LA', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    }

                    return (
                      <div
                        key={t.id}
                        className={`group relative cursor-pointer overflow-hidden rounded-xl border bg-white transition-all duration-200 ${
                          isExpanded
                            ? 'border-slate-300 shadow-lg shadow-slate-200/50'
                            : 'border-slate-200/60 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-200/40'
                        }`}
                      >
                        <div className="absolute bottom-0 left-0 top-0 w-1 rounded-l-xl" style={{ background: sCfg.dot }} />

                        <div
                          className="flex flex-col gap-2.5 p-3 pl-[16px] sm:flex-row sm:items-center sm:gap-4 sm:p-4 sm:pl-5"
                          onClick={() => toggleAccordion(t)}
                        >
                          <div className={`hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${sCfg.gradient} text-white shadow-sm sm:flex`}>
                            <StatusIcon size={15} />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="mb-1 flex items-start gap-2">
                              <span className="shrink-0 rounded-md bg-sky-50 px-1.5 py-0.5 font-mono text-[8px] font-bold text-sky-500">
                                #{t.ticket_number || t.id}
                              </span>
                              <span
                                className="inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-0.5 text-[8px] font-bold sm:hidden"
                                style={{ background: sCfg.bg, color: sCfg.text, borderColor: sCfg.border }}
                              >
                                {sCfg.label}
                              </span>
                            </div>
                            <h3 className={`truncate text-[11px] font-bold leading-snug text-slate-900 transition-colors ${isExpanded ? 'text-sky-700' : 'group-hover:text-sky-700'}`}>
                              {t.title}
                            </h3>
                            <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
                              <span className="inline-flex items-center gap-1.5 text-[9px] text-slate-500">
                                <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: pCfg.dot }} />
                                {pCfg.label}
                              </span>
                              {categoryName !== '-' && (
                                <span className="text-[9px] text-slate-400">
                                  {categoryName}
                                </span>
                              )}
                              <span className="hidden text-[9px] text-slate-400 sm:inline">
                                {t.requester_name || '-'} · {orgLabel}
                              </span>
                            </div>
                          </div>

                          <div className="flex w-full shrink-0 flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap sm:gap-3">
                            <div className="hidden min-w-[72px] text-right md:block">
                              <div className="text-[8px] font-medium text-slate-400">ຜູ້ຮັບຜິດຊອບ</div>
                              <div className={`mt-0.5 text-[10px] font-semibold ${t.assignee_name ? 'text-slate-700' : 'text-slate-300'}`}>
                                {t.assignee_name || 'ຍັງບໍ່ມອບ'}
                              </div>
                            </div>

                            <div className="flex shrink-0 items-center gap-1.5 rounded-lg bg-slate-50 px-2 py-1 text-[9px] font-semibold text-slate-500">
                              <Clock size={11} className="text-slate-300" />
                              {elapsed}
                            </div>

                            <span
                              className="hidden whitespace-nowrap rounded-lg border px-2 py-0.5 text-[8px] font-bold sm:inline-flex sm:items-center sm:gap-1.5"
                              style={{ background: sCfg.bg, color: sCfg.text, borderColor: sCfg.border }}
                            >
                              <StatusIcon size={10} /> {sCfg.label}
                            </span>

                            <div className="ml-auto flex w-full flex-wrap items-center justify-end gap-1 transition-opacity duration-200 sm:ml-0 sm:w-auto sm:flex-nowrap sm:justify-start sm:opacity-0 sm:group-hover:opacity-100" onClick={(event) => event.stopPropagation()}>
                              {((sKey === 'open' && isSupport && !isManager) || (sKey === 'assigned' && (isOwner || isSupport))) && (
                                <button
                                  className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-cyan-500 to-teal-500 px-2.5 py-1.5 text-[8px] font-bold text-white shadow-sm transition hover:-translate-y-0.5"
                                  title="ຮັບງານ"
                                  onClick={() => api.takeTicket(t.id, { assignee_id: user.id }).then(fetchData)}
                                >
                                  <HandMetal size={11} /> ຮັບງານ
                                </button>
                              )}

                              {sKey === 'accepted' && (isOwner || isManager) && (
                                <button
                                  className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-violet-500 to-purple-600 px-2.5 py-1.5 text-[8px] font-bold text-white shadow-sm transition hover:-translate-y-0.5"
                                  title="ດຳເນີນງານ"
                                  onClick={() => api.updateTicketStatus(t.id, { status: 'in_progress' }).then(fetchData)}
                                >
                                  <Activity size={11} /> ດຳເນີນງານ
                                </button>
                              )}

                              {sKey === 'in_progress' && (isOwner || isManager) && (
                                <>
                                  <button
                                    className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-emerald-500 to-green-600 px-2.5 py-1.5 text-[8px] font-bold text-white shadow-sm transition hover:-translate-y-0.5"
                                    title="ປິດຈອບ"
                                    onClick={() => openCloseModal(t)}
                                  >
                                    <CheckCircle2 size={11} /> ປິດ
                                  </button>
                                  <button
                                    className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-pink-500 to-rose-500 px-2.5 py-1.5 text-[8px] font-bold text-white shadow-sm transition hover:-translate-y-0.5"
                                    title="ລໍຖ້າອາໄຫຼ່"
                                    onClick={() => openWaitingModal(t)}
                                  >
                                    <Package size={11} />
                                  </button>
                                </>
                              )}

                              {sKey === 'waiting' && (isOwner || isManager) && (
                                <button
                                  className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-violet-500 to-purple-600 px-2.5 py-1.5 text-[8px] font-bold text-white shadow-sm transition hover:-translate-y-0.5"
                                  title="ດຳເນີນງານ"
                                  onClick={() => api.updateTicketStatus(t.id, { status: 'in_progress' }).then(fetchData)}
                                >
                                  <Activity size={11} /> ດຳເນີນ
                                </button>
                              )}

                              {canAssignTickets && sKey !== 'closed' && (
                                <button
                                  className="grid h-7 w-7 place-items-center rounded-lg border border-slate-200 bg-white text-slate-400 transition hover:-translate-y-0.5 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-600"
                                  title="ມອບໝາຍ"
                                  onClick={() => openAssignModal(t)}
                                >
                                  <UserPlus size={12} />
                                </button>
                              )}

                              {canEditOrDeleteTicket && (
                                <>
                                  <button
                                    className="grid h-7 w-7 place-items-center rounded-lg border border-slate-200 bg-white text-slate-400 transition hover:-translate-y-0.5 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-600"
                                    title="ແກ້ໄຂ"
                                    onClick={() => openEditModal(t)}
                                  >
                                    <Pencil size={12} />
                                  </button>
                                  <button
                                    className="grid h-7 w-7 place-items-center rounded-lg border border-slate-200 bg-white text-slate-400 transition hover:-translate-y-0.5 hover:border-red-300 hover:bg-red-50 hover:text-red-500"
                                    title="ລົບ"
                                    onClick={() => {
                                      setFormData({})
                                      setActiveModal({ type: 'delete', ticket: t })
                                    }}
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </>
                              )}
                            </div>

                            <div className={`ml-auto grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-slate-200 bg-white transition-all duration-300 sm:ml-0 ${isExpanded ? 'rotate-180 border-sky-300 bg-sky-50 text-sky-600' : 'text-slate-400'}`}>
                              <ChevronDown size={13} />
                            </div>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="accordion-enter border-t border-slate-100">
                            <div className="px-4 pb-5 pt-4 sm:px-5">
                              <div className="mb-4 grid grid-cols-1 gap-2.5 min-[420px]:grid-cols-2 sm:grid-cols-3 xl:grid-cols-5">
                                {[
                                  { label: 'ໝວດໝູ່', value: categoryName },
                                  { label: 'ຝ່າຍ', value: t.division_name || '-' },
                                  { label: 'ພະແນກ', value: t.department_name || '-' },
                                  { label: 'ຜູ້ແຈ້ງ', value: t.requester_name || '-' },
                                  { label: 'ຜູ້ຮັບຜິດຊອບ', value: t.assignee_name || '-' },
                                ].map((item) => (
                                  <div key={item.label} className="rounded-lg bg-slate-50 px-3 py-2.5">
                                    <span className="text-[8px] font-bold uppercase tracking-wider text-slate-400">{item.label}</span>
                                    <div className="mt-1 text-[10px] font-semibold text-slate-700">{item.value}</div>
                                  </div>
                                ))}
                              </div>

                              {(() => {
                                const steps = [
                                  { key: 'open', label: 'ສ້າງ', cfg: STATUS_CONFIG.open },
                                  { key: 'assigned', label: 'ຈັດຊ່າງ', cfg: STATUS_CONFIG.assigned },
                                  { key: 'accepted', label: 'ຮັບງານ', cfg: STATUS_CONFIG.accepted },
                                  { key: 'in_progress', label: 'ດຳເນີນງານ', cfg: STATUS_CONFIG.in_progress },
                                  { key: 'closed', label: 'ສຳເລັດ', cfg: STATUS_CONFIG.closed },
                                ]
                                const statusOrder = ['open', 'assigned', 'accepted', 'in_progress', 'closed']
                                const currentIdx = sKey === 'waiting'
                                  ? 3
                                  : sKey === 'closed'
                                    ? 4
                                    : statusOrder.indexOf(sKey)

                                const stepDates: Record<number, string> = {}
                                if (t.created_at) stepDates[0] = fmtDate(t.created_at)
                                if (historyData?.statusLogs) {
                                  for (const log of historyData.statusLogs) {
                                    if (log.to_status === 'assigned' && !stepDates[1]) stepDates[1] = fmtDate(log.created_at)
                                    if (log.to_status === 'accepted' && !stepDates[2]) stepDates[2] = fmtDate(log.created_at)
                                    if (log.to_status === 'in_progress' && !stepDates[3]) stepDates[3] = fmtDate(log.created_at)
                                    if (log.to_status === 'waiting' && !stepDates[3]) stepDates[3] = fmtDate(log.created_at)
                                    if (log.to_status === 'closed' && !stepDates[4]) stepDates[4] = fmtDate(log.created_at)
                                  }
                                }
                                if (t.closed_at && !stepDates[4]) stepDates[4] = fmtDate(t.closed_at)

                                return (
                                  <div className="mb-4 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-3 sm:px-3.5 sm:py-3.5">
                                    <div className="-mx-1 overflow-x-auto px-1 ticket-scroll">
                                      <div className="relative flex min-w-[420px] items-center justify-between sm:min-w-0">
                                      <div className="absolute left-[10%] right-[10%] top-4 h-[3px] rounded-full bg-slate-200" />
                                      <div
                                        className="absolute left-[10%] top-4 h-[3px] rounded-full transition-all duration-500"
                                        style={{
                                          width: currentIdx >= 0 ? `${(currentIdx / (steps.length - 1)) * 80}%` : '0%',
                                          background: `linear-gradient(90deg, ${steps[0].cfg.dot}, ${steps[Math.max(0, currentIdx)]?.cfg.dot || steps[0].cfg.dot})`,
                                        }}
                                      />
                                      {steps.map((step, index) => {
                                        const StepIcon = step.cfg.icon
                                        const isPast = index < currentIdx
                                        const isCurrent = index === currentIdx
                                        const isWaiting = sKey === 'waiting' && index === 3
                                        const activeCfg = isWaiting ? STATUS_CONFIG.waiting : step.cfg
                                        const stepDate = stepDates[index]
                                        return (
                                          <div key={step.key + index} className="relative z-[1] flex flex-col items-center gap-1" style={{ width: `${100 / steps.length}%` }}>
                                            <div
                                              className={`grid h-7 w-7 place-items-center rounded-full transition-all duration-300 ${
                                                isCurrent
                                                  ? 'scale-110 ring-4 shadow-md'
                                                  : isPast
                                                    ? 'shadow-sm'
                                                    : 'border-2 border-slate-200 bg-white'
                                              }`}
                                              style={isCurrent ? {
                                                background: `linear-gradient(135deg, ${activeCfg.dot}, ${activeCfg.text})`,
                                                boxShadow: `0 0 0 4px ${activeCfg.bg}, 0 4px 12px -2px ${activeCfg.dot}40`,
                                              } : isPast ? {
                                                background: step.cfg.dot,
                                              } : undefined}
                                            >
                                              {(isCurrent || isPast) ? (
                                                isPast ? <CheckCircle2 size={12} className="text-white" /> : <StepIcon size={12} className="text-white" />
                                              ) : (
                                                <div className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                                              )}
                                            </div>
                                            <span className={`text-center text-[8px] font-bold leading-tight ${
                                              isCurrent ? 'text-slate-800' : isPast ? 'text-slate-500' : 'text-slate-300'
                                            }`}>
                                              {isWaiting ? 'ລໍຖ້າອາໄຫຼ່' : step.label}
                                            </span>
                                            {stepDate && (isPast || isCurrent) ? (
                                              <span className={`text-center text-[6px] leading-tight ${isCurrent ? 'text-slate-500' : 'text-slate-400'}`}>
                                                {stepDate}
                                              </span>
                                            ) : (
                                              <span className="text-center text-[6px] text-slate-300">-</span>
                                            )}
                                          </div>
                                        )
                                      })}
                                      </div>
                                    </div>

                                    <div className="mt-2.5 flex flex-wrap items-center justify-center gap-2 border-t border-slate-200/60 pt-2.5">
                                      <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[8px] font-bold" style={{ background: sCfg.bg, color: sCfg.text }}>
                                        <StatusIcon size={9} /> {sCfg.label}
                                      </span>
                                      <span className="inline-flex items-center gap-1 text-[8px] font-bold text-slate-500">
                                        {pCfg.emoji} {pCfg.label}
                                      </span>
                                      <span className="inline-flex items-center gap-1 text-[8px] font-bold text-slate-500">
                                        <Timer size={8} /> {elapsed}
                                      </span>
                                    </div>
                                  </div>
                                )
                              })()}

                              {t.description && (
                                <div className="mb-4">
                                  <span className="mb-2 block text-[8px] font-bold uppercase tracking-wider text-slate-400">ລາຍລະອຽດ</span>
                                  <p className="whitespace-pre-wrap rounded-lg bg-slate-50 px-3 py-2.5 text-[11px] leading-relaxed text-slate-600">{t.description}</p>
                                </div>
                              )}

                              <div>
                                <span className="mb-2.5 block text-[8px] font-bold uppercase tracking-wider text-slate-400">ປະຫວັດການດຳເນີນງານ</span>
                                {historyLoading ? (
                                  <div className="flex items-center gap-2 py-3 text-[11px] text-slate-400">
                                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-200 border-t-sky-500" />
                                    ກຳລັງໂຫຼດ...
                                  </div>
                                ) : (
                                  <div className="dm-timeline">
                                    {historyData && historyData.statusLogs && historyData.statusLogs.length > 0 ? (
                                      historyData.statusLogs.map((log, index, logs) => {
                                        const toConfig = STATUS_CONFIG[log.to_status] || STATUS_CONFIG.open
                                        const fromConfig = log.from_status ? (STATUS_CONFIG[log.from_status] || null) : null
                                        const ToIcon = toConfig.icon
                                        const nextLog = logs[index + 1]
                                        const duration = nextLog
                                          ? formatElapsed(log.created_at, nextLog.created_at)
                                          : t.status === 'closed'
                                            ? formatElapsed(log.created_at, t.closed_at)
                                            : formatElapsed(log.created_at, now)
                                        const isLast = index === logs.length - 1
                                        const changedBy = log.changed_by_name || log.changed_by_username || ''
                                        return (
                                          <div key={log.id} className={`relative flex items-start gap-2.5 ${isLast ? '' : 'pb-3.5'}`}>
                                            <div className="z-[1] -ml-[20px] mt-2 shrink-0 rounded-full" style={{ width: '12px', height: '12px', background: toConfig.dot, boxShadow: `0 0 0 3px ${toConfig.bg}` }} />
                                            <div className="flex-1 overflow-hidden rounded-lg border border-slate-100 bg-white shadow-sm">
                                              <div className="flex items-center justify-between gap-2 px-3.5 py-2" style={{ background: toConfig.bg }}>
                                                <div className="flex min-w-0 items-center gap-2">
                                                  <ToIcon size={13} style={{ color: toConfig.text }} />
                                                  {fromConfig ? (
                                                    <span className="flex items-center gap-1.5 truncate text-[9px] font-bold">
                                                      <span style={{ color: fromConfig.text }}>{fromConfig.label}</span>
                                                      <ArrowRight size={9} className="shrink-0 text-slate-300" />
                                                      <span style={{ color: toConfig.text }}>{toConfig.label}</span>
                                                    </span>
                                                  ) : (
                                                    <span className="text-[9px] font-bold" style={{ color: toConfig.text }}>{toConfig.label}</span>
                                                  )}
                                                </div>
                                                <div className="flex shrink-0 items-center gap-2">
                                                  <span className="inline-flex items-center gap-1 rounded-md bg-white/80 px-2 py-0.5 text-[8px] font-semibold text-slate-500">
                                                    <Clock size={8} className="text-slate-400" />
                                                    {duration}
                                                  </span>
                                                </div>
                                              </div>
                                              <div className="space-y-1.5 px-3.5 py-2">
                                                {log.note && (
                                                  <div className="flex items-start gap-2">
                                                    <span className="mt-0.5 w-12 shrink-0 text-[8px] font-bold text-slate-400">ໝາຍເຫດ</span>
                                                    <p className="text-[10px] leading-relaxed text-slate-600">{log.note}</p>
                                                  </div>
                                                )}
                                                <div className="flex flex-wrap items-center gap-2">
                                                  {changedBy && (
                                                    <span className="inline-flex items-center gap-1.5 text-[8px] text-slate-500">
                                                      <span className="grid h-3 w-3 shrink-0 place-items-center rounded-full bg-gradient-to-br from-slate-200 to-slate-300 text-[6px] font-bold text-slate-600">
                                                        {changedBy.charAt(0).toUpperCase()}
                                                      </span>
                                                      <span className="font-semibold">{changedBy}</span>
                                                    </span>
                                                  )}
                                                  <span className="text-[8px] text-slate-300">·</span>
                                                  <span className="text-[8px] text-slate-400">{fmtDate(log.created_at)}</span>
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        )
                                      })
                                    ) : (
                                      <div className="relative flex items-start gap-3">
                                        <div className="z-[1] -ml-[20px] mt-2 h-3 w-3 shrink-0 rounded-full" style={{ background: '#3b82f6', boxShadow: '0 0 0 3px #eff6ff' }} />
                                        <div className="flex-1 overflow-hidden rounded-lg border border-slate-100 bg-white shadow-sm">
                                          <div className="flex items-center gap-2 bg-blue-50/50 px-3.5 py-2">
                                            <CircleDot size={13} className="text-blue-600" />
                                            <span className="text-[9px] font-bold text-blue-600">ສ້າງບັດແຈ້ງ</span>
                                          </div>
                                          <div className="px-3.5 py-2">
                                            <span className="text-[8px] text-slate-400">{fmtDate(t.created_at)}</span>
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
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
                    <TicketIcon size={22} className="text-slate-300" />
                  </div>
                  <h3 className="mb-1 text-sm font-bold text-slate-700">ບໍ່ພົບບັດແຈ້ງໃນຄິວນີ້</h3>
                  <p className="mx-auto max-w-xs text-[11px] text-slate-400">
                    ລອງປ່ຽນ filter ຫຼື ລ້າງຄຳຄົ້ນຫາເພື່ອເບິ່ງ ticket ອື່ນໆ
                  </p>
                </div>
              )}

              {filtered.length > 0 && (
                <div className="mt-4 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-[10px] text-slate-400">
                    ສະແດງ <span className="font-bold text-slate-600">{pageStart}–{pageEnd}</span> ຈາກ <span className="font-bold text-slate-600">{filtered.length}</span> ລາຍການ
                  </div>

                  <div className="flex flex-wrap items-center gap-1">
                    <button
                      type="button"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 transition-all duration-200 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-30"
                      onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                      disabled={activePageNumber === 1}
                    >
                      <ChevronLeft size={14} />
                    </button>

                    {visiblePages.map((page) => (
                      <button
                        key={page}
                        type="button"
                        className={`inline-flex h-8 min-w-[2rem] items-center justify-center rounded-lg px-2 text-[11px] font-bold transition-all duration-200 ${
                          page === activePageNumber
                            ? 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-md shadow-sky-500/20'
                            : 'border border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700'
                        }`}
                        onClick={() => setCurrentPage(page)}
                      >
                        {page}
                      </button>
                    ))}

                    <button
                      type="button"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 transition-all duration-200 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-30"
                      onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                      disabled={activePageNumber === totalPages}
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {activeModal.type && (
        <div
          className="fixed inset-0 z-[9999] flex items-start justify-center overflow-y-auto bg-slate-900/50 p-3 backdrop-blur-md sm:items-center sm:p-4"
          style={{ animation: 'overlayIn 0.2s ease-out' }}
          onClick={(event: MouseEvent<HTMLDivElement>) => event.target === event.currentTarget && closeModal()}
        >
          {renderModalContent()}
        </div>
      )}
    </div>
  )
}
