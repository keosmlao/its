import { useEffect, useMemo, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { LayoutDashboard } from 'lucide-react'
import api from '../lib/api'
import { getStoredUser } from '../lib/auth'

interface Ticket {
  id: number
  ticket_number?: string
  title: string
  status: string
  priority: string
  requester_name?: string
  assignee_name?: string
  created_at?: string
  updated_at?: string
  [key: string]: unknown
}

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  open: { label: 'ລໍຖ້າຮັບງານ', color: '#1E88E5', bg: '#DBEAFE' },
  assigned: { label: 'ຖືກມອບໝາຍ', color: '#B45309', bg: '#FEF3C7' },
  in_progress: { label: 'ກຳລັງດຳເນີນ', color: '#7C3AED', bg: '#EDE9FE' },
  waiting: { label: 'ລໍຖ້າອາໄຫຼ່', color: '#BE185D', bg: '#FCE7F3' },
  closed: { label: 'ປິດ Job', color: '#059669', bg: '#D1FAE5' },
}

const PRIORITY_MAP: Record<string, { label: string; color: string; bg: string; emoji: string }> = {
  low: { label: 'ຕ່ຳ', color: '#6B7280', bg: 'rgba(107,114,128,0.08)', emoji: '▽' },
  medium: { label: 'ກາງ', color: '#2563EB', bg: 'rgba(37,99,235,0.08)', emoji: '◆' },
  high: { label: 'ສູງ', color: '#D97706', bg: 'rgba(217,119,6,0.08)', emoji: '△' },
  critical: { label: 'ວິກິດ', color: '#DC2626', bg: 'rgba(220,38,38,0.08)', emoji: '▲' },
}

