import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Activity,
  ArrowRight,
  FolderKanban,
  LayoutDashboard,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Ticket,
  TriangleAlert,
  Users,
  type LucideIcon,
} from 'lucide-react'
import api from '../lib/api'
import { countTasksByStatus } from '../lib/dashboardConstants'

interface Ticket {
  id: number
  ticket_number?: string
  title: string
  status: string
  priority?: string
  assignee_id?: number | null
  requester_name?: string
  due_at?: string
  updated_at?: string
  created_at?: string
  [key: string]: unknown
}

interface Project {
  id: number
  project_number?: string
  title: string
  status: string
  start_date?: string
  expected_done_date?: string
  created_at?: string
  completed_at?: string
  [key: string]: unknown
}

interface Task {
  id: number
  title: string
  status?: string
  project_id?: number
  assigned_to?: number | null
  updated_at?: string
  created_at?: string
  [key: string]: unknown
}

interface User {
  id: number
  name: string
  role: string
  avatar?: string
  [key: string]: unknown
}

interface AlertItem {
  label: string
  color: string
  icon: string
}

interface FeedItem {
  id: string
  type: 'ticket' | 'task'
  title: string
  sub: string
  color: string
  bg: string
  statusLabel: string
  updated?: string
  onClick?: () => void
}

interface RecommendationItem {
  icon: string
  title: string
  desc: string
  color: string
  action?: string
  onClick?: () => void
}

interface MetricCard {
  label: string
  value: number | string
  note: string
  icon: LucideIcon
  gradient: string
  shadow: string
  tint: string
}

const dashboardCSS = `
@keyframes managerFadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
.fade-up{opacity:0;animation:managerFadeUp .42s ease forwards}
.fade-up-1{animation-delay:.04s}
.fade-up-2{animation-delay:.08s}
.fade-up-3{animation-delay:.12s}
.fade-up-4{animation-delay:.16s}
.fade-up-5{animation-delay:.2s}
.fade-up-6{animation-delay:.24s}
.mgr-scroll::-webkit-scrollbar{width:6px;height:6px}
.mgr-scroll::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:999px}
.mgr-grid-glow::before{content:'';position:absolute;inset:-20% auto auto -10%;width:220px;height:220px;background:radial-gradient(circle,rgba(56,189,248,.18),transparent 70%);pointer-events:none}
.mgr-grid-glow::after{content:'';position:absolute;inset:auto -10% -30% auto;width:240px;height:240px;background:radial-gradient(circle,rgba(251,191,36,.16),transparent 70%);pointer-events:none}
@media (prefers-reduced-motion: reduce){
  .fade-up{animation:none;opacity:1;transform:none}
}
`

const ticketTheme: Record<string, { color: string; bg: string; label: string }> = {
  open: { color: '#0ea5e9', bg: 'rgba(14,165,233,0.12)', label: 'ລໍຖ້າຮັບ' },
  assigned: { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', label: 'ມອບໝາຍ' },
  in_progress: { color: '#6366f1', bg: 'rgba(99,102,241,0.12)', label: 'ກຳລັງເຮັດ' },
  waiting: { color: '#ec4899', bg: 'rgba(236,72,153,0.12)', label: 'ລໍຖ້າອາໄຫຼ່' },
  closed: { color: '#10b981', bg: 'rgba(16,185,129,0.12)', label: 'ປິດ' },
}

const taskTheme: Record<string, { color: string; bg: string; label: string }> = {
  pending: { color: '#64748b', bg: 'rgba(100,116,139,0.12)', label: 'ລໍຖ້າ' },
  assigned: { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', label: 'ຮັບວຽກ' },
  in_progress: { color: '#2563eb', bg: 'rgba(37,99,235,0.12)', label: 'ກຳລັງເຮັດ' },
  submitted: { color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)', label: 'ສະເໜີກວດ' },
  rejected: { color: '#ef4444', bg: 'rgba(239,68,68,0.12)', label: 'ແກ້ໄຂຄືນ' },
  completed: { color: '#10b981', bg: 'rgba(16,185,129,0.12)', label: 'ສຳເລັດ' },
}

const projectStageTheme: Record<string, { color: string; label: string }> = {
  registered: { color: '#64748b', label: 'ລົງທະບຽນ' },
  requirements: { color: '#f59e0b', label: 'ເກັບຄວາມຕ້ອງການ' },
  subtasks: { color: '#8b5cf6', label: 'ກຳນົດໜ້າວຽກ' },
  development: { color: '#2563eb', label: 'ກຳລັງພັດທະນາ' },
  golive: { color: '#06b6d4', label: 'Go Live' },
  completed: { color: '#10b981', label: 'ສຳເລັດ' },
}

const Ring = ({
  pct,
  size = 60,
  sw = 6,
  color = '#0ea5e9',
}: {
  pct: number
  size?: number
  sw?: number
  color?: string
}) => {
  const radius = (size - sw) / 2
  const circumference = 2 * Math.PI * radius

  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={sw} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth={sw}
        strokeLinecap="round"
        stroke={color}
        strokeDasharray={circumference}
        strokeDashoffset={circumference - (pct / 100) * circumference}
        className="transition-[stroke-dashoffset] duration-700 ease-out"
      />
    </svg>
  )
}

const formatShortDate = (value?: string | null): string => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('lo-LA', { day: 'numeric', month: 'short', year: 'numeric' }).format(date)
}

