import { useEffect, useMemo, useState, useCallback } from 'react'
import api from '../lib/api'
import { getStoredUser, type StoredUser } from '../lib/auth'
import { PROJECT_STATUS, countTasksByStatus, getTaskStatusConfig, normalizeTaskStatus } from '../lib/dashboardConstants'

interface Ticket {
  id: number
  ticket_number?: string
  title: string
  status: string
  priority?: string
  assignee_id?: number | string | null
  requester_name?: string
  updated_at?: string
  created_at?: string
  [key: string]: unknown
}

interface Project {
  id: number
  project_number?: string
  title: string
  status: string
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

const Ring = ({ pct, size = 100, sw = 8 }: { pct: number; size?: number; sw?: number }) => {
  const r = (size - sw) / 2, c = 2 * Math.PI * r
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(17,24,39,0.06)" strokeWidth={sw} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={sw} strokeLinecap="round"
        stroke="url(#rg)" strokeDasharray={c} strokeDashoffset={c - (pct / 100) * c}
        className="transition-all duration-[900ms] ease-[cubic-bezier(.4,0,.2,1)]" />
      <defs>
        <linearGradient id="rg" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#2051C6" /><stop offset="100%" stopColor="#F35B4F" />
        </linearGradient>
      </defs>
    </svg>
  )
}

