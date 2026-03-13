import { Routes, Route, Navigate, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useEffect, useState, useCallback } from 'react'
import Sidebar from './components/Sidebar'
import NotificationBell from './components/NotificationBell'
import { getStoredUser, getToken, clearUser, type StoredUser } from './lib/auth'

import LoginPage from './pages/Login'
import Dashboard from './pages/Dashboard'
import Tickets from './pages/Tickets'
import Knowledge from './pages/Knowledge'
import ManagerDashboard from './pages/ManagerDashboard'
import DevDashboard from './pages/DevDashboard'
import DevProjects from './pages/DevProjects'
import Assets from './pages/Assets'
import Reports from './pages/Reports'
import Settings from './pages/Settings'

const PAGE_PATH: Record<string, string> = {
  manager_dashboard: '/manager/dashboard',
  dashboard: '/dashboard',
  tickets: '/tickets',
  knowledge: '/knowledge',
  dev_dashboard: '/dev/dashboard',
  dev_projects: '/dev/projects',
  assets: '/assets',
  reports: '/reports',
  settings: '/settings',
}

const PATH_PAGE: Record<string, string> = Object.fromEntries(
  Object.entries(PAGE_PATH).map(([k, v]) => [v, k])
)

function DashboardLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const [currentUser, setCurrentUser] = useState<StoredUser | null>(null)
  const [mounted, setMounted] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    setMounted(true)
    const user = getStoredUser()
    const token = getToken()
    if (!user || !token) {
      clearUser()
      navigate('/login', { replace: true })
      return
    }
    setCurrentUser(user)
  }, [navigate])

  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  const currentPage = PATH_PAGE[location.pathname] || 'tickets'

  const setCurrentPage = useCallback(
    (pageId: string) => {
      const path = PAGE_PATH[pageId]
      if (path) navigate(path)
    },
    [navigate]
  )

  const handleLogout = useCallback(() => {
    clearUser()
    setCurrentUser(null)
    navigate('/login', { replace: true })
  }, [navigate])

  if (!mounted || !currentUser) return null

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar
        currentUser={currentUser}
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        onLogout={handleLogout}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <main className="flex-1 ml-0 min-h-screen lg:ml-[252px] 2xl:ml-[272px]">
        {/* Top bar */}
        <div className="sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-white/80 backdrop-blur border-b border-slate-100 lg:justify-end">
          <button
            type="button"
            className="inline-flex items-center justify-center w-10 h-10 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition lg:hidden"
            onClick={() => setSidebarOpen(true)}
            aria-label="ເປີດເມນູ"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <NotificationBell />
        </div>
        <Outlet />
      </main>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<DashboardLayout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/tickets" element={<Tickets />} />
        <Route path="/knowledge" element={<Knowledge />} />
        <Route path="/manager/dashboard" element={<ManagerDashboard />} />
        <Route path="/dev/dashboard" element={<DevDashboard />} />
        <Route path="/dev/projects" element={<DevProjects />} />
        <Route path="/assets" element={<Assets />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
