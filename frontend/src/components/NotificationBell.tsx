import { useEffect, useState, useRef, useCallback } from 'react'
import { Bell, Check, CheckCheck, Ticket, UserCheck, RefreshCw } from 'lucide-react'
import api from '../lib/api'

interface Notification {
  id: number
  type: string
  title: string
  message: string | null
  link: string | null
  is_read: boolean
  created_at: string
}

const TYPE_ICON: Record<string, typeof Bell> = {
  ticket: Ticket,
  assign: UserCheck,
  status: RefreshCw,
}

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = Math.floor((now - then) / 1000)
  if (diff < 60) return 'ຫາກໍ່ນີ້'
  if (diff < 3600) return `${Math.floor(diff / 60)} ນາທີກ່ອນ`
  if (diff < 86400) return `${Math.floor(diff / 3600)} ຊມ ກ່ອນ`
  return `${Math.floor(diff / 86400)} ມື້ກ່ອນ`
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unread, setUnread] = useState(0)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const fetchNotifications = useCallback(() => {
    api.listNotifications()
      .then((res) => {
        setNotifications(res.data?.data || [])
        setUnread(res.data?.unread || 0)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(fetchNotifications, 30000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const markAllRead = () => {
    api.markNotificationsRead()
      .then(() => {
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
        setUnread(0)
      })
      .catch(() => {})
  }

  const markOneRead = (id: number) => {
    api.markNotificationsRead([id])
      .then(() => {
        setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)))
        setUnread((prev) => Math.max(0, prev - 1))
      })
      .catch(() => {})
  }

  const unreadNotifications = notifications.filter((n) => !n.is_read)

  return (
    <div className="relative" ref={ref}>
      <button
        className="relative w-10 h-10 rounded-xl grid place-items-center text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition"
        onClick={() => setOpen(!open)}
        title="ແຈ້ງເຕືອນ"
      >
        <Bell size={20} strokeWidth={1.8} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-5 h-5 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1 shadow-sm">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-2xl bg-white border border-slate-200 shadow-[0_12px_36px_-8px_rgba(0,0,0,0.12)] overflow-hidden z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <span className="text-sm font-bold text-slate-900">ແຈ້ງເຕືອນ</span>
            {unread > 0 && (
              <button
                className="flex items-center gap-1 text-[11px] font-semibold text-sky-600 hover:text-sky-700 transition"
                onClick={markAllRead}
              >
                <CheckCheck size={14} /> ອ່ານທັງໝົດ
              </button>
            )}
          </div>

          {/* Body */}
          <div className="max-h-80 overflow-y-auto">
            {unreadNotifications.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-slate-300">
                <Bell size={32} strokeWidth={1.2} />
                <span className="text-sm">ບໍ່ມີແຈ້ງເຕືອນ</span>
              </div>
            ) : (
              unreadNotifications.map((n) => {
                const Icon = TYPE_ICON[n.type] || Bell
                return (
                  <div
                    key={n.id}
                    className="flex items-start gap-3 px-4 py-3 border-b border-slate-50 hover:bg-slate-50/80 cursor-pointer transition"
                    onClick={() => markOneRead(n.id)}
                  >
                    <div className={`shrink-0 w-8 h-8 rounded-lg grid place-items-center ${
                      n.type === 'ticket' ? 'bg-sky-50 text-sky-600' :
                      n.type === 'assign' ? 'bg-violet-50 text-violet-600' :
                      'bg-emerald-50 text-emerald-600'
                    }`}>
                      <Icon size={16} strokeWidth={2} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-slate-800 truncate">{n.title}</div>
                      {n.message && <div className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.message}</div>}
                      <div className="text-[10px] text-slate-400 mt-1">{timeAgo(n.created_at)}</div>
                    </div>
                    <button
                      className="shrink-0 w-7 h-7 rounded-lg grid place-items-center text-slate-300 hover:bg-emerald-50 hover:text-emerald-500 transition"
                      onClick={(e) => { e.stopPropagation(); markOneRead(n.id) }}
                      title="ອ່ານແລ້ວ"
                    >
                      <Check size={14} />
                    </button>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