export default function DevDashboardPage() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [currentUser, setCurrentUser] = useState<StoredUser | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null)

  useEffect(() => {
    const user = getStoredUser()
    if (user) setCurrentUser(user)
  }, [])

  const fetchData = useCallback(async (showLoading = true) => {
    if (showLoading) setIsRefreshing(true)
    try {
      const [tRes, pRes, tkRes] = await Promise.all([
        api.listTickets(),
        api.listProjects(),
        api.listTasks(),
      ])
      setTickets(tRes.data || [])
      setProjects(pRes.data || [])
      setTasks(tkRes.data || [])
      setLastUpdatedAt(new Date().toISOString())
    } catch { /* ignore */ }
    finally { setIsRefreshing(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Auto-refresh every 30s
  useEffect(() => {
    const timerId = setInterval(() => { fetchData(false) }, 30000)
    return () => clearInterval(timerId)
  }, [fetchData])

  // Refresh on window focus
  useEffect(() => {
    const handleFocus = () => fetchData(false)
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [fetchData])

  const isProgrammer = currentUser?.role === 'programmer'
  const isDevPersonalTicketRole = currentUser ? ['programmer', 'lead_programmer'].includes(currentUser.role) : false

  const stats = useMemo(() => {
    if (!currentUser) return { totalProjects: 0, activeProjects: 0, completedProjects: 0, totalTasks: 0, pending: 0, assigned: 0, inProgress: 0, submitted: 0, rejected: 0, approved: 0 }
    const relevantTasks = isProgrammer ? tasks.filter(t => t.assigned_to === currentUser.id) : tasks
    const taskCounts = countTasksByStatus(relevantTasks)
    return {
      totalProjects: projects.length,
      activeProjects: projects.filter(p => p.status !== 'completed').length,
      completedProjects: projects.filter(p => p.status === 'completed').length,
      totalTasks: relevantTasks.length,
      pending: taskCounts.pending,
      assigned: taskCounts.assigned,
      inProgress: taskCounts.in_progress,
      submitted: taskCounts.submitted,
      rejected: taskCounts.rejected,
      approved: taskCounts.completed,
    }
  }, [projects, tasks, currentUser, isProgrammer])

  const relevantTickets = useMemo(() => {
    if (!currentUser || !isDevPersonalTicketRole) return tickets
    return tickets.filter((t) => String(t.assignee_id) === String(currentUser.id))
  }, [tickets, currentUser, isDevPersonalTicketRole])

  const ticketStats = useMemo(() => ({
    total: relevantTickets.length,
    open: relevantTickets.filter(t => t.status === 'open').length,
    assigned: relevantTickets.filter(t => t.status === 'assigned').length,
    inProgress: relevantTickets.filter(t => t.status === 'in_progress').length,
    waiting: relevantTickets.filter(t => t.status === 'waiting').length,
    closed: relevantTickets.filter(t => t.status === 'closed').length,
  }), [relevantTickets])

  const progressPercent = stats.totalTasks > 0 ? Math.round((stats.approved / stats.totalTasks) * 100) : 0
  const lastUpdatedText = lastUpdatedAt
    ? new Intl.DateTimeFormat('lo-LA', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(lastUpdatedAt))
    : null

  const ticketTheme: Record<string, { label: string; bg: string; color: string; icon: string }> = {
    open: { label: 'ລໍຖ້າຮັບງານ', bg: '#DBEAFE', color: '#1D4ED8', icon: '📩' },
    assigned: { label: 'ຖືກມອບໝາຍ', bg: '#FEF3C7', color: '#B45309', icon: '👤' },
    in_progress: { label: 'ກຳລັງດຳເນີນ', bg: '#EDE9FE', color: '#6D28D9', icon: '🔄' },
    waiting: { label: 'ລໍຖ້າອາໄຫຼ່', bg: '#FCE7F3', color: '#BE185D', icon: '⏳' },
    closed: { label: 'ປິດ Job', bg: '#DCFCE7', color: '#047857', icon: '✅' },
  }

  const taskColors: Record<string, { c: string; bg: string; icon: string }> = {
    pending: { c: '#6B7280', bg: '#F3F4F6', icon: '📋' },
    assigned: { c: '#F59E0B', bg: '#FEF3C7', icon: '👤' },
    in_progress: { c: '#3B82F6', bg: '#DBEAFE', icon: '🔄' },
    submitted: { c: '#8B5CF6', bg: '#EDE9FE', icon: '📤' },
    rejected: { c: '#EF4444', bg: '#FEE2E2', icon: '🔧' },
    completed: { c: '#10B981', bg: '#DCFCE7', icon: '✅' },
  }

  const summaryItems = [
    { label: 'ໂຄງການ', value: stats.activeProjects, color: '#2051C6' },
    { label: 'ກຳລັງເຮັດ', value: stats.inProgress, color: '#3B82F6' },
    { label: 'ລໍຖ້າກວດ', value: stats.submitted, color: '#8B5CF6' },
    { label: 'ແກ້ໄຂຄືນ', value: stats.rejected, color: '#EF4444' },
    { label: 'ສຳເລັດ', value: stats.approved, color: '#10B981' },
    { label: 'ບັດແຈ້ງ', value: ticketStats.total, color: '#6D28D9' },
  ]

  const feedItems = useMemo(() => {
    if (!currentUser) return []
    const myTasks = (isProgrammer ? tasks.filter(t => t.assigned_to === currentUser.id) : tasks).slice(0, 8)
    const myTickets = relevantTickets.slice(0, 5)

    const items: Array<{ id: string; type: string; title: string; sub: string; statusLabel: string; icon: string; color: string; bg: string; updated?: string }> = []
    myTasks.forEach((t) => {
      const sk = normalizeTaskStatus(t.status)
      const tc = taskColors[sk] || taskColors.pending
      const cfg = getTaskStatusConfig(t.status)
      const project = projects.find(p => p.id === t.project_id)
      items.push({
        id: `task-${t.id}`, type: 'task',
        title: t.title, sub: project?.title || '',
        statusLabel: cfg.label, icon: tc.icon,
        color: tc.c, bg: tc.bg,
        updated: t.updated_at || t.created_at,
      })
    })
    myTickets.forEach((t) => {
      const st = ticketTheme[t.status] || ticketTheme.open
      items.push({
        id: `ticket-${t.id}`, type: 'ticket',
        title: t.title || `Ticket #${t.id}`,
        sub: `#${t.ticket_number || t.id} • ${t.requester_name || '-'}`,
        statusLabel: st.label, icon: st.icon,
        color: st.color, bg: st.bg,
        updated: t.updated_at || t.created_at,
      })
    })

    items.sort((a, b) => {
      if (a.updated && b.updated) return new Date(b.updated).getTime() - new Date(a.updated).getTime()
      return 0
    })

    return items.slice(0, 10)
  }, [tasks, relevantTickets, projects, isProgrammer, currentUser])

  const activeProjects = projects.filter(p => p.status !== 'completed')

  if (!currentUser) return null

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-[1400px] mx-auto">

      {/* Page Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-md">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">ໜ້າຫຼັກນັກພັດທະນາ</h1>
          <p className="text-xs text-slate-400">ພາບລວມການພັດທະນາ</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-5 items-start">

        {/* ===== Left Sidebar ===== */}
        <div className="w-full md:w-[260px] md:sticky md:top-5 md:self-start flex-shrink-0 flex flex-col gap-4">

          {/* Profile / Progress Card */}
          <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden bg-gradient-to-br from-blue-50/60 via-white to-red-50/30 px-5 py-6 text-center">
            <div className="text-[9px] uppercase tracking-[0.1em] text-slate-400 mb-1.5">
              {new Date().toLocaleDateString('lo-LA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
            <div className="text-lg font-bold text-slate-900 mb-0.5">
              ສະບາຍດີ, {currentUser.name}
            </div>
            <div className="text-[10px] text-slate-500 mb-4">
              ພາບລວມຄວາມຄືບໜ້າ
            </div>

            <div className="relative inline-block mb-3.5">
              <Ring pct={progressPercent} size={110} sw={9} />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[26px] font-bold bg-gradient-to-r from-[#2051C6] to-[#F35B4F] bg-clip-text text-transparent">
                  {progressPercent}%
                </span>
                <span className="text-[8px] text-slate-400">ສຳເລັດ</span>
              </div>
            </div>

            <div className="text-[10px] text-slate-400 font-mono">
              {stats.approved} / {stats.totalTasks} tasks
            </div>

            <div className="mt-3.5 flex flex-col items-center gap-1">
              <button type="button" onClick={() => fetchData()} disabled={isRefreshing}
                className={`bg-blue-100/60 border-none rounded-full px-4 py-1.5 text-[10px] font-semibold text-blue-800 transition-all duration-200 ${isRefreshing ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-blue-100'}`}>
                {isRefreshing ? '⏳ ກຳລັງດຶງ...' : '↻ ດຶງຂໍ້ມູນໃໝ່'}
              </button>
              {lastUpdatedText && (
                <span className="text-[8px] text-slate-400 font-mono">ອັບເດດ {lastUpdatedText}</span>
              )}
            </div>
          </div>

          {/* Stats Summary */}
          <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden px-4 py-4">
            <div className="text-[11px] font-semibold text-slate-900 mb-3 tracking-wide">
              ສະຖິຕິ
            </div>
            <div className="flex flex-col gap-2">
              {summaryItems.map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: item.color }} />
                    <span className="text-[10px] text-slate-500">{item.label}</span>
                  </div>
                  <span className="text-[15px] font-bold" style={{ color: item.color }}>
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Ticket mini stats */}
          <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden px-4 py-4">
            <div className="text-[11px] font-semibold text-slate-900 mb-3">
              Ticket ສະຖານະ
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'ລໍຖ້າ', value: ticketStats.open, color: '#1D4ED8' },
                { label: 'ກຳລັງເຮັດ', value: ticketStats.inProgress, color: '#6D28D9' },
                { label: 'ລໍຖ້າອາໄຫຼ່', value: ticketStats.waiting, color: '#BE185D' },
                { label: 'ປິດແລ້ວ', value: ticketStats.closed, color: '#047857' },
              ].map(item => (
                <div key={item.label} className="py-2 px-2.5 rounded-[10px]"
                  style={{ background: `${item.color}08`, borderLeft: `3px solid ${item.color}` }}>
                  <div className="text-base font-bold" style={{ color: item.color }}>{item.value}</div>
                  <div className="text-[8px] text-slate-400">{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ===== Right: Timeline Feed ===== */}
        <div className="flex-1 min-w-0">

          {/* Activity Feed */}
          <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden mb-5">
            <div className="px-5 py-3.5 border-b border-slate-100 flex justify-between items-center bg-amber-50/40">
              <span className="text-xs font-semibold text-slate-900">ກິດຈະກຳຫຼ້າສຸດ</span>
              <span className="text-[9px] text-slate-400 font-mono">
                {feedItems.length} ລາຍການ
              </span>
            </div>
            <div className="px-5 pt-2 pb-5">
              {feedItems.length > 0 ? (
                <div className="relative pl-7">
                  {/* Timeline line */}
                  <div className="absolute left-[9px] top-4 bottom-4 w-0.5 rounded-full bg-gradient-to-b from-[#2051C6]/20 to-[#F35B4F]/15" />

                  {feedItems.map((item, idx) => (
                    <div key={item.id} className={`relative px-3.5 py-3 ${idx < feedItems.length - 1 ? 'mb-1' : ''} rounded-xl transition-colors duration-150`}>
                      {/* Timeline dot */}
                      <div className="absolute -left-[22px] top-[18px] w-3 h-3 rounded-full z-[1]"
                        style={{
                          background: item.color,
                          border: '2.5px solid rgba(255,253,249,0.95)',
                          boxShadow: `0 0 0 2px ${item.color}30, 0 2px 6px ${item.color}20`,
                        }} />

                      <div className="px-4 py-3 rounded-[14px] border border-slate-900/5 transition-all duration-200"
                        style={{ background: `${item.color}06` }}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span className="text-[8px] font-semibold uppercase tracking-wider px-1.5 py-px rounded"
                                style={{
                                  color: item.type === 'task' ? '#2051C6' : '#6D28D9',
                                  background: item.type === 'task' ? 'rgba(32,81,198,0.08)' : 'rgba(109,40,217,0.08)',
                                }}>
                                {item.type === 'task' ? 'TASK' : 'TICKET'}
                              </span>
                              {item.updated && (
                                <span className="text-[8px] text-slate-400 font-mono">
                                  {new Intl.DateTimeFormat('lo-LA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(item.updated))}
                                </span>
                              )}
                            </div>
                            <div className="text-xs font-semibold text-slate-900 truncate">
                              {item.title}
                            </div>
                            <div className="text-[9px] text-slate-400 mt-px">{item.sub}</div>
                          </div>
                          <span className="px-2.5 py-0.5 rounded-full text-[8px] font-semibold whitespace-nowrap shrink-0"
                            style={{ background: item.bg, color: item.color }}>
                            {item.icon} {item.statusLabel}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 text-slate-400">
                  <div className="text-4xl mb-2 opacity-40">📭</div>
                  <div className="text-[11px]">ບໍ່ມີກິດຈະກຳ</div>
                </div>
              )}
            </div>
          </div>

          {/* Active Projects */}
          <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 flex justify-between items-center bg-amber-50/40">
              <span className="text-xs font-semibold text-slate-900">ໂຄງການກຳລັງດຳເນີນ</span>
              <span className="text-[9px] text-slate-400 font-mono">{activeProjects.length} ໂຄງການ</span>
            </div>
            <div className="p-4">
              {activeProjects.length > 0 ? (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-3">
                  {activeProjects.slice(0, 6).map(project => {
                    const cfg = PROJECT_STATUS[project.status] || { label: project.status, color: '#6B7280', icon: '📁' }
                    const pTasks = isProgrammer
                      ? tasks.filter(t => t.project_id === project.id && t.assigned_to === currentUser.id)
                      : tasks.filter(t => t.project_id === project.id)
                    const done = pTasks.filter(t => normalizeTaskStatus(t.status) === 'completed').length
                    const pct = pTasks.length > 0 ? Math.round((done / pTasks.length) * 100) : 0
                    return (
                      <div key={project.id} className="px-4 py-3.5 rounded-[14px] bg-amber-50/30 border border-slate-900/[0.06] relative overflow-hidden">
                        <div className="absolute top-0 left-0 right-0 h-[3px] opacity-60" style={{ background: cfg.color }} />
                        <div className="flex justify-between items-start gap-1.5 mb-2">
                          <div className="min-w-0 flex-1">
                            <div className="text-[11px] font-semibold text-slate-900 truncate">
                              {project.title}
                            </div>
                            <div className="text-[9px] text-slate-400 font-mono">{project.project_number}</div>
                          </div>
                          <span className="px-2 py-0.5 rounded-full text-[8px] font-semibold whitespace-nowrap"
                            style={{ background: `${cfg.color}15`, color: cfg.color }}>
                            {cfg.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-[5px] bg-slate-900/[0.06] rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-[width] duration-[600ms] ease-out"
                              style={{ width: `${pct}%`, background: cfg.color }} />
                          </div>
                          <span className="text-[9px] font-bold font-mono min-w-[28px] text-right"
                            style={{ color: cfg.color }}>
                            {pct}%
                          </span>
                        </div>
                        <div className="text-[8px] text-slate-400 mt-1">{done}/{pTasks.length} ວຽກ</div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-9 text-slate-400">
                  <div className="text-3xl mb-1.5 opacity-40">📁</div>
                  <div className="text-[10px]">ບໍ່ມີໂຄງການ</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