const formatDateTime = (value?: string | null): string => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('lo-LA', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

const getProjectAge = (project: Project): { days: number; label: string; overdue: boolean } => {
  const start = project.start_date || project.created_at
  if (!start) return { days: 0, label: '-', overdue: false }

  const startDate = new Date(start)
  const endDate = project.completed_at ? new Date(project.completed_at) : new Date()
  const diffMs = endDate.getTime() - startDate.getTime()
  const days = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)))

  let label = '-'
  if (days === 0) label = 'ມື້ນີ້'
  else if (days < 30) label = `${days} ມື້`
  else if (days < 365) {
    const months = Math.floor(days / 30)
    const remDays = days % 30
    label = remDays > 0 ? `${months} ເດືອນ ${remDays} ມື້` : `${months} ເດືອນ`
  } else {
    const years = Math.floor(days / 365)
    const remMonths = Math.floor((days % 365) / 30)
    label = remMonths > 0 ? `${years} ປີ ${remMonths} ເດືອນ` : `${years} ປີ`
  }

  const overdue =
    !project.completed_at &&
    !!project.expected_done_date &&
    new Date(project.expected_done_date).getTime() < Date.now()

  return { days, label, overdue }
}

const getRoleAvatar = (role: string): string => {
  if (role === 'it_support') return '🛠️'
  if (role === 'helpdesk') return '🎧'
  if (role === 'lead_programmer') return '👩‍🏫'
  if (role === 'programmer') return '🧑‍💻'
  return '👤'
}

