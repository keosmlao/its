import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Building2,
  Code2,
  FolderKanban,
  Headphones,
  LayoutDashboard,
  LogOut,
  Monitor,
  Settings,
  Sparkles,
  Ticket,
  X,
  type LucideIcon,
} from 'lucide-react'

interface NavItem {
  id: string
  icon: LucideIcon
  label: string
  caption: string
}

interface NavSection {
  id: string
  label: string
  icon: LucideIcon
  items: NavItem[]
}

interface SidebarProps {
  currentPage: string
  setCurrentPage: (pageId: string) => void
  currentUser: { role: string; name: string; avatar?: string; displayName?: string }
  onLogout: () => void
  isOpen?: boolean
  onClose?: () => void
}

interface RoleMeta {
  label: string
  title: string
  subtitle: string
  accent: string
  accentSoft: string
}

const sidebarCSS = `
.sidebar-scroll::-webkit-scrollbar{width:6px}
.sidebar-scroll::-webkit-scrollbar-thumb{background:rgba(148,163,184,.28);border-radius:999px}
`

const ROLE_META: Record<string, RoleMeta> = {
  manager: {
    label: 'ຜູ້ຈັດການ',
    title: 'Manager Rail',
    subtitle: 'ຕິດຕາມພາບລວມ, tickets, projects ແລະ system control ໃນຈຸດດຽວ',
    accent: '#38bdf8',
    accentSoft: 'rgba(56, 189, 248, 0.16)',
  },
  helpdesk: {
    label: 'ຊ່ວຍເຫຼືອ',
    title: 'Helpdesk Rail',
    subtitle: 'ເຂົ້າເຖິງ service desk, knowledge base ແລະ queue ປະຈຳວັນ',
    accent: '#22c55e',
    accentSoft: 'rgba(34, 197, 94, 0.16)',
  },
  it_support: {
    label: 'ຊ່າງ IT',
    title: 'Support Rail',
    subtitle: 'ຈັດການບັດແຈ້ງ, ຕິດຕາມວຽກ ແລະ ໃຊ້ຄັງຄວາມຮູ້ໃຫ້ໄວ',
    accent: '#14b8a6',
    accentSoft: 'rgba(20, 184, 166, 0.16)',
  },
  lead_programmer: {
    label: 'ຫົວໜ້ານັກພັດທະນາ',
    title: 'Dev Rail',
    subtitle: 'ກວດ project flow, ticket intake ແລະ dev workload ຂອງທີມ',
    accent: '#6366f1',
    accentSoft: 'rgba(99, 102, 241, 0.16)',
  },
  programmer: {
    label: 'ນັກພັດທະນາ',
    title: 'Developer Rail',
    subtitle: 'ເບິ່ງວຽກພັດທະນາ, ticket intake ແລະ queue ຂອງຕົນເອງ',
    accent: '#8b5cf6',
    accentSoft: 'rgba(139, 92, 246, 0.16)',
  },
}

const getRoleMeta = (role: string): RoleMeta => ROLE_META[role] || ROLE_META.programmer

const getNavSections = (role: string): NavSection[] => {
  const supportCore: NavItem[] = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'ໜ້າຫຼັກ', caption: 'overview ຂອງ service desk' },
    { id: 'tickets', icon: Ticket, label: 'ບັດແຈ້ງບັນຫາ', caption: 'queue ແລະ service workflow' },
    { id: 'knowledge', icon: BookOpen, label: 'ຄັງຄວາມຮູ້', caption: 'manual, fixes ແລະ SOP' },
  ]

  const devCore: NavItem[] = [
    { id: 'dev_dashboard', icon: LayoutDashboard, label: 'ໜ້າຫຼັກ', caption: 'overview ຂອງ dev team' },
    { id: 'tickets', icon: Ticket, label: 'ບັດແຈ້ງບັນຫາ', caption: 'incoming request intake' },
    { id: 'dev_projects', icon: FolderKanban, label: 'ໂຄງການພັດທະນາ', caption: 'projects, tasks ແລະ delivery' },
  ]

  if (role === 'manager') {
    return [
      {
        id: 'overview',
        label: 'Overview',
        icon: Sparkles,
        items: [
          { id: 'manager_dashboard', icon: LayoutDashboard, label: 'ໜ້າຫຼັກລວມ', caption: 'command center ຂອງລະບົບ' },
        ],
      },
      {
        id: 'support',
        label: 'Support',
        icon: Headphones,
        items: [
          { id: 'tickets', icon: Ticket, label: 'ບັດແຈ້ງບັນຫາ', caption: 'queue ແລະ assignment' },
          { id: 'knowledge', icon: BookOpen, label: 'ຄັງຄວາມຮູ້', caption: 'SOP ແລະ workaround' },
        ],
      },
      {
        id: 'development',
        label: 'Development',
        icon: Code2,
        items: [
          { id: 'dev_projects', icon: FolderKanban, label: 'ໂຄງການພັດທະນາ', caption: 'projects, tasks ແລະ review' },
        ],
      },
      {
        id: 'operations',
        label: 'Operations',
        icon: Monitor,
        items: [
          { id: 'assets', icon: Monitor, label: 'ຊັບສິນ IT', caption: 'inventory ແລະ assignment log' },
          { id: 'reports', icon: BarChart3, label: 'ລາຍງານ', caption: 'analytics ແລະ summary' },
          { id: 'settings', icon: Settings, label: 'ຕັ້ງຄ່າລະບົບ', caption: 'roles, config ແລະ controls' },
        ],
      },
    ]
  }

  if (['helpdesk', 'it_support'].includes(role)) {
    return [
      {
        id: 'support-core',
        label: 'Support Workspace',
        icon: Headphones,
        items: supportCore,
      },
    ]
  }

  return [
    {
      id: 'dev-core',
      label: 'Development Workspace',
      icon: Code2,
      items: devCore,
    },
  ]
}

