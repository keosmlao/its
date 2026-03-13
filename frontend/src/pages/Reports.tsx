import { useEffect, useMemo, useState } from 'react'
import { BarChart3 } from 'lucide-react'
import api from '../lib/api'
import {
  PRIORITY_CONFIG,
  PROJECT_STATUS,
  STATUS_CONFIG,
  TASK_STATUS,
  countTasksByStatus,
} from '../lib/dashboardConstants'

interface Ticket {
  id: number
  status: string
  priority: string
  [key: string]: unknown
}

interface Project {
  id: number
  status: string
  [key: string]: unknown
}

interface Task {
  id: number
  status?: string
  [key: string]: unknown
}

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState('overview')
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [tasks, setTasks] = useState<Task[]>([])

  useEffect(() => {
    Promise.all([
      api.listTickets().then(r => setTickets(r.data || [])),
      api.listProjects().then(r => setProjects(r.data || [])),
      api.listTasks().then(r => setTasks(r.data || [])),
    ]).catch(() => {})
  }, [])

  const stats = useMemo(() => {
    const ticketsByStatus: Record<string, number> = {}
    Object.keys(STATUS_CONFIG).forEach(k => ticketsByStatus[k] = 0)
    tickets.forEach(t => { if (t.status in ticketsByStatus) ticketsByStatus[t.status]++ })

    const ticketsByPriority: Record<string, number> = {}
    Object.keys(PRIORITY_CONFIG).forEach(k => ticketsByPriority[k] = 0)
    tickets.forEach(t => { if (t.priority in ticketsByPriority) ticketsByPriority[t.priority]++ })

    const projectsByStatus: Record<string, number> = {}
    Object.keys(PROJECT_STATUS).forEach(k => projectsByStatus[k] = 0)
    projects.forEach(p => { if (p.status in projectsByStatus) projectsByStatus[p.status]++ })

    const tasksByStatus = countTasksByStatus(tasks)

    return { ticketsByStatus, ticketsByPriority, projectsByStatus, tasksByStatus }
  }, [tickets, projects, tasks])

  const tabs = [
    { id: 'overview', label: 'ພາບລວມ', icon: '📊' },
    { id: 'helpdesk', label: 'ຊ່ວຍເຫຼືອ', icon: '🎧' },
    { id: 'development', label: 'ພັດທະນາ', icon: '💻' },
  ]

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 grid place-items-center text-white shadow-lg shadow-indigo-500/20">
            <BarChart3 size={18} />
          </div>
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">ວິເຄາະ</span>
        </div>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">ລາຍງານ</h1>
        <p className="mt-1.5 text-sm text-slate-500">ພາບລວມສະຖິຕິຂອງລະບົບ IT</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
              activeTab === tab.id
                ? 'bg-slate-900 text-white shadow-md shadow-slate-900/15'
                : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700'
            }`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span>{tab.icon}</span> {tab.label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { icon: '🎫', label: 'ບັດແຈ້ງທັງໝົດ', value: tickets.length, bg: 'bg-sky-50' },
            { icon: '✅', label: 'ປິດແລ້ວ', value: stats.ticketsByStatus.closed || 0, bg: 'bg-emerald-50' },
            { icon: '📁', label: 'ໂຄງການທັງໝົດ', value: projects.length, bg: 'bg-violet-50' },
            { icon: '🏆', label: 'ວຽກສຳເລັດ', value: stats.tasksByStatus.completed || 0, bg: 'bg-amber-50' },
          ].map(card => (
            <div key={card.label} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <div className={`w-10 h-10 rounded-xl ${card.bg} grid place-items-center text-lg mb-3`}>
                {card.icon}
              </div>
              <div className="text-2xl font-bold text-slate-900">{card.value}</div>
              <div className="text-xs text-slate-400 font-medium mt-0.5">{card.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Helpdesk */}
      {activeTab === 'helpdesk' && (
        <div className="grid gap-5 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">ຕາມສະຖານະ</h3>
            </div>
            <div className="p-4 space-y-1">
              {Object.entries(stats.ticketsByStatus).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-slate-50 transition">
                  <span className="text-sm text-slate-600">{STATUS_CONFIG[key]?.label || key}</span>
                  <span className="text-sm font-bold text-slate-900">{value}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">ຕາມຄວາມສຳຄັນ</h3>
            </div>
            <div className="p-4 space-y-1">
              {Object.entries(stats.ticketsByPriority).map(([key, value]) => (
                <div key={key} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ background: PRIORITY_CONFIG[key]?.dot || '#94a3b8' }} />
                  <span className="flex-1 text-sm text-slate-600">{PRIORITY_CONFIG[key]?.label || key}</span>
                  <span className="text-sm font-bold text-slate-900">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Development */}
      {activeTab === 'development' && (
        <div className="grid gap-5 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">ໂຄງການຕາມສະຖານະ</h3>
            </div>
            <div className="p-4 space-y-1">
              {Object.entries(stats.projectsByStatus).filter(([, v]) => v > 0).map(([key, value]) => (
                <div key={key} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition">
                  <span className="text-base">{PROJECT_STATUS[key]?.icon}</span>
                  <span className="flex-1 text-sm text-slate-600">{PROJECT_STATUS[key]?.label || key}</span>
                  <span className="text-sm font-bold text-slate-900">{value}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">ວຽກຕາມສະຖານະ</h3>
            </div>
            <div className="p-4 space-y-1">
              {Object.entries(stats.tasksByStatus).filter(([, v]) => v > 0).map(([key, value]) => (
                <div key={key} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition">
                  <span className="text-base">{TASK_STATUS[key]?.icon}</span>
                  <span className="flex-1 text-sm text-slate-600">{TASK_STATUS[key]?.label || key}</span>
                  <span className="text-sm font-bold text-slate-900">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