export default function ManagerDashboardPage() {
  const navigate = useNavigate()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [isRefreshing, setIsRefreshing] = useState(false)

  const fetchData = useCallback(async () => {
    setIsRefreshing(true)
    try {
      const [ticketRes, projectRes, taskRes, userRes] = await Promise.all([
        api.listTickets(),
        api.listProjects(),
        api.listTasks(),
        api.listUsers(),
      ])
      setTickets(ticketRes.data || [])
      setProjects(projectRes.data || [])
      setTasks(taskRes.data || [])
      setUsers(userRes.data || [])
    } catch {
      // ignore dashboard polling errors
    } finally {
      setIsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const onViewTicket = useCallback(() => {
    navigate('/tickets')
  }, [navigate])

  const onViewProject = useCallback(() => {
    navigate('/dev/projects')
  }, [navigate])

  const todayLabel = useMemo(
    () =>
      new Intl.DateTimeFormat('lo-LA', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(new Date()),
    []
  )

  const ticketStats = useMemo(() => {
    const total = tickets.length
    const open = tickets.filter((item) => item.status === 'open').length
    const assigned = tickets.filter((item) => item.status === 'assigned').length
    const inProgress = tickets.filter((item) => item.status === 'in_progress').length
    const waiting = tickets.filter((item) => item.status === 'waiting').length
    const closed = tickets.filter((item) => item.status === 'closed').length
    const overdue = tickets.filter((item) => item.due_at && new Date(item.due_at).getTime() < Date.now() && item.status !== 'closed').length
    const unassigned = tickets.filter((item) => !item.assignee_id && item.status !== 'closed').length
    const resolutionRate = total > 0 ? Math.round((closed / total) * 100) : 0
    return { total, open, assigned, inProgress, waiting, closed, overdue, unassigned, resolutionRate }
  }, [tickets])

  const devStats = useMemo(() => {
    const totalProjects = projects.length
    const activeProjects = projects.filter((item) => item.status !== 'completed').length
    const completedProjects = projects.filter((item) => item.status === 'completed').length
    const totalTasks = tasks.length
    const taskCounts = countTasksByStatus(tasks)
    const inProgressTasks = taskCounts.in_progress
    const reviewTasks = taskCounts.submitted
    const reworkTasks = taskCounts.rejected
    const completedTasks = taskCounts.completed
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
    return {
      totalProjects,
      activeProjects,
      completedProjects,
      totalTasks,
      inProgressTasks,
      reviewTasks,
      reworkTasks,
      completedTasks,
      completionRate,
    }
  }, [projects, tasks])

  const itSupportStats = useMemo(() => {
    return users
      .filter((item) => item.role === 'it_support')
      .map((agent) => {
        const agentTickets = tickets.filter((ticket) => ticket.assignee_id === agent.id)
        return {
          ...agent,
          avatar: agent.avatar || getRoleAvatar(agent.role),
          total: agentTickets.length,
          closed: agentTickets.filter((ticket) => ticket.status === 'closed').length,
          inProgress: agentTickets.filter((ticket) => ticket.status === 'in_progress').length,
          waiting: agentTickets.filter((ticket) => ticket.status === 'waiting').length,
        }
      })
  }, [tickets, users])

  const programmerStats = useMemo(() => {
    return users
      .filter((item) => ['programmer', 'lead_programmer'].includes(item.role))
      .sort((a, b) => {
        const aLead = a.role === 'lead_programmer' ? 0 : 1
        const bLead = b.role === 'lead_programmer' ? 0 : 1
        if (aLead !== bLead) return aLead - bLead
        return String(a.name || '').localeCompare(String(b.name || ''))
      })
      .map((programmer) => {
        const programmerTasks = tasks.filter((task) => task.assigned_to === programmer.id)
        const taskCounts = countTasksByStatus(programmerTasks)
        return {
          ...programmer,
          avatar: programmer.avatar || getRoleAvatar(programmer.role),
          total: programmerTasks.length,
          completed: taskCounts.completed,
          inProgress: taskCounts.in_progress,
          rejected: taskCounts.rejected,
          submitted: taskCounts.submitted,
        }
      })
  }, [tasks, users])

  const alertCount = ticketStats.overdue + ticketStats.unassigned + devStats.reviewTasks + devStats.reworkTasks

  const alerts = useMemo<AlertItem[]>(() => {
    const items: AlertItem[] = []
    if (ticketStats.overdue > 0) {
      items.push({ label: `${ticketStats.overdue} ticket ເກີນກຳນົດ`, color: '#ef4444', icon: '🔴' })
    }
    if (ticketStats.unassigned > 0) {
      items.push({ label: `${ticketStats.unassigned} ticket ຍັງບໍ່ມອບໝາຍ`, color: '#f59e0b', icon: '🟡' })
    }
    if (devStats.reviewTasks > 0) {
      items.push({ label: `${devStats.reviewTasks} task ລໍຖ້າກວດ`, color: '#8b5cf6', icon: '🟣' })
    }
    if (devStats.reworkTasks > 0) {
      items.push({ label: `${devStats.reworkTasks} task ຕ້ອງແກ້ໄຂ`, color: '#ef4444', icon: '🔧' })
    }
    return items
  }, [devStats, ticketStats])

  const feedItems = useMemo<FeedItem[]>(() => {
    const aliasMap: Record<string, string> = {
      testing: 'submitted',
      lead_approved: 'submitted',
      manager_approved: 'completed',
    }

    const items: FeedItem[] = []

    tickets.slice(0, 6).forEach((ticket) => {
      const theme = ticketTheme[ticket.status] || ticketTheme.open
      items.push({
        id: `t-${ticket.id}`,
        type: 'ticket',
        title: ticket.title || `Ticket #${ticket.id}`,
        sub: `#${ticket.ticket_number || ticket.id} • ${ticket.requester_name || '-'}`,
        color: theme.color,
        bg: theme.bg,
        statusLabel: theme.label,
        updated: ticket.updated_at || ticket.created_at,
        onClick: onViewTicket,
      })
    })

    tasks.slice(0, 6).forEach((task) => {
      const normalizedStatus = aliasMap[String(task.status || 'pending').toLowerCase()] || String(task.status || 'pending').toLowerCase()
      const theme = taskTheme[normalizedStatus] || taskTheme.pending
      const project = projects.find((item) => item.id === task.project_id)
      items.push({
        id: `k-${task.id}`,
        type: 'task',
        title: task.title,
        sub: project?.title || '',
        color: theme.color,
        bg: theme.bg,
        statusLabel: theme.label,
        updated: task.updated_at || task.created_at,
        onClick: onViewProject,
      })
    })

    items.sort((a, b) => {
      if (a.updated && b.updated) return new Date(b.updated).getTime() - new Date(a.updated).getTime()
      return 0
    })

    return items.slice(0, 10)
  }, [onViewProject, onViewTicket, projects, tasks, tickets])

  const activeProjects = useMemo(() => projects.filter((item) => item.status !== 'completed'), [projects])

  const recommendations = useMemo<RecommendationItem[]>(() => {
    const items: RecommendationItem[] = []

    if (ticketStats.overdue > 0) {
      items.push({
        icon: '⏰',
        title: 'ບັດແຈ້ງເກີນກຳນົດ',
        desc: `ມີ ${ticketStats.overdue} ບັດແຈ້ງທີ່ເກີນກຳນົດແລ້ວ, ຄວນຕິດຕາມ ແລະ ມອບໝາຍດ່ວນ`,
        color: '#ef4444',
        action: 'ເບິ່ງບັດແຈ້ງ',
        onClick: onViewTicket,
      })
    }

    if (ticketStats.unassigned > 0) {
      items.push({
        icon: '👤',
        title: 'ບັດແຈ້ງຍັງບໍ່ມອບໝາຍ',
        desc: `ມີ ${ticketStats.unassigned} ບັດແຈ້ງທີ່ຍັງບໍ່ມີຜູ້ຮັບຜິດຊອບ, ຄວນກະຈາຍໃຫ້ທີມຊ່າງ IT`,
        color: '#f59e0b',
        action: 'ໄປຈັດການ',
        onClick: onViewTicket,
      })
    }

    if (devStats.reviewTasks > 0) {
      items.push({
        icon: '📋',
        title: 'Task ລໍຖ້າກວດ',
        desc: `ມີ ${devStats.reviewTasks} task ທີ່ນັກພັດທະນາສົ່ງມາແລ້ວ, ຄວນກວດ ແລະ ອະນຸມັດ`,
        color: '#8b5cf6',
        action: 'ກວດວຽກ',
        onClick: onViewProject,
      })
    }

    if (devStats.reworkTasks > 0) {
      items.push({
        icon: '🔧',
        title: 'Task ຕ້ອງປັບປຸງ',
        desc: `ມີ ${devStats.reworkTasks} task ທີ່ຖືກສົ່ງກັບຄືນ, ຄວນຕິດຕາມໃຫ້ແກ້ໄຂ`,
        color: '#ef4444',
        action: 'ເບິ່ງ Tasks',
        onClick: onViewProject,
      })
    }

    if (ticketStats.total > 5 && ticketStats.resolutionRate < 50) {
      items.push({
        icon: '📊',
        title: 'ອັດຕາແກ້ໄຂ Ticket ຕ່ຳ',
        desc: `ອັດຕາແກ້ໄຂ ticket ຢູ່ທີ່ ${ticketStats.resolutionRate}% ເທົ່ານັ້ນ, ຄວນທົບທວນ workload ຂອງທີມ`,
        color: '#f97316',
      })
    }

    if (itSupportStats.length > 1) {
      const loads = itSupportStats.map((item) => item.inProgress)
      const maxLoad = Math.max(...loads)
      const minLoad = Math.min(...loads)
      if (maxLoad > 0 && maxLoad - minLoad >= 3) {
        const busiest = itSupportStats.find((item) => item.inProgress === maxLoad)
        items.push({
          icon: '⚖️',
          title: 'Workload ບໍ່ສົມດຸນ',
          desc: `${busiest?.name || 'ບາງຄົນ'} ມີ ${maxLoad} ticket ກຳລັງເຮັດ, ຄວນກະຈາຍວຽກໃຫ້ທົ່ວທີມ`,
          color: '#0ea5e9',
        })
      }
    }

    const highReject = programmerStats.find((item) => item.rejected >= 2)
    if (highReject) {
      items.push({
        icon: '🎯',
        title: `${highReject.name} ມີ task ຖືກສົ່ງກັບຫຼາຍ`,
        desc: `ມີ ${highReject.rejected} task ຖືກສົ່ງກັບ, ຄວນສົນທະນາ ແລະ ຊ່ວຍແນະນຳ`,
        color: '#ef4444',
      })
    }

    const stuckProjects = activeProjects.filter((item) => ['registered', 'requirements'].includes(item.status))
    if (stuckProjects.length > 0) {
      items.push({
        icon: '🚦',
        title: 'ໂຄງການຍັງບໍ່ເລີ່ມພັດທະນາ',
        desc: `ມີ ${stuckProjects.length} ໂຄງການທີ່ຍັງຢູ່ໃນຂັ້ນຕອນເບື້ອງຕົ້ນ, ຄວນຕິດຕາມໃຫ້ກ້າວຕໍ່`,
        color: '#64748b',
        action: 'ເບິ່ງໂຄງການ',
        onClick: onViewProject,
      })
    }

    if (items.length === 0) {
      items.push({
        icon: '✨',
        title: 'ສະຖານະປົກກະຕິ',
        desc: 'ບໍ່ມີລາຍການທີ່ຕ້ອງການຄວາມສົນໃຈພິເສດ, ພາບລວມຂອງທີມຢູ່ໃນລະດັບດີ',
        color: '#10b981',
      })
    }

    return items
  }, [activeProjects, devStats, itSupportStats, onViewProject, onViewTicket, programmerStats, ticketStats])

  const summaryCards = useMemo<MetricCard[]>(
    () => [
      {
        label: 'Tickets ທັງໝົດ',
        value: ticketStats.total,
        note: `${ticketStats.closed} ປິດແລ້ວ`,
        icon: Ticket,
        gradient: 'from-sky-500 to-blue-600',
        shadow: 'shadow-sky-500/20',
        tint: 'bg-sky-50',
      },
      {
        label: 'Projects Active',
        value: devStats.activeProjects,
        note: `${devStats.totalProjects} ໂຄງການ`,
        icon: FolderKanban,
        gradient: 'from-indigo-500 to-blue-700',
        shadow: 'shadow-indigo-500/20',
        tint: 'bg-indigo-50',
      },
      {
        label: 'Tasks ລໍຖ້າກວດ',
        value: devStats.reviewTasks,
        note: `${devStats.reworkTasks} ຕ້ອງແກ້ໄຂ`,
        icon: ShieldAlert,
        gradient: 'from-amber-500 to-orange-500',
        shadow: 'shadow-amber-500/20',
        tint: 'bg-amber-50',
      },
      {
        label: 'Alerts ລວມ',
        value: alertCount,
        note: alertCount > 0 ? 'ຕ້ອງການ follow-up' : 'ສະຖານະສົມດຸນ',
        icon: TriangleAlert,
        gradient: alertCount > 0 ? 'from-rose-500 to-red-600' : 'from-emerald-500 to-green-600',
        shadow: alertCount > 0 ? 'shadow-rose-500/20' : 'shadow-emerald-500/20',
        tint: alertCount > 0 ? 'bg-rose-50' : 'bg-emerald-50',
      },
    ],
    [alertCount, devStats, ticketStats]
  )

  const heroPulse = useMemo(
    () => [
      { label: 'Open Queue', value: ticketStats.open + ticketStats.assigned, note: `${ticketStats.unassigned} ຍັງບໍ່ມອບ`, color: 'text-sky-200' },
      { label: 'Dev Review', value: devStats.reviewTasks + devStats.reworkTasks, note: `${devStats.inProgressTasks} ກຳລັງພັດທະນາ`, color: 'text-amber-200' },
      { label: 'Active Staff', value: itSupportStats.length + programmerStats.length, note: `${users.length} ຜູ້ໃຊ້ໃນລະບົບ`, color: 'text-emerald-200' },
    ],
    [devStats, itSupportStats.length, programmerStats.length, ticketStats, users.length]
  )

  const supportBreakdown = useMemo(
    () => [
      { label: 'ລໍຖ້າຮັບ', value: ticketStats.open, color: '#0ea5e9' },
      { label: 'ມອບໝາຍແລ້ວ', value: ticketStats.assigned, color: '#f59e0b' },
      { label: 'ກຳລັງເຮັດ', value: ticketStats.inProgress, color: '#6366f1' },
      { label: 'ລໍຖ້າອາໄຫຼ່', value: ticketStats.waiting, color: '#ec4899' },
      { label: 'ປິດແລ້ວ', value: ticketStats.closed, color: '#10b981' },
    ],
    [ticketStats]
  )

  const devBreakdown = useMemo(
    () => [
      { label: 'Active Projects', value: devStats.activeProjects, color: '#2563eb' },
      { label: 'In Progress', value: devStats.inProgressTasks, color: '#0ea5e9' },
      { label: 'Review', value: devStats.reviewTasks, color: '#8b5cf6' },
      { label: 'Rework', value: devStats.reworkTasks, color: '#ef4444' },
      { label: 'Completed', value: devStats.completedTasks, color: '#10b981' },
    ],
    [devStats]
  )

  const busiestSupport = useMemo(
    () => [...itSupportStats].sort((a, b) => b.inProgress - a.inProgress || b.waiting - a.waiting)[0] || null,
    [itSupportStats]
  )

  const busiestProgrammer = useMemo(
    () => [...programmerStats].sort((a, b) => (b.inProgress + b.submitted) - (a.inProgress + a.submitted))[0] || null,
    [programmerStats]
  )

  return (
    <div className="mx-auto max-w-[1460px] px-4 pb-10 pt-5 sm:px-6 lg:px-8">
      <style>{dashboardCSS}</style>

      <section className="mgr-grid-glow fade-up fade-up-1 relative overflow-hidden rounded-[28px] border border-slate-200/60 bg-slate-950 px-5 py-6 text-white shadow-[0_32px_90px_-40px_rgba(15,23,42,0.9)] sm:px-6 lg:px-7">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.22),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(251,191,36,0.18),transparent_28%)]" />

        <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_360px]">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-100">
                <LayoutDashboard size={14} />
                Manager Command
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/12 px-3 py-1 text-[10px] font-semibold text-emerald-200">
                <span className="h-2 w-2 rounded-full bg-emerald-300" />
                Live Overview
              </span>
            </div>

            <h1 className="mt-4 max-w-3xl text-3xl font-black tracking-tight text-white sm:text-4xl">
              ໜ້າຫຼັກຜູ້ຈັດການ
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
              ກວດສະພາບ ticket, project, task ແລະ workload ຂອງທີມໃນຈຸດດຽວ. focus ຂອງຫນ້ານີ້ຄືການເຫັນ risk ໄວ, ຕິດຕາມທີມໄວ ແລະ ກົດເຂົ້າ action ໄດ້ທັນທີ.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full bg-white/7 px-3 py-1 text-[10px] font-semibold text-slate-200">
                {todayLabel}
              </span>
              {(alerts.length > 0 ? alerts.slice(0, 3) : [{ label: 'ບໍ່ມີ alert ດ່ວນ', color: '#10b981', icon: '✨' }]).map((item) => (
                <span
                  key={item.label}
                  className="rounded-full border px-3 py-1 text-[10px] font-semibold"
                  style={{ borderColor: `${item.color}55`, color: item.color, background: `${item.color}18` }}
                >
                  {item.icon} {item.label}
                </span>
              ))}
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {heroPulse.map((item) => (
                <div key={item.label} className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-sm">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">{item.label}</div>
                  <div className="mt-2 text-3xl font-black text-white">{item.value}</div>
                  <div className={`mt-1 text-[11px] ${item.color}`}>{item.note}</div>
                </div>
              ))}
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={onViewTicket}
                className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:-translate-y-0.5"
              >
                ເຂົ້າຈັດການ Tickets
                <ArrowRight size={16} />
              </button>
              <button
                type="button"
                onClick={onViewProject}
                className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.05] px-4 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-white/[0.08]"
              >
                ເຂົ້າຈັດການ Projects
                <ArrowRight size={16} />
              </button>
              <button
                type="button"
                onClick={() => fetchData()}
                disabled={isRefreshing}
                className={`inline-flex items-center gap-2 rounded-full border border-sky-300/20 bg-sky-400/10 px-4 py-2 text-sm font-semibold text-sky-100 transition ${
                  isRefreshing ? 'cursor-not-allowed opacity-60' : 'hover:-translate-y-0.5 hover:bg-sky-400/15'
                }`}
              >
                <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
                {isRefreshing ? 'ກຳລັງດຶງ...' : 'Refresh Data'}
              </button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
            <div className="rounded-[24px] border border-white/10 bg-white/[0.06] p-4 backdrop-blur-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Helpdesk Resolution</div>
                  <div className="mt-1 text-sm font-semibold text-white">ອັດຕາປິດ ticket ຂອງລະບົບ</div>
                </div>
                <div className="relative h-[60px] w-[60px] shrink-0">
                  <Ring pct={ticketStats.resolutionRate} color="#22c55e" />
                  <div className="absolute inset-0 grid place-items-center text-xs font-bold text-emerald-300">
                    {ticketStats.resolutionRate}%
                  </div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-2xl bg-white/[0.05] px-3 py-2">
                  <div className="text-[10px] text-slate-400">Unassigned</div>
                  <div className="mt-1 text-xl font-bold text-white">{ticketStats.unassigned}</div>
                </div>
                <div className="rounded-2xl bg-white/[0.05] px-3 py-2">
                  <div className="text-[10px] text-slate-400">Overdue</div>
                  <div className="mt-1 text-xl font-bold text-white">{ticketStats.overdue}</div>
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-white/[0.06] p-4 backdrop-blur-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Development Completion</div>
                  <div className="mt-1 text-sm font-semibold text-white">ອັດຕາສຳເລັດ task ໃນທີມພັດທະນາ</div>
                </div>
                <div className="relative h-[60px] w-[60px] shrink-0">
                  <Ring pct={devStats.completionRate} color="#60a5fa" />
                  <div className="absolute inset-0 grid place-items-center text-xs font-bold text-sky-200">
                    {devStats.completionRate}%
                  </div>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-2xl bg-white/[0.05] px-3 py-2">
                  <div className="text-[10px] text-slate-400">Review Queue</div>
                  <div className="mt-1 text-xl font-bold text-white">{devStats.reviewTasks}</div>
                </div>
                <div className="rounded-2xl bg-white/[0.05] px-3 py-2">
                  <div className="text-[10px] text-slate-400">Active Projects</div>
                  <div className="mt-1 text-xl font-bold text-white">{devStats.activeProjects}</div>
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-gradient-to-br from-white/[0.08] to-white/[0.03] p-4 sm:col-span-2 xl:col-span-1">
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                <Sparkles size={14} />
                Coverage Snapshot
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <div className="rounded-2xl bg-white/[0.05] px-3 py-2">
                  <div className="text-[10px] text-slate-400">Support</div>
                  <div className="mt-1 text-xl font-bold text-white">{itSupportStats.length}</div>
                </div>
                <div className="rounded-2xl bg-white/[0.05] px-3 py-2">
                  <div className="text-[10px] text-slate-400">Dev</div>
                  <div className="mt-1 text-xl font-bold text-white">{programmerStats.length}</div>
                </div>
                <div className="rounded-2xl bg-white/[0.05] px-3 py-2">
                  <div className="text-[10px] text-slate-400">Alerts</div>
                  <div className="mt-1 text-xl font-bold text-white">{alertCount}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card, index) => {
          const Icon = card.icon
          return (
            <div
              key={card.label}
              className={`fade-up fade-up-${Math.min(index + 2, 6)} group relative overflow-hidden rounded-[24px] border border-slate-200/70 bg-white p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg`}
            >
              <div className={`absolute -right-8 -top-8 h-28 w-28 rounded-full bg-gradient-to-br ${card.gradient} opacity-[0.08] blur-md transition-all duration-300 group-hover:scale-110`} />
              <div className="relative flex items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">{card.label}</div>
                  <div className="mt-2 text-3xl font-black tracking-tight text-slate-900">{card.value}</div>
                  <div className="mt-1 text-sm text-slate-500">{card.note}</div>
                </div>
                <div className={`grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br ${card.gradient} text-white shadow-lg ${card.shadow}`}>
                  <Icon size={18} />
                </div>
              </div>
              <div className={`mt-4 inline-flex items-center rounded-full ${card.tint} px-2.5 py-1 text-[10px] font-semibold text-slate-600`}>
                dashboard metric
              </div>
            </div>
          )
        })}
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-5">
          <section className="fade-up fade-up-3 rounded-[24px] border border-slate-200/70 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <TriangleAlert size={16} className={alerts.length > 0 ? 'text-rose-500' : 'text-emerald-500'} />
              Risk Radar
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              {alerts.length > 0 ? `${alertCount} ຈຸດທີ່ຄວນຈັບຕາໃນຕອນນີ້` : 'ບໍ່ພົບ alert ທີ່ຮຸນແຮງ'}
            </div>

            <div className="mt-4 space-y-2">
              {alerts.length > 0 ? (
                alerts.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center gap-3 rounded-2xl border px-3 py-2"
                    style={{ borderColor: `${item.color}22`, background: `${item.color}08`, color: item.color }}
                  >
                    <span className="text-base">{item.icon}</span>
                    <span className="text-[11px] font-semibold leading-5">{item.label}</span>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-emerald-200/60 bg-emerald-50 px-3 py-3 text-[11px] font-semibold text-emerald-700">
                  ທຸກແນວວຽກຢູ່ໃນໂຊນປົກກະຕິ
                </div>
              )}
            </div>
          </section>

          <section className="fade-up fade-up-4 rounded-[24px] border border-slate-200/70 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Activity size={16} className="text-sky-500" />
              Operations Split
            </div>
            <div className="mt-4 space-y-4">
              <div>
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Helpdesk</div>
                <div className="space-y-2">
                  {supportBreakdown.map((item) => (
                    <div key={item.label} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
                        <span className="text-[11px] font-medium text-slate-600">{item.label}</span>
                      </div>
                      <span className="text-lg font-bold" style={{ color: item.color }}>{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Development</div>
                <div className="space-y-2">
                  {devBreakdown.map((item) => (
                    <div key={item.label} className="flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
                        <span className="text-[11px] font-medium text-slate-600">{item.label}</span>
                      </div>
                      <span className="text-lg font-bold" style={{ color: item.color }}>{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="fade-up fade-up-5 rounded-[24px] border border-slate-200/70 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Users size={16} className="text-indigo-500" />
              Team Focus
            </div>
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl border border-slate-200/70 bg-slate-50 px-3 py-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Support Lead Load</div>
                <div className="mt-1 text-sm font-bold text-slate-900">{busiestSupport?.name || '-'}</div>
                <div className="mt-1 text-[11px] text-slate-500">
                  {busiestSupport ? `${busiestSupport.inProgress} ticket ກຳລັງເຮັດ • ${busiestSupport.waiting} waiting` : 'ຍັງບໍ່ມີຂໍ້ມູນ'}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200/70 bg-slate-50 px-3 py-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Development Focus</div>
                <div className="mt-1 text-sm font-bold text-slate-900">{busiestProgrammer?.name || '-'}</div>
                <div className="mt-1 text-[11px] text-slate-500">
                  {busiestProgrammer
                    ? `${busiestProgrammer.inProgress} in progress • ${busiestProgrammer.submitted} submitted`
                    : 'ຍັງບໍ່ມີຂໍ້ມູນ'}
                </div>
              </div>
            </div>
          </section>
        </aside>

        <div className="space-y-5">
          <div className="grid gap-5 2xl:grid-cols-[1.1fr_0.9fr]">
            <section className="fade-up fade-up-3 overflow-hidden rounded-[24px] border border-slate-200/70 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-5 py-4">
                <div>
                  <div className="text-sm font-bold text-slate-900">Live Activity Feed</div>
                  <div className="mt-0.5 text-[11px] text-slate-500">ticket ແລະ task ທີ່ update ຫຼ້າສຸດ</div>
                </div>
                <span className="rounded-full bg-slate-900 px-2.5 py-1 text-[10px] font-semibold text-white">
                  {feedItems.length} items
                </span>
              </div>

              <div className="mgr-scroll max-h-[520px] overflow-auto px-5 py-4">
                {feedItems.length > 0 ? (
                  <div className="relative pl-7">
                    <div className="absolute bottom-2 left-[10px] top-2 w-px bg-gradient-to-b from-sky-200 via-slate-200 to-amber-200" />
                    {feedItems.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={item.onClick}
                        className="group relative mb-3 block w-full rounded-[20px] border border-slate-200/70 bg-white p-4 text-left transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
                      >
                        <span
                          className="absolute -left-[22px] top-5 h-3.5 w-3.5 rounded-full border-[3px] border-white"
                          style={{ background: item.color, boxShadow: `0 0 0 4px ${item.bg}` }}
                        />
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] ${
                                item.type === 'ticket' ? 'bg-sky-50 text-sky-700' : 'bg-indigo-50 text-indigo-700'
                              }`}>
                                {item.type}
                              </span>
                              <span className="text-[10px] text-slate-400">{formatDateTime(item.updated)}</span>
                            </div>
                            <div className="mt-2 text-sm font-bold text-slate-900">{item.title}</div>
                            <div className="mt-1 text-[11px] text-slate-500">{item.sub || '-'}</div>
                          </div>
                          <span
                            className="rounded-full px-2.5 py-1 text-[10px] font-semibold"
                            style={{ background: item.bg, color: item.color }}
                          >
                            {item.statusLabel}
                          </span>
                        </div>
                        <div className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 transition group-hover:text-slate-800">
                          ເປີດເບິ່ງ
                          <ArrowRight size={14} />
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="grid min-h-[260px] place-items-center rounded-[20px] border border-dashed border-slate-200 bg-slate-50/60 text-center">
                    <div>
                      <div className="text-4xl opacity-40">📭</div>
                      <div className="mt-2 text-sm font-semibold text-slate-500">ບໍ່ມີກິດຈະກຳ</div>
                    </div>
                  </div>
                )}
              </div>
            </section>

            <section className="fade-up fade-up-4 overflow-hidden rounded-[24px] border border-slate-200/70 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-5 py-4">
                <div>
                  <div className="text-sm font-bold text-slate-900">Recommendations</div>
                  <div className="mt-0.5 text-[11px] text-slate-500">ຂໍ້ແນະນຳສຳລັບການຕິດຕາມຕໍ່</div>
                </div>
                <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-700">
                  {recommendations.length} focus
                </span>
              </div>

              <div className="p-4">
                <div className="space-y-3">
                  {recommendations.map((item) => (
                    <div
                      key={`${item.title}-${item.color}`}
                      className="rounded-[20px] border p-4"
                      style={{ borderColor: `${item.color}22`, background: `${item.color}08` }}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-lg"
                          style={{ background: `${item.color}18` }}
                        >
                          {item.icon}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-bold text-slate-900">{item.title}</div>
                          <div className="mt-1 text-[11px] leading-5 text-slate-600">{item.desc}</div>
                        </div>
                      </div>
                      {item.action && item.onClick && (
                        <button
                          type="button"
                          onClick={item.onClick}
                          className="mt-4 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-semibold"
                          style={{ background: `${item.color}18`, color: item.color }}
                        >
                          {item.action}
                          <ArrowRight size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <section className="fade-up fade-up-4 overflow-hidden rounded-[24px] border border-slate-200/70 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-5 py-4">
                <div>
                  <div className="text-sm font-bold text-slate-900">ທີມຊ່າງ IT</div>
                  <div className="mt-0.5 text-[11px] text-slate-500">resolution, workload ແລະ waiting queue</div>
                </div>
                <span className="rounded-full bg-sky-50 px-2.5 py-1 text-[10px] font-semibold text-sky-700">
                  {itSupportStats.length} ຄົນ
                </span>
              </div>

              <div className="p-4">
                {itSupportStats.length > 0 ? (
                  <div className="space-y-3">
                    {itSupportStats.map((agent) => {
                      const rate = agent.total > 0 ? Math.round((agent.closed / agent.total) * 100) : 0
                      return (
                        <div key={agent.id} className="rounded-[22px] border border-slate-200/70 bg-slate-50/70 p-4">
                          <div className="flex items-center gap-3">
                            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-900 text-lg text-white">
                              {agent.avatar}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-bold text-slate-900">{agent.name}</div>
                              <div className="mt-0.5 text-[11px] text-slate-500">ticket ທີ່ຮັບຜິດຊອບ {agent.total}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-2xl font-black text-slate-900">{rate}%</div>
                              <div className="text-[10px] text-slate-400">closure</div>
                            </div>
                          </div>
                          <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200">
                            <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-green-500" style={{ width: `${rate}%` }} />
                          </div>
                          <div className="mt-4 grid grid-cols-3 gap-2">
                            <div className="rounded-2xl bg-white px-3 py-2 text-center">
                              <div className="text-[10px] text-slate-400">In Progress</div>
                              <div className="mt-1 text-lg font-bold text-indigo-600">{agent.inProgress}</div>
                            </div>
                            <div className="rounded-2xl bg-white px-3 py-2 text-center">
                              <div className="text-[10px] text-slate-400">Waiting</div>
                              <div className="mt-1 text-lg font-bold text-pink-500">{agent.waiting}</div>
                            </div>
                            <div className="rounded-2xl bg-white px-3 py-2 text-center">
                              <div className="text-[10px] text-slate-400">Closed</div>
                              <div className="mt-1 text-lg font-bold text-emerald-600">{agent.closed}</div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="grid min-h-[240px] place-items-center rounded-[20px] border border-dashed border-slate-200 bg-slate-50/60 text-center">
                    <div>
                      <div className="text-3xl opacity-40">🛠️</div>
                      <div className="mt-2 text-sm font-semibold text-slate-500">ບໍ່ມີຂໍ້ມູນຊ່າງ IT</div>
                    </div>
                  </div>
                )}
              </div>
            </section>

            <section className="fade-up fade-up-5 overflow-hidden rounded-[24px] border border-slate-200/70 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-5 py-4">
                <div>
                  <div className="text-sm font-bold text-slate-900">ທີມນັກພັດທະນາ</div>
                  <div className="mt-0.5 text-[11px] text-slate-500">progress, review backlog ແລະ rework pressure</div>
                </div>
                <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-semibold text-indigo-700">
                  {programmerStats.length} ຄົນ
                </span>
              </div>

              <div className="p-4">
                {programmerStats.length > 0 ? (
                  <div className="space-y-3">
                    {programmerStats.map((programmer) => {
                      const rate = programmer.total > 0 ? Math.round((programmer.completed / programmer.total) * 100) : 0
                      return (
                        <div
                          key={programmer.id}
                          className={`rounded-[22px] border p-4 ${programmer.rejected > 0 ? 'border-rose-200 bg-rose-50/40' : 'border-slate-200/70 bg-slate-50/70'}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-900 text-lg text-white">
                              {programmer.avatar}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-slate-900">{programmer.name}</span>
                                {programmer.role === 'lead_programmer' && (
                                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-amber-700">
                                    Lead
                                  </span>
                                )}
                              </div>
                              <div className="mt-0.5 text-[11px] text-slate-500">task ທີ່ຮັບຜິດຊອບ {programmer.total}</div>
                            </div>
                            <div className="text-right">
                              <div className="text-2xl font-black text-slate-900">{rate}%</div>
                              <div className="text-[10px] text-slate-400">done</div>
                            </div>
                          </div>
                          <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-200">
                            <div className="h-full rounded-full bg-gradient-to-r from-sky-500 to-indigo-600" style={{ width: `${rate}%` }} />
                          </div>
                          <div className="mt-4 grid grid-cols-4 gap-2">
                            <div className="rounded-2xl bg-white px-2.5 py-2 text-center">
                              <div className="text-[10px] text-slate-400">Doing</div>
                              <div className="mt-1 text-lg font-bold text-sky-600">{programmer.inProgress}</div>
                            </div>
                            <div className="rounded-2xl bg-white px-2.5 py-2 text-center">
                              <div className="text-[10px] text-slate-400">Review</div>
                              <div className="mt-1 text-lg font-bold text-violet-600">{programmer.submitted}</div>
                            </div>
                            <div className="rounded-2xl bg-white px-2.5 py-2 text-center">
                              <div className="text-[10px] text-slate-400">Done</div>
                              <div className="mt-1 text-lg font-bold text-emerald-600">{programmer.completed}</div>
                            </div>
                            <div className="rounded-2xl bg-white px-2.5 py-2 text-center">
                              <div className="text-[10px] text-slate-400">Rework</div>
                              <div className={`mt-1 text-lg font-bold ${programmer.rejected > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                                {programmer.rejected}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="grid min-h-[240px] place-items-center rounded-[20px] border border-dashed border-slate-200 bg-slate-50/60 text-center">
                    <div>
                      <div className="text-3xl opacity-40">🧑‍💻</div>
                      <div className="mt-2 text-sm font-semibold text-slate-500">ບໍ່ມີຂໍ້ມູນນັກພັດທະນາ</div>
                    </div>
                  </div>
                )}
              </div>
            </section>
          </div>

          <section className="fade-up fade-up-6 overflow-hidden rounded-[24px] border border-slate-200/70 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-5 py-4">
              <div>
                <div className="text-sm font-bold text-slate-900">ໂຄງການກຳລັງດຳເນີນ</div>
                <div className="mt-0.5 text-[11px] text-slate-500">ກວດ progress, ກຳນົດສິ້ນສຸດ ແລະ project age ຈາກບ່ອນດຽວ</div>
              </div>
              <button
                type="button"
                onClick={onViewProject}
                className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:-translate-y-0.5"
              >
                ເຂົ້າ Projects
                <ArrowRight size={14} />
              </button>
            </div>

            <div className="p-4">
              {activeProjects.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
                  {activeProjects.slice(0, 6).map((project) => {
                    const theme = projectStageTheme[project.status] || { color: '#64748b', label: project.status }
                    const projectTasks = tasks.filter((item) => item.project_id === project.id)
                    const completedCount = projectTasks.filter((item) => {
                      const status = String(item.status || '').toLowerCase()
                      return status === 'completed' || status === 'manager_approved'
                    }).length
                    const pct = projectTasks.length > 0 ? Math.round((completedCount / projectTasks.length) * 100) : 0
                    const age = getProjectAge(project)
                    const deadline = formatShortDate(project.expected_done_date)

                    return (
                      <button
                        key={project.id}
                        type="button"
                        onClick={onViewProject}
                        className="group relative overflow-hidden rounded-[24px] border border-slate-200/70 bg-white p-4 text-left shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-slate-300 hover:shadow-lg"
                      >
                        <div className="absolute inset-x-0 top-0 h-1.5" style={{ background: age.overdue ? '#ef4444' : theme.color }} />
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-bold text-slate-900">{project.title}</div>
                            <div className="mt-1 text-[10px] font-mono text-slate-400">{project.project_number || `#${project.id}`}</div>
                          </div>
                          <span
                            className="rounded-full px-2.5 py-1 text-[9px] font-semibold"
                            style={{ background: `${theme.color}12`, color: theme.color }}
                          >
                            {theme.label}
                          </span>
                        </div>

                        <div className="mt-5">
                          <div className="mb-2 flex items-center justify-between text-[11px]">
                            <span className="font-semibold text-slate-600">Progress</span>
                            <span className="font-bold" style={{ color: theme.color }}>{pct}%</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: theme.color }} />
                          </div>
                          <div className="mt-2 text-[10px] text-slate-400">{completedCount}/{projectTasks.length} tasks ສຳເລັດ</div>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-2">
                          <div className="rounded-2xl bg-slate-50 px-3 py-2">
                            <div className="text-[10px] text-slate-400">Project Age</div>
                            <div className={`mt-1 text-sm font-bold ${age.overdue ? 'text-rose-600' : 'text-slate-900'}`}>
                              {age.label}
                            </div>
                          </div>
                          <div className="rounded-2xl bg-slate-50 px-3 py-2">
                            <div className="text-[10px] text-slate-400">Deadline</div>
                            <div className={`mt-1 text-sm font-bold ${age.overdue ? 'text-rose-600' : 'text-slate-900'}`}>
                              {deadline}
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 flex items-center justify-between text-[11px] text-slate-500">
                          <span>{formatShortDate(project.start_date || project.created_at)}</span>
                          <span className="inline-flex items-center gap-1 font-semibold transition group-hover:text-slate-900">
                            ເປີດໂຄງການ
                            <ArrowRight size={14} />
                          </span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div className="grid min-h-[260px] place-items-center rounded-[20px] border border-dashed border-slate-200 bg-slate-50/60 text-center">
                  <div>
                    <FolderKanban size={30} className="mx-auto text-slate-300" />
                    <div className="mt-3 text-sm font-semibold text-slate-500">ບໍ່ມີໂຄງການ active</div>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