const Sidebar = ({ currentPage, setCurrentPage, currentUser, onLogout, isOpen, onClose }: SidebarProps) => {
  const roleMeta = getRoleMeta(currentUser.role)
  const navSections = getNavSections(currentUser.role)
  const totalLinks = navSections.reduce((sum, section) => sum + section.items.length, 0)

  const handleNavigate = (pageId: string) => {
    setCurrentPage(pageId)
    if (onClose) onClose()
  }

  return (
    <>
      <style>{sidebarCSS}</style>
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[252px] overflow-hidden border-r border-slate-800/80 bg-[#08111f] text-slate-100 shadow-[8px_0_40px_rgba(2,6,23,0.45)] transition-transform duration-300 lg:translate-x-0 2xl:w-[272px] ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.18),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(251,191,36,0.12),transparent_24%)]" />
        <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px)] [background-size:20px_20px]" />

        {onClose && (
          <button
            type="button"
            className="absolute right-4 top-4 z-10 grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/[0.06] text-slate-300 transition hover:bg-white/[0.12] hover:text-white lg:hidden"
            onClick={onClose}
            aria-label="ປິດເມນູ"
          >
            <X size={18} strokeWidth={2} />
          </button>
        )}

        <div className="relative flex h-full flex-col">
          <div className="px-3.5 pb-3.5 pt-3.5 2xl:px-4 2xl:pb-4 2xl:pt-4">
            <div className="rounded-[24px] border border-white/10 bg-white/[0.05] p-3.5 backdrop-blur-sm 2xl:rounded-[28px] 2xl:p-4">
              <div className="flex items-center gap-2.5 2xl:gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-sky-400 via-cyan-400 to-amber-300 text-slate-950 shadow-[0_18px_36px_-18px_rgba(56,189,248,0.8)] 2xl:h-12 2xl:w-12">
                  <Building2 size={24} strokeWidth={2} />
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-black tracking-tight text-white 2xl:text-sm">ODG IT Workspace</div>
                  <div className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold text-slate-300">
                    <span className="h-2 w-2 rounded-full" style={{ background: roleMeta.accent }} />
                    {roleMeta.label}
                  </div>
                </div>
              </div>

              <div
                className="mt-3.5 rounded-[20px] border border-white/10 px-3.5 py-3 2xl:mt-4 2xl:rounded-[22px] 2xl:px-4 2xl:py-3.5"
                style={{ background: `linear-gradient(135deg, ${roleMeta.accentSoft}, rgba(15, 23, 42, 0.45))` }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-300/70">Workspace</div>
                    <div className="mt-1 text-base font-black text-white 2xl:text-lg">{roleMeta.title}</div>
                  </div>
                  <div
                    className="grid h-9 w-9 place-items-center rounded-2xl border border-white/10 bg-slate-950/40 2xl:h-10 2xl:w-10"
                    style={{ color: roleMeta.accent }}
                  >
                    <Sparkles size={16} />
                  </div>
                </div>
                <p className="mt-3 text-[11px] leading-5 text-slate-300">{roleMeta.subtitle}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="rounded-full bg-slate-950/45 px-2.5 py-1 text-[10px] font-semibold text-slate-200">
                    {navSections.length} sections
                  </span>
                  <span className="rounded-full bg-slate-950/45 px-2.5 py-1 text-[10px] font-semibold text-slate-200">
                    {totalLinks} modules
                  </span>
                </div>
              </div>
            </div>
          </div>

          <nav className="sidebar-scroll flex-1 overflow-y-auto px-2.5 pb-3.5 2xl:px-3 2xl:pb-4">
            {navSections.map((section) => (
              <section key={section.id} className="mb-4 2xl:mb-5">
                <div className="mb-2 flex items-center justify-between px-2">
                  <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    <section.icon size={13} />
                    <span>{section.label}</span>
                  </div>
                  <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[9px] font-semibold text-slate-400">
                    {section.items.length}
                  </span>
                </div>

                <div className="space-y-1.5">
                  {section.items.map((item) => {
                    const isActive = currentPage === item.id
                    return (
                      <button
                        key={item.id}
                        type="button"
                        aria-current={isActive ? 'page' : undefined}
                        onClick={() => handleNavigate(item.id)}
                        className={`group relative flex w-full items-center gap-2.5 rounded-[20px] border px-2.5 py-2.5 text-left transition-all duration-200 2xl:gap-3 2xl:rounded-[22px] 2xl:px-3 2xl:py-3 ${
                          isActive
                            ? 'border-white/10 text-white shadow-[0_18px_36px_-28px_rgba(56,189,248,0.65)]'
                            : 'border-transparent text-slate-300 hover:border-white/8 hover:bg-white/[0.05] hover:text-white'
                        }`}
                        style={
                          isActive
                            ? {
                                background: `linear-gradient(135deg, ${roleMeta.accentSoft}, rgba(255,255,255,0.06))`,
                                borderColor: `${roleMeta.accent}55`,
                              }
                            : undefined
                        }
                      >
                        {isActive && (
                          <span
                            className="absolute left-0 top-2.5 h-9 w-1 rounded-r-full 2xl:top-3 2xl:h-10"
                            style={{ background: roleMeta.accent }}
                          />
                        )}

                        <div
                          className={`grid h-9 w-9 shrink-0 place-items-center rounded-2xl border 2xl:h-10 2xl:w-10 ${
                            isActive ? 'border-white/10 bg-slate-950/35 text-white' : 'border-white/8 bg-white/[0.03] text-slate-300'
                          }`}
                          style={isActive ? { color: roleMeta.accent } : undefined}
                        >
                          <item.icon size={17} strokeWidth={1.9} />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[12px] font-semibold 2xl:text-[13px]">{item.label}</div>
                          <div className={`mt-0.5 truncate text-[10px] ${isActive ? 'text-slate-200/75' : 'text-slate-400'}`}>
                            {item.caption}
                          </div>
                        </div>

                        <div
                          className={`grid h-7 w-7 place-items-center rounded-xl transition 2xl:h-8 2xl:w-8 ${
                            isActive ? 'bg-slate-950/35 text-white' : 'text-slate-500 group-hover:bg-white/[0.05] group-hover:text-slate-200'
                          }`}
                          style={isActive ? { color: roleMeta.accent } : undefined}
                        >
                          <ArrowRight size={14} />
                        </div>
                      </button>
                    )
                  })}
                </div>
              </section>
            ))}
          </nav>

          <div className="border-t border-white/8 px-3.5 pb-3.5 pt-3 2xl:px-4 2xl:pb-4">
            <div className="rounded-[24px] border border-white/10 bg-white/[0.05] p-3.5 backdrop-blur-sm 2xl:rounded-[26px] 2xl:p-4">
              <div className="flex items-center gap-3">
                <div className="relative shrink-0">
                  {currentUser.avatar ? (
                    <img
                      src={currentUser.avatar}
                      alt={currentUser.name}
                      className="h-11 w-11 rounded-2xl object-cover ring-1 ring-white/10 2xl:h-12 2xl:w-12"
                    />
                  ) : (
                    <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-slate-200 to-white text-base font-black text-slate-900 2xl:h-12 2xl:w-12 2xl:text-lg">
                      {currentUser.name?.charAt(0) || '?'}
                    </div>
                  )}
                  <span
                    className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-[#08111f]"
                    style={{ background: roleMeta.accent }}
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-bold text-white 2xl:text-sm">{currentUser.name}</div>
                  {currentUser.displayName && (
                    <div className="mt-0.5 truncate text-[10px] text-slate-400">{currentUser.displayName}</div>
                  )}
                  <div className="mt-1 inline-flex items-center rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] font-semibold text-slate-300">
                    {roleMeta.label}
                  </div>
                </div>
              </div>

              <button
                type="button"
                className="mt-3.5 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-slate-950/35 px-3 py-2.5 text-[11px] font-semibold text-slate-300 transition hover:border-rose-300/30 hover:bg-rose-500/10 hover:text-rose-200 2xl:mt-4"
                onClick={onLogout}
              >
                <LogOut size={15} strokeWidth={2} />
                <span>ອອກຈາກລະບົບ</span>
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}

export default Sidebar