export default function HelpdeskDashboardPage() {
  const navigate = useNavigate()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [isRefreshing, setIsRefreshing] = useState(false)
  const user = getStoredUser()

  const fetchData = useCallback(async () => {
    setIsRefreshing(true)
    try { setTickets((await api.listTickets()).data || []) }
    catch { /* ignore */ }
    finally { setIsRefreshing(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const stats = useMemo(() => {
    const total = tickets.length
    const open = tickets.filter(t => t.status === 'open' || t.status === 'assigned').length
    const inProgress = tickets.filter(t => t.status === 'in_progress').length
    const waiting = tickets.filter(t => t.status === 'waiting').length
    const closed = tickets.filter(t => t.status === 'closed').length
    const active = total - closed
    const rate = total > 0 ? Math.round((closed / total) * 100) : 0
    return { total, open, inProgress, waiting, closed, active, rate }
  }, [tickets])

  const criticalOpen = useMemo(() =>
    tickets.filter(t => t.priority === 'critical' && t.status !== 'closed').length
  , [tickets])

  const priorityStats = useMemo(() => {
    const total = tickets.length || 1
    return Object.entries(PRIORITY_MAP).map(([key, cfg]) => {
      const count = tickets.filter(t => t.priority === key).length
      return { key, ...cfg, count, pct: Math.round((count / total) * 100) }
    })
  }, [tickets])

  const recentTickets = useMemo(() =>
    [...tickets]
      .sort((a, b) => (b.updated_at || b.created_at || '').localeCompare(a.updated_at || a.created_at || ''))
      .slice(0, 10)
  , [tickets])

  const statusList = useMemo(() =>
    Object.entries(STATUS_MAP).map(([key, cfg]) => ({
      key, ...cfg, count: tickets.filter(t => t.status === key).length,
    }))
  , [tickets])

  const greeting = useMemo(() => {
    const h = new Date().getHours()
    if (h < 12) return 'ສະບາຍດີຕອນເຊົ້າ'
    if (h < 17) return 'ສະບາຍດີຕອນບ່າຍ'
    return 'ສະບາຍດີຕອນແລງ'
  }, [])

  const fmtTime = (d: string) => {
    try {
      return new Intl.DateTimeFormat('lo-LA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(d))
    } catch { return '' }
  }

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 grid place-items-center text-white shadow-lg shadow-sky-500/20">
            <LayoutDashboard size={18} />
          </div>
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">ຊ່ວຍເຫຼືອ</span>
        </div>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">ໜ້າຫຼັກ</h1>
        <p className="mt-1.5 text-sm text-slate-500">ພາບລວມບັດແຈ້ງບັນຫາ ແລະ ສະຖານະວຽກ</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[300px_1fr] gap-5 min-h-[calc(100vh-80px)]">

        {/* ===== LEFT SIDEBAR ===== */}
        <div className="md:sticky md:top-4 md:self-start flex flex-col gap-3.5">
          {/* Hero card */}
          <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-white border border-white/[0.06] overflow-hidden shadow-sm p-6">
            <div className="text-[9px] uppercase tracking-[1.5px] text-white/45 mb-1.5">
              {new Date().toLocaleDateString('lo-LA', { weekday: 'long', day: 'numeric', month: 'long' })}
            </div>
            <div className="text-xl font-bold mb-0.5">
              {greeting}
            </div>
            <div className="text-xs text-white/60 mb-5">
              {user?.name || 'User'}
            </div>

            {/* Big number */}
            <div className="flex items-end gap-3 mb-4">
              <div className="text-[52px] font-bold leading-none text-white">
                {stats.active}
              </div>
              <div className="mb-1.5">
                <div className="text-[11px] font-semibold text-white/70">ເປີດຢູ່</div>
                <div className="text-[9px] text-white/40">ຈາກ {stats.total} ທັງໝົດ</div>
              </div>
            </div>

            {/* Mini progress */}
            <div className="mb-2.5">
              <div className="flex justify-between mb-1.5">
                <span className="text-[9px] text-white/50">ອັດຕາແກ້ໄຂ</span>
                <span className="text-[11px] font-bold text-emerald-400">{stats.rate}%</span>
              </div>
              <div className="h-[5px] bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all duration-700 ease-out"
                  style={{ width: `${stats.rate}%` }}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={fetchData}
              disabled={isRefreshing}
              className={`w-full py-2 border border-white/[0.12] rounded-[10px] bg-white/[0.06] text-white/70 text-[10px] font-semibold transition-all duration-200 ${
                isRefreshing ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:bg-white/[0.1]'
              }`}
            >
              {isRefreshing ? 'ກຳລັງດຶງ...' : 'ດຶງຂໍ້ມູນໃໝ່'}
            </button>
          </div>

          {/* Alert card */}
          {criticalOpen > 0 && (
            <div className="rounded-2xl border border-red-500/[0.12] bg-red-500/[0.04] shadow-sm overflow-hidden px-4 py-3.5">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-[11px] font-bold text-red-600">
                  {criticalOpen} ບັດແຈ້ງລະດັບວິກິດ
                </span>
              </div>
              <div className="text-[10px] text-red-900 mt-1 pl-4">
                ຕ້ອງໄດ້ຮັບການແກ້ໄຂທັນທີ
              </div>
            </div>
          )}

          {/* Status breakdown */}
          <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden p-4">
            <div className="text-[11px] font-bold text-slate-900 mb-2.5 pl-1">
              ສະຖານະ
            </div>
            {statusList.map(s => {
              const pct = stats.total > 0 ? (s.count / stats.total) * 100 : 0
              return (
                <div key={s.key} className="flex items-center justify-between px-3.5 py-2.5 rounded-xl cursor-default transition-colors duration-150 hover:bg-slate-900/[0.03]">
                  <div className="flex items-center gap-2.5">
                    <div
                      className="w-8 h-8 rounded-[10px] flex items-center justify-center text-[13px] font-bold"
                      style={{ background: s.bg, color: s.color }}
                    >
                      {s.count}
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold text-slate-900">{s.label}</div>
                      <div className="text-[8px] text-slate-400">{Math.round(pct)}%</div>
                    </div>
                  </div>
                  <div className="w-[50px] h-1 bg-slate-900/[0.06] rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: s.color }} />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Priority */}
          <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden p-4">
            <div className="text-[11px] font-bold text-slate-900 mb-2.5 pl-1">
              ຄວາມສຳຄັນ
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-4 gap-2">
              {priorityStats.map(p => (
                <div key={p.key} className="text-center py-3 px-1 rounded-xl" style={{ background: p.bg }}>
                  <div className="text-[10px] mb-0.5">{p.emoji}</div>
                  <div className="text-lg font-bold" style={{ color: p.color }}>{p.count}</div>
                  <div className="text-[8px] font-semibold mt-px" style={{ color: p.color }}>{p.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ===== RIGHT: TICKETS LIST ===== */}
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden self-start">
          <div className="px-5 py-4 flex justify-between items-center border-b border-slate-900/[0.06]">
            <div>
              <div className="text-sm font-bold text-slate-900">ລ່າສຸດ</div>
              <div className="text-[10px] text-slate-400 mt-0.5">{tickets.length} ລາຍການທັງໝົດ</div>
            </div>
            <button
              onClick={() => navigate('/tickets')}
              className="border border-blue-600/20 bg-blue-600/[0.06] rounded-full px-3.5 py-1.5 text-blue-600 font-semibold cursor-pointer text-[10px] hover:bg-blue-600/[0.1] transition-colors"
            >
              ເບິ່ງທັງໝົດ
            </button>
          </div>

          {recentTickets.length > 0 ? recentTickets.map(t => {
            const st = STATUS_MAP[t.status] || STATUS_MAP.open
            const pr = PRIORITY_MAP[t.priority] || PRIORITY_MAP.medium
            return (
              <div
                key={t.id}
                className="flex items-center gap-3 px-5 py-3 border-b border-slate-900/[0.04] last:border-b-0 cursor-pointer transition-colors duration-150 hover:bg-blue-600/[0.03]"
                onClick={() => navigate('/tickets')}
              >
                {/* Priority bar */}
                <div
                  className="w-[3px] h-10 rounded-full shrink-0 opacity-70"
                  style={{ background: pr.color }}
                />

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="text-[12.5px] font-semibold text-slate-900 whitespace-nowrap overflow-hidden text-ellipsis">
                    {t.title}
                  </div>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <span className="text-[9px] font-mono text-slate-400 bg-slate-900/[0.04] px-1.5 py-px rounded">
                      #{t.ticket_number || t.id}
                    </span>
                    {t.requester_name && (
                      <span className="text-[9px] text-slate-500">
                        {t.requester_name}
                      </span>
                    )}
                    {(t.updated_at || t.created_at) && (
                      <span className="text-[8px] text-slate-400 font-mono">
                        {fmtTime(t.updated_at || t.created_at || '')}
                      </span>
                    )}
                  </div>
                </div>

                {/* Priority + Status */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <span
                    className="px-2 py-[3px] rounded-md text-[8px] font-bold"
                    style={{ background: pr.bg, color: pr.color }}
                  >
                    {pr.emoji} {pr.label}
                  </span>
                  <span
                    className="px-2.5 py-[3px] rounded-full text-[9px] font-semibold whitespace-nowrap"
                    style={{ background: st.bg, color: st.color }}
                  >
                    {st.label}
                  </span>
                </div>
              </div>
            )
          }) : (
            <div className="text-center py-16 text-slate-400">
              <div className="text-[40px] mb-2 opacity-30">📋</div>
              <div className="text-xs">ບໍ່ມີບັດແຈ້ງ</div>
              <div className="text-[10px] mt-1">ລະບົບເຮັດວຽກປົກກະຕິ</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
