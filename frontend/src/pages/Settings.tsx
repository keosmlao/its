import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Settings } from 'lucide-react'
import api from '../lib/api'
import { getToken, getStoredUser } from '../lib/auth'

interface User {
  id: number
  name: string
  username: string
  role: string
  avatar?: string
  [key: string]: unknown
}

interface Category {
  id: number
  name: string
  icon: string
  color?: string
}

interface SlaRow {
  id: number
  priority: string
  response_minutes: number
  resolution_minutes: number
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('it.settings.tab') || 'general'
  })
  const [users, setUsers] = useState<User[]>([])
  const [usersError, setUsersError] = useState('')
  const [usersLoading, setUsersLoading] = useState(false)
  const [deletingUserId, setDeletingUserId] = useState<number | null>(null)
  const [changingRoleId, setChangingRoleId] = useState<number | null>(null)
  const currentUser = getStoredUser()
  const [categories, setCategories] = useState<Category[]>([])
  const [newCategory, setNewCategory] = useState({ name: '', icon: '📂', color: '' })
  const [categoryError, setCategoryError] = useState('')
  const [categoriesLoading, setCategoriesLoading] = useState(false)
  const [sla, setSla] = useState<SlaRow[]>([])
  const [slaLoading, setSlaLoading] = useState(false)
  const [slaError, setSlaError] = useState('')
  const [newSla, setNewSla] = useState({ priority: 'critical', response_hours: '', response_minutes: '', resolution_hours: '', resolution_minutes: '' })
  const [isEditingSla, setIsEditingSla] = useState(false)
  const [editingSlaId, setEditingSlaId] = useState<number | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const token = getToken()
    if (!token) {
      navigate('/login', { replace: true })
    }
  }, [navigate])

  useEffect(() => {
    localStorage.setItem('it.settings.tab', activeTab)
  }, [activeTab])

  const fetchUsers = () => {
    setUsersLoading(true)
    setUsersError('')
    return api.listUsers()
      .then((res) => { setUsers(res.data || []) })
      .catch((err: unknown) => {
        const e = err as { response?: { data?: { error?: string } }; message?: string }
        setUsersError(e?.response?.data?.error || e?.message || 'ດຶງຂໍ້ມູນຜູ້ໃຊ້ລົ້ມເຫຼວ')
      })
      .finally(() => { setUsersLoading(false) })
  }

  useEffect(() => {
    if (activeTab !== 'users') return
    let isActive = true
    fetchUsers().finally(() => { if (!isActive) return })
    return () => { isActive = false }
  }, [activeTab])

  const isManager = currentUser?.role === 'manager'

  const handleChangeRole = async (user: User, newRole: string) => {
    if (newRole === user.role) return
    setUsersError('')
    setChangingRoleId(user.id)
    try {
      await api.updateUser(user.id, { role: newRole })
      await fetchUsers()
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: { error?: string } }; message?: string }
      if (e?.response?.status === 401) { navigate('/login', { replace: true }); return }
      setUsersError(e?.response?.data?.error || e?.message || 'ປ່ຽນສິດລົ້ມເຫຼວ')
    } finally {
      setChangingRoleId(null)
    }
  }

  const handleDeleteUser = async (user: User) => {
    const confirmed = window.confirm(`ຕ້ອງການລົບ user "${user.name || user.username}" ແທ້ບໍ?`)
    if (!confirmed) return

    setUsersError('')
    setDeletingUserId(user.id)
    try {
      await api.deleteUser(user.id)
      await fetchUsers()
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: { error?: string } }; message?: string }
      if (e?.response?.status === 401) { navigate('/login', { replace: true }); return }
      setUsersError(e?.response?.data?.error || e?.message || 'ລົບຜູ້ໃຊ້ລົ້ມເຫຼວ')
    } finally {
      setDeletingUserId(null)
    }
  }

  const fetchCategories = () => {
    setCategoriesLoading(true)
    setCategoryError('')
    return api.listCategories()
      .then((res) => { setCategories(res.data || []) })
      .catch((err: unknown) => {
        const e = err as { response?: { data?: { error?: string } } }
        setCategoryError(e?.response?.data?.error || 'ດຶງໝວດໝູ່ລົ້ມເຫຼວ')
      })
      .finally(() => { setCategoriesLoading(false) })
  }

  useEffect(() => {
    if (activeTab !== 'categories') return
    fetchCategories()
  }, [activeTab])

  const fetchSla = () => {
    setSlaLoading(true)
    setSlaError('')
    return api.listSla()
      .then((res) => { setSla(res.data || []) })
      .catch((err: unknown) => {
        const e = err as { response?: { data?: { error?: string } } }
        setSlaError(e?.response?.data?.error || 'ດຶງ SLA ລົ້ມເຫຼວ')
      })
      .finally(() => { setSlaLoading(false) })
  }

  useEffect(() => {
    if (activeTab !== 'sla') return
    fetchSla()
  }, [activeTab])

  const handleAddSla = (event: React.FormEvent) => {
    event.preventDefault()
    setSlaError('')
    const responseHours = Number(newSla.response_hours)
    const responseMinutesPart = Number(newSla.response_minutes)
    const resolutionHours = Number(newSla.resolution_hours)
    const resolutionMinutesPart = Number(newSla.resolution_minutes)
    if ((!responseHours && !responseMinutesPart) || (!resolutionHours && !resolutionMinutesPart)) {
      setSlaError('ກະລຸນາປ້ອນເວລາຕອບສະໜອງ/ແກ້ໄຂ'); return
    }
    if (responseHours < 0 || resolutionHours < 0 || responseMinutesPart < 0 || resolutionMinutesPart < 0) {
      setSlaError('ເວລາຕ້ອງບໍ່ຕ່ຳກວ່າ 0'); return
    }
    if (responseMinutesPart >= 60 || resolutionMinutesPart >= 60) {
      setSlaError('ນາທີຕ້ອງນ້ອຍກວ່າ 60'); return
    }
    const responseMinutes = Math.round(responseHours * 60 + responseMinutesPart)
    const resolutionMinutes = Math.round(resolutionHours * 60 + resolutionMinutesPart)
    if (responseMinutes <= 0 || resolutionMinutes <= 0) {
      setSlaError('ເວລາຕ້ອງຫຼາຍກວ່າ 0'); return
    }
    api.createSla({ priority: newSla.priority, response_minutes: responseMinutes, resolution_minutes: resolutionMinutes })
      .then(() => {
        setNewSla({ ...newSla, response_hours: '', response_minutes: '', resolution_hours: '', resolution_minutes: '' })
        return fetchSla()
      })
      .catch((err: unknown) => {
        const e = err as { response?: { data?: { error?: string } } }
        setSlaError(e?.response?.data?.error || 'ສ້າງ SLA ລົ້ມເຫຼວ')
      })
  }

  const startEditSla = (row: SlaRow) => {
    setIsEditingSla(true)
    setEditingSlaId(row.id)
    setNewSla({
      priority: row.priority,
      response_hours: String(Math.floor(row.response_minutes / 60)),
      response_minutes: String(row.response_minutes % 60),
      resolution_hours: String(Math.floor(row.resolution_minutes / 60)),
      resolution_minutes: String(row.resolution_minutes % 60),
    })
  }

  const cancelEditSla = () => {
    setIsEditingSla(false)
    setEditingSlaId(null)
    setNewSla({ priority: 'critical', response_hours: '', response_minutes: '', resolution_hours: '', resolution_minutes: '' })
    setSlaError('')
  }

  const handleUpdateSla = (event: React.FormEvent) => {
    event.preventDefault()
    setSlaError('')
    if (!editingSlaId) return
    const responseHours = Number(newSla.response_hours)
    const responseMinutesPart = Number(newSla.response_minutes)
    const resolutionHours = Number(newSla.resolution_hours)
    const resolutionMinutesPart = Number(newSla.resolution_minutes)
    if ((!responseHours && !responseMinutesPart) || (!resolutionHours && !resolutionMinutesPart)) {
      setSlaError('ກະລຸນາປ້ອນເວລາຕອບສະໜອງ/ແກ້ໄຂ'); return
    }
    if (responseHours < 0 || resolutionHours < 0 || responseMinutesPart < 0 || resolutionMinutesPart < 0) {
      setSlaError('ເວລາຕ້ອງບໍ່ຕ່ຳກວ່າ 0'); return
    }
    if (responseMinutesPart >= 60 || resolutionMinutesPart >= 60) {
      setSlaError('ນາທີຕ້ອງນ້ອຍກວ່າ 60'); return
    }
    const responseMinutes = Math.round(responseHours * 60 + responseMinutesPart)
    const resolutionMinutes = Math.round(resolutionHours * 60 + resolutionMinutesPart)
    if (responseMinutes <= 0 || resolutionMinutes <= 0) {
      setSlaError('ເວລາຕ້ອງຫຼາຍກວ່າ 0'); return
    }
    api.updateSla(editingSlaId, { priority: newSla.priority, response_minutes: responseMinutes, resolution_minutes: resolutionMinutes })
      .then(() => { cancelEditSla(); return fetchSla() })
      .catch((err: unknown) => {
        const e = err as { response?: { data?: { error?: string } } }
        setSlaError(e?.response?.data?.error || 'ອັບເດດ SLA ລົ້ມເຫຼວ')
      })
  }

  const handleDeleteSla = (id: number) => {
    api.deleteSla(id)
      .then(() => fetchSla())
      .catch((err: unknown) => {
        const e = err as { response?: { data?: { error?: string } } }
        setSlaError(e?.response?.data?.error || 'ລຶບ SLA ລົ້ມເຫຼວ')
      })
  }

  const handleAddCategory = (event: React.FormEvent) => {
    event.preventDefault()
    setCategoryError('')
    if (!newCategory.name.trim()) { setCategoryError('ກະລຸນາປ້ອນຊື່ໝວດໝູ່'); return }
    api.createCategory({ name: newCategory.name.trim(), icon: newCategory.icon || '📂', color: newCategory.color || '#6B7280' })
      .then(() => { setNewCategory({ name: '', icon: newCategory.icon, color: newCategory.color }); return fetchCategories() })
      .catch((err: unknown) => {
        const e = err as { response?: { data?: { error?: string } } }
        setCategoryError(e?.response?.data?.error || 'ສ້າງໝວດໝູ່ລົ້ມເຫຼວ')
      })
  }

  const handleRemoveCategory = (id: number) => {
    api.deleteCategory(id)
      .then(() => fetchCategories())
      .catch((err: unknown) => {
        const e = err as { response?: { data?: { error?: string } } }
        setCategoryError(e?.response?.data?.error || 'ລຶບໝວດໝູ່ລົ້ມເຫຼວ')
      })
  }

  const tabs = [
    { key: 'general', icon: '⚙️', label: 'ທົ່ວໄປ', desc: 'ຂໍ້ມູນລະບົບ' },
    { key: 'users', icon: '👥', label: 'ຜູ້ໃຊ້ງານ', desc: 'ຈັດການບັນຊີ' },
    { key: 'categories', icon: '📂', label: 'ໝວດໝູ່', desc: 'ປະເພດ Ticket' },
    { key: 'sla', icon: '⏱️', label: 'SLA', desc: 'ເວລາຕອບສະໜອງ' },
  ]

  const roleLabels: Record<string, { label: string; color: string; bg: string }> = {
    manager: { label: 'ຜູ້ຈັດການ', color: '#1E40AF', bg: '#DBEAFE' },
    helpdesk: { label: 'ຊ່ວຍເຫຼືອ', color: '#0F766E', bg: '#CCFBF1' },
    it_support: { label: 'ຊ່າງ IT', color: '#7C3AED', bg: '#EDE9FE' },
    lead_programmer: { label: 'ຫົວໜ້ານັກພັດທະນາ', color: '#B45309', bg: '#FEF3C7' },
    programmer: { label: 'ນັກພັດທະນາ', color: '#374151', bg: '#F3F4F6' },
  }

  const priorityLabels: Record<string, { label: string; color: string; bg: string }> = {
    critical: { label: 'ວິກິດ', color: '#DC2626', bg: '#FEE2E2' },
    high: { label: 'ສູງ', color: '#EA580C', bg: '#FFEDD5' },
    medium: { label: 'ກາງ', color: '#CA8A04', bg: '#FEF9C3' },
    low: { label: 'ຕ່ຳ', color: '#16A34A', bg: '#DCFCE7' },
  }

  const getRoleIcon = (role: string) => {
    const icons: Record<string, string> = { manager: '👔', helpdesk: '🎧', it_support: '🛠️', lead_programmer: '👩‍💻', programmer: '🧑‍💻' }
    return icons[role] || '👤'
  }

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-[1400px] mx-auto text-[13px] leading-relaxed">

      {/* Page Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-600 text-white shadow-md">
          <Settings className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-900">ການຕັ້ງຄ່າ</h1>
          <p className="text-xs text-slate-400 mt-0.5">ຈັດການລະບົບ IT</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-5 items-start">

        {/* ---- Sidebar Navigation ---- */}
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden sticky top-5">
          <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-br from-blue-50/60 to-rose-50/40">
            <div className="text-sm font-bold text-slate-900">ການຕັ້ງຄ່າ</div>
            <div className="text-[11px] text-slate-400 mt-0.5">ຈັດການລະບົບ IT</div>
          </div>
          <div className="p-2">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.key
              return (
                <div
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl mb-0.5 cursor-pointer transition-all duration-200 border-l-[3px] ${
                    isActive
                      ? 'bg-gradient-to-r from-blue-50 to-blue-50/30 border-l-blue-700'
                      : 'bg-transparent border-l-transparent hover:bg-slate-50'
                  }`}
                >
                  <span className="text-lg leading-none">{tab.icon}</span>
                  <div>
                    <div className={`text-[13px] ${isActive ? 'font-semibold text-blue-800' : 'font-medium text-slate-700'}`}>{tab.label}</div>
                    <div className="text-[10.5px] text-slate-400 mt-px">{tab.desc}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ---- Content Area ---- */}
        <div className="flex flex-col gap-4">

          {/* ===== GENERAL TAB ===== */}
          {activeTab === 'general' && (
            <>
              <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/60 flex justify-between items-center">
                  <div>
                    <div className="text-sm font-bold text-slate-900">⚙️ ການຕັ້ງຄ່າທົ່ວໄປ</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">ຂໍ້ມູນພື້ນຖານຂອງລະບົບ</div>
                  </div>
                </div>
                <div className="p-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1.5">ຊື່ອົງກອນ</label>
                      <input className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/15" defaultValue="ພະແນກ IT" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1.5">ອີເມວຕິດຕໍ່</label>
                      <input className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/15" placeholder="it@company.com" />
                    </div>
                  </div>
                  <div className="mt-5 flex justify-end">
                    <button className="rounded-xl px-6 py-2.5 text-sm font-semibold text-white bg-gradient-to-br from-blue-600 to-blue-500 shadow-lg shadow-blue-600/30 hover:shadow-blue-600/40 transition-shadow">
                      💾 ບັນທຶກການຕັ້ງຄ່າ
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ===== USERS TAB ===== */}
          {activeTab === 'users' && (
            <>
              {usersError && (
                <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600 font-medium">
                  {usersError}
                </div>
              )}
              <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/60 flex justify-between items-center">
                  <div className="text-[13px] font-bold text-slate-900">👥 ລາຍຊື່ຜູ້ໃຊ້</div>
                  <div className="text-[11px] text-slate-400 bg-slate-100 px-2.5 py-0.5 rounded-full">
                    {users.length} ຄົນ
                  </div>
                </div>
                {usersLoading ? (
                  <div className="py-10 text-center text-slate-400 text-[13px]">ກຳລັງໂຫລດ...</div>
                ) : users.length === 0 ? (
                  <div className="py-10 text-center text-slate-400 text-[13px]">ບໍ່ມີຂໍ້ມູນຜູ້ໃຊ້</div>
                ) : (
                  <div className="py-1">
                    {users.map((user, idx) => {
                      const rl = roleLabels[user.role] || { label: user.role, color: '#374151', bg: '#F3F4F6' }
                      return (
                        <div
                          key={user.id}
                          className={`flex items-center gap-3.5 px-5 py-3 transition-colors hover:bg-slate-50 ${
                            idx < users.length - 1 ? 'border-b border-slate-100/60' : ''
                          }`}
                        >
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0"
                            style={{ background: `linear-gradient(135deg, ${rl.bg}, ${rl.bg}dd)` }}
                          >
                            {user.avatar || getRoleIcon(user.role)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-[13px] text-slate-900">{user.name}</div>
                            <div className="text-[11px] text-slate-400 mt-px">@{user.username}</div>
                          </div>
                          {isManager ? (
                            <select
                              value={user.role}
                              disabled={changingRoleId === user.id}
                              onChange={e => handleChangeRole(user, e.target.value)}
                              className="py-1 px-2.5 rounded-lg text-[11px] font-semibold outline-none appearance-auto"
                              style={{
                                color: rl.color,
                                background: rl.bg,
                                border: `1px solid ${rl.color}30`,
                                cursor: changingRoleId === user.id ? 'not-allowed' : 'pointer',
                                opacity: changingRoleId === user.id ? 0.5 : 1,
                              }}
                            >
                              <option value="manager">ຜູ້ຈັດການ</option>
                              <option value="helpdesk">ຊ່ວຍເຫຼືອ</option>
                              <option value="it_support">ຊ່າງ IT</option>
                              <option value="lead_programmer">ຫົວໜ້ານັກພັດທະນາ</option>
                              <option value="programmer">ນັກພັດທະນາ</option>
                            </select>
                          ) : (
                            <span
                              className="inline-block py-1 px-2.5 rounded-full text-[11px] font-semibold"
                              style={{ color: rl.color, background: rl.bg }}
                            >
                              {rl.label}
                            </span>
                          )}
                          {isManager && (
                            <div className="flex gap-1.5">
                              <button
                                type="button"
                                disabled={deletingUserId === user.id}
                                onClick={() => handleDeleteUser(user)}
                                className={`rounded-lg px-2.5 py-1.5 text-[13px] bg-red-500/[0.08] border border-red-500/15 transition-all ${
                                  deletingUserId === user.id ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-red-500/[0.14]'
                                }`}
                              >
                                {deletingUserId === user.id ? '...' : '🗑️'}
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </>
          )}

          {/* ===== CATEGORIES TAB ===== */}
          {activeTab === 'categories' && (
            <>
              <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/60">
                  <div className="text-sm font-bold text-slate-900">📂 ຈັດການໝວດໝູ່</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">ໝວດໝູ່ສຳລັບຈັດປະເພດ Ticket</div>
                </div>
                <form onSubmit={handleAddCategory} className="p-5 border-b border-slate-100">
                  <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_1fr] gap-3.5 items-end">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1.5">ຊື່ໝວດໝູ່</label>
                      <input
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/15"
                        placeholder="ເຊັ່ນ: ເຄືອຂ່າຍ, ຊອບແວ"
                        value={newCategory.name}
                        onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1.5">Icon</label>
                      <input
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/15"
                        placeholder="📂"
                        value={newCategory.icon}
                        onChange={(e) => setNewCategory({ ...newCategory, icon: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1.5">ສີ</label>
                      <div className="flex gap-2 items-center">
                        <div
                          className="w-8 h-8 rounded-lg shrink-0 border-2 border-slate-200/60"
                          style={{ background: newCategory.color || '#6B7280' }}
                        />
                        <input
                          className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/15"
                          placeholder="#3B82F6"
                          value={newCategory.color}
                          onChange={(e) => setNewCategory({ ...newCategory, color: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                  {categoryError && (
                    <div className="mt-3 rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600 font-medium">
                      {categoryError}
                    </div>
                  )}
                  <div className="mt-3.5 flex justify-end">
                    <button
                      type="submit"
                      className="rounded-xl px-6 py-2.5 text-sm font-semibold text-white bg-gradient-to-br from-blue-600 to-blue-500 shadow-lg shadow-blue-600/30 hover:shadow-blue-600/40 transition-shadow"
                    >
                      ➕ ເພີ່ມໝວດໝູ່
                    </button>
                  </div>
                </form>

                <div className="p-5">
                  {categoriesLoading ? (
                    <div className="text-center py-5 text-slate-400 text-[13px]">ກຳລັງໂຫລດ...</div>
                  ) : categories.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 text-[13px]">
                      <div className="text-[32px] mb-2">📭</div>
                      ຍັງບໍ່ມີໝວດໝູ່
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2.5">
                      {categories.map((cat) => (
                        <div
                          key={cat.id}
                          className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-white border border-slate-200/80 shadow-sm transition-all hover:shadow-md"
                        >
                          <div
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ background: cat.color || '#6B7280' }}
                          />
                          <span className="text-base">{cat.icon}</span>
                          <span className="text-[13px] font-medium text-slate-900">{cat.name}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveCategory(cat.id)}
                            className="bg-transparent border-none cursor-pointer text-slate-400 text-sm px-1 py-0.5 rounded hover:text-red-500 transition-colors ml-0.5"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* ===== SLA TAB ===== */}
          {activeTab === 'sla' && (
            <>
              <div className={`rounded-2xl shadow-sm overflow-hidden ${
                isEditingSla
                  ? 'bg-gradient-to-br from-amber-50/50 to-white border border-amber-300/30'
                  : 'bg-white border border-slate-200/80'
              }`}>
                <div className={`px-5 py-4 border-b flex justify-between items-center ${
                  isEditingSla
                    ? 'border-amber-200/40 bg-amber-50/30'
                    : 'border-slate-100 bg-slate-50/60'
                }`}>
                  <div>
                    <div className="text-sm font-bold text-slate-900">
                      {isEditingSla ? '✏️ ແກ້ໄຂ SLA' : '⏱️ ຕັ້ງຄ່າ SLA'}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">ກຳນົດເວລາຕອບສະໜອງ ແລະ ແກ້ໄຂ ຕາມຄວາມສຳຄັນ</div>
                  </div>
                  {isEditingSla && (
                    <button
                      onClick={cancelEditSla}
                      className="bg-slate-100 border-none rounded-lg px-3.5 py-1.5 text-xs cursor-pointer text-slate-500 font-medium hover:bg-slate-200 transition-colors"
                    >
                      ✕ ຍົກເລີກ
                    </button>
                  )}
                </div>
                <form onSubmit={isEditingSla ? handleUpdateSla : handleAddSla} className="p-5">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1.5">ຄວາມສຳຄັນ</label>
                      <select
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/15"
                        value={newSla.priority}
                        onChange={(e) => setNewSla({ ...newSla, priority: e.target.value })}
                      >
                        <option value="critical">🔴 ວິກິດ (Critical)</option>
                        <option value="high">🟠 ສູງ (High)</option>
                        <option value="medium">🟡 ກາງ (Medium)</option>
                        <option value="low">🟢 ຕ່ຳ (Low)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1.5">ເວລາຕອບສະໜອງ</label>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="relative">
                          <input
                            className="w-full px-3.5 py-2.5 pr-9 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/15"
                            placeholder="0"
                            type="number"
                            min="0"
                            step="1"
                            value={newSla.response_hours}
                            onChange={(e) => setNewSla({ ...newSla, response_hours: e.target.value })}
                          />
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">ชม.</span>
                        </div>
                        <div className="relative">
                          <input
                            className="w-full px-3.5 py-2.5 pr-8 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/15"
                            placeholder="0"
                            type="number"
                            min="0"
                            max="59"
                            step="1"
                            value={newSla.response_minutes}
                            onChange={(e) => setNewSla({ ...newSla, response_minutes: e.target.value })}
                          />
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">ນທ.</span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1.5">ເວລາແກ້ໄຂ</label>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="relative">
                          <input
                            className="w-full px-3.5 py-2.5 pr-9 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/15"
                            placeholder="0"
                            type="number"
                            min="0"
                            step="1"
                            value={newSla.resolution_hours}
                            onChange={(e) => setNewSla({ ...newSla, resolution_hours: e.target.value })}
                          />
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">ชม.</span>
                        </div>
                        <div className="relative">
                          <input
                            className="w-full px-3.5 py-2.5 pr-8 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/15"
                            placeholder="0"
                            type="number"
                            min="0"
                            max="59"
                            step="1"
                            value={newSla.resolution_minutes}
                            onChange={(e) => setNewSla({ ...newSla, resolution_minutes: e.target.value })}
                          />
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">ນທ.</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  {slaError && (
                    <div className="mt-3 rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600 font-medium">
                      {slaError}
                    </div>
                  )}
                  <div className="mt-4 flex justify-end">
                    <button
                      type="submit"
                      className={`rounded-xl px-6 py-2.5 text-sm font-semibold text-white transition-shadow ${
                        isEditingSla
                          ? 'bg-gradient-to-br from-amber-500 to-yellow-500 shadow-lg shadow-amber-500/30 hover:shadow-amber-500/40'
                          : 'bg-gradient-to-br from-blue-600 to-blue-500 shadow-lg shadow-blue-600/30 hover:shadow-blue-600/40'
                      }`}
                    >
                      {isEditingSla ? '💾 ອັບເດດ SLA' : '➕ ເພີ່ມ SLA'}
                    </button>
                  </div>
                </form>
              </div>

              {/* SLA list */}
              <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/60 flex justify-between items-center">
                  <div className="text-[13px] font-bold text-slate-900">⏱️ ກົດເກນ SLA ປັດຈຸບັນ</div>
                  <div className="text-[11px] text-slate-400 bg-slate-100 px-2.5 py-0.5 rounded-full">
                    {sla.length} ລາຍການ
                  </div>
                </div>
                {slaLoading ? (
                  <div className="py-10 text-center text-slate-400 text-[13px]">ກຳລັງໂຫລດ...</div>
                ) : sla.length === 0 ? (
                  <div className="py-10 text-center text-slate-400 text-[13px]">
                    <div className="text-[32px] mb-2">📭</div>
                    ຍັງບໍ່ໄດ້ຕັ້ງຄ່າ SLA
                  </div>
                ) : (
                  <div>
                    {/* Table header */}
                    <div className="grid grid-cols-[1.2fr_1.5fr_1.5fr_100px] px-5 py-2.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400 border-b border-slate-100">
                      <div>ຄວາມສຳຄັນ</div>
                      <div>ເວລາຕອບສະໜອງ</div>
                      <div>ເວລາແກ້ໄຂ</div>
                      <div className="text-right">ຈັດການ</div>
                    </div>
                    {sla.map((row, idx) => {
                      const pl = priorityLabels[row.priority] || { label: row.priority, color: '#374151', bg: '#F3F4F6' }
                      return (
                        <div
                          key={row.id}
                          className={`grid grid-cols-[1.2fr_1.5fr_1.5fr_100px] px-5 py-3.5 items-center hover:bg-slate-50 transition-colors ${
                            idx < sla.length - 1 ? 'border-b border-slate-100/60' : ''
                          }`}
                        >
                          <div>
                            <span
                              className="inline-block py-1 px-3 rounded-full text-xs font-semibold"
                              style={{ color: pl.color, background: pl.bg }}
                            >
                              {pl.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[13px]">
                            <span className="font-semibold text-slate-900">{Math.floor(row.response_minutes / 60)}</span>
                            <span className="text-slate-400 text-[11px]">ชม.</span>
                            <span className="font-semibold text-slate-900">{row.response_minutes % 60}</span>
                            <span className="text-slate-400 text-[11px]">ນທ.</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[13px]">
                            <span className="font-semibold text-slate-900">{Math.floor(row.resolution_minutes / 60)}</span>
                            <span className="text-slate-400 text-[11px]">ชม.</span>
                            <span className="font-semibold text-slate-900">{row.resolution_minutes % 60}</span>
                            <span className="text-slate-400 text-[11px]">ນທ.</span>
                          </div>
                          <div className="flex gap-1.5 justify-end">
                            <button
                              type="button"
                              onClick={() => startEditSla(row)}
                              className="bg-blue-500/[0.08] border border-blue-500/15 rounded-lg px-2.5 py-1.5 cursor-pointer text-[13px] hover:bg-blue-500/[0.14] transition-colors"
                            >
                              ✏️
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteSla(row.id)}
                              className="bg-red-500/[0.08] border border-red-500/15 rounded-lg px-2.5 py-1.5 cursor-pointer text-[13px] hover:bg-red-500/[0.14] transition-colors"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
