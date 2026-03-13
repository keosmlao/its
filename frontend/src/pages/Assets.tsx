import { useEffect, useState, useMemo, useCallback } from 'react'
import { Monitor } from 'lucide-react'
import api from '../lib/api'

/* ── Minimal CSS for pseudo-elements & scrollbar ── */
const assetStyles = `
.ast-timeline{display:flex;flex-direction:column;position:relative;padding-left:18px}
.ast-timeline::before{content:'';position:absolute;left:5px;top:10px;bottom:10px;width:2px;background:linear-gradient(to bottom,#e2e8f0,#f1f5f9);border-radius:1px}
.ast-tbl-section::-webkit-scrollbar{height:6px}
.ast-tbl-section::-webkit-scrollbar-thumb{background:#d1ccc4;border-radius:10px}
@keyframes astFadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@keyframes astModalPop{from{opacity:0;transform:scale(0.95) translateY(6px)}to{opacity:1;transform:scale(1) translateY(0)}}
@keyframes astOverlayFade{from{opacity:0}to{opacity:1}}
@media(max-width:640px){
  .ast-tbl-section{overflow-x:hidden}
  .ast-table{min-width:0;width:100%;white-space:normal}
  .ast-table thead{display:none}
  .ast-table tbody{display:flex;flex-direction:column;gap:10px;padding:10px}
  .ast-table tbody tr{display:grid;grid-template-columns:1fr 1fr;gap:0;background:#fff;border:1.5px solid #e2e8f0;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.04)}
  .ast-table tbody tr:hover{background:#fff}
  .ast-table tbody td{display:flex;flex-direction:column;gap:2px;padding:8px 12px;border-bottom:1px solid rgba(0,0,0,0.04);font-size:12px;white-space:normal;max-width:none;overflow:hidden;word-break:break-word}
  .ast-table tbody td::before{content:attr(data-label);font-size:9px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.3px}
  .ast-table tbody td.ast-col-id:first-child{display:none}
  .ast-table tbody td.ast-col-code{grid-column:1/-1;font-weight:700;font-size:13px;color:#2563eb;background:rgba(37,99,235,0.04);border-bottom:1.5px solid #e2e8f0;padding:10px 12px}
  .ast-table tbody td.ast-col-code::before{display:none}
  .ast-table tbody td.ast-col-name{grid-column:1/-1;font-weight:600;font-size:13px;background:rgba(0,0,0,0.015);border-bottom:1.5px solid #e2e8f0;padding:10px 12px}
  .ast-table tbody td.ast-col-name::before{display:none}
  .ast-table tbody td:last-child{grid-column:1/-1;border-bottom:none;padding:8px 12px;background:rgba(0,0,0,0.02);flex-direction:row}
  .ast-table tbody td:last-child::before{display:none}
  .ast-table tbody td[colspan]{grid-column:1/-1;justify-content:center;align-items:center;border:none;padding:40px 12px}
  .ast-table tbody td[colspan]::before{display:none}
}
`

/* ── Types ──────────────────────────────────────── */
interface Asset {
  id: number
  asset_code: string | null
  name: string
  type: string
  serial_number: string | null
  brand: string | null
  model: string | null
  status: string
  current_holder_id: number | null
  current_holder_name: string | null
  division: string | null
  department: string | null
  purchase_date: string | null
  warranty_expiry: string | null
  notes: string | null
  created_at: string | null
}

interface HolderLog {
  id: number
  action: string
  from_holder_id: number | null
  from_holder_name: string | null
  to_holder_id: number | null
  to_holder_name: string | null
  note: string | null
  changed_by_id: number | null
  changed_by_name: string | null
  created_at: string
}

interface Employee {
  code: string
  name: string
}

interface OrgItem {
  code: string
  name: string
}

type ModalType = 'create' | 'edit' | 'delete' | 'transfer' | null

/* ── Constants ──────────────────────────────────── */
const STATUS_LABELS: Record<string, string> = {
  in_stock: 'ໃນສາງ',
  deployed: 'ນຳໃຊ້',
  maintenance: 'ສ້ອມແປງ',
  retired: 'ປົດລະວາງ',
}

const STATUS_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  in_stock: { bg: 'bg-emerald-50', text: 'text-emerald-600', dot: 'bg-emerald-500' },
  deployed: { bg: 'bg-blue-50', text: 'text-blue-600', dot: 'bg-blue-500' },
  maintenance: { bg: 'bg-amber-50', text: 'text-amber-600', dot: 'bg-amber-500' },
  retired: { bg: 'bg-slate-100', text: 'text-slate-500', dot: 'bg-slate-400' },
}

const TYPE_LABELS: Record<string, { label: string; icon: string }> = {
  computer: { label: 'ຄອມພິວເຕີ', icon: '💻' },
  printer: { label: 'ເຄື່ອງພິມ', icon: '🖨️' },
  network: { label: 'ເຄືອຂ່າຍ', icon: '🌐' },
  software: { label: 'ຊອບແວ', icon: '📀' },
  peripheral: { label: 'ອຸປະກອນເສີມ', icon: '🖱️' },
  other: { label: 'ອື່ນໆ', icon: '📦' },
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  create: { label: 'ລົງທະບຽນ', color: 'text-violet-500' },
  assign: { label: 'ມອບໃຫ້', color: 'text-blue-600' },
  return: { label: 'ຄືນ', color: 'text-emerald-600' },
  transfer: { label: 'ໂອນ', color: 'text-amber-600' },
}

const ACTION_DOT_COLORS: Record<string, string> = {
  create: 'bg-violet-500',
  assign: 'bg-blue-500',
  return: 'bg-emerald-500',
  transfer: 'bg-amber-500',
}

const SIDEBAR_ITEMS = [
  { key: 'all', label: 'ທັງໝົດ', dot: 'bg-indigo-500' },
  { key: 'in_stock', label: 'ໃນສາງ', dot: 'bg-emerald-500' },
  { key: 'deployed', label: 'ນຳໃຊ້', dot: 'bg-blue-500' },
  { key: 'maintenance', label: 'ສ້ອມແປງ', dot: 'bg-amber-500' },
  { key: 'retired', label: 'ປົດລະວາງ', dot: 'bg-slate-400' },
]

/* ── Helpers ────────────────────────────────────── */
function formatDate(d: string | null): string {
  if (!d) return '-'
  try {
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch {
    return d
  }
}

function formatDateTime(d: string): string {
  try {
    const dt = new Date(d)
    return `${dt.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })} ${dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`
  } catch {
    return d
  }
}

/* ── Component ──────────────────────────────────── */
export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState('all')
  const [modal, setModal] = useState<ModalType>(null)
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null)
  const [detailAsset, setDetailAsset] = useState<Asset | null>(null)
  const [historyLogs, setHistoryLogs] = useState<HolderLog[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [divisions, setDivisions] = useState<OrgItem[]>([])
  const [departments, setDepartments] = useState<OrgItem[]>([])
  const [saving, setSaving] = useState(false)

  // Form state
  const [formName, setFormName] = useState('')
  const [formType, setFormType] = useState('computer')
  const [formSerial, setFormSerial] = useState('')
  const [formBrand, setFormBrand] = useState('')
  const [formModel, setFormModel] = useState('')
  const [formDivision, setFormDivision] = useState('')
  const [formDepartment, setFormDepartment] = useState('')
  const [formPurchaseDate, setFormPurchaseDate] = useState('')
  const [formWarranty, setFormWarranty] = useState('')
  const [formNotes, setFormNotes] = useState('')

  // Transfer form
  const [transferAction, setTransferAction] = useState('assign')
  const [transferHolder, setTransferHolder] = useState('')
  const [transferNote, setTransferNote] = useState('')

  /* ── Load data ──────────────────────────────── */
  const loadAssets = useCallback(async () => {
    try {
      const res = await api.listAssets()
      setAssets(Array.isArray(res.data) ? res.data : [])
    } catch {
      setAssets([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadAssets() }, [loadAssets])

  useEffect(() => {
    api.listRequesters()
      .then((res) => {
        const d = res.data
        setEmployees(Array.isArray(d) ? d : [])
      })
      .catch(() => setEmployees([]))
    api.listDivisions()
      .then((res) => {
        const d = res.data
        setDivisions(Array.isArray(d) ? d : [])
      })
      .catch(() => setDivisions([]))
  }, [])

  // Load departments when division changes in form
  useEffect(() => {
    if (!formDivision) {
      setDepartments([])
      return
    }
    // Find division code from name
    const div = divisions.find((d) => d.name === formDivision)
    if (!div) { setDepartments([]); return }
    api.listDepartmentsByDivision(div.code)
      .then((res) => {
        const d = res.data
        setDepartments(Array.isArray(d) ? d : [])
      })
      .catch(() => setDepartments([]))
  }, [formDivision, divisions])

  /* ── Detail / History ──────────────────────── */
  const openDetail = useCallback(async (asset: Asset) => {
    setDetailAsset(asset)
    setHistoryLoading(true)
    try {
      const res = await api.getAssetHistory(asset.id)
      const d = res.data as { logs?: HolderLog[] } | null
      setHistoryLogs(d?.logs || [])
    } catch {
      setHistoryLogs([])
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  /* ── Filter & Search ───────────────────────── */
  const filtered = useMemo(() => {
    let list = assets
    if (activeTab !== 'all') {
      list = list.filter((a) => a.status === activeTab)
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((a) =>
        (a.name || '').toLowerCase().includes(q) ||
        (a.asset_code || '').toLowerCase().includes(q) ||
        (a.serial_number || '').toLowerCase().includes(q) ||
        (a.brand || '').toLowerCase().includes(q) ||
        (a.current_holder_name || '').toLowerCase().includes(q)
      )
    }
    return list
  }, [assets, activeTab, search])

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: assets.length }
    for (const a of assets) {
      c[a.status] = (c[a.status] || 0) + 1
    }
    return c
  }, [assets])

  /* ── Create / Edit ─────────────────────────── */
  const openCreateModal = () => {
    setSelectedAsset(null)
    setFormName('')
    setFormType('computer')
    setFormSerial('')
    setFormBrand('')
    setFormModel('')
    setFormDivision('')
    setFormDepartment('')
    setFormPurchaseDate('')
    setFormWarranty('')
    setFormNotes('')
    setModal('create')
  }

  const openEditModal = (a: Asset) => {
    setSelectedAsset(a)
    setFormName(a.name || '')
    setFormType(a.type || 'computer')
    setFormSerial(a.serial_number || '')
    setFormBrand(a.brand || '')
    setFormModel(a.model || '')
    setFormDivision(a.division || '')
    setFormDepartment(a.department || '')
    setFormPurchaseDate(a.purchase_date ? a.purchase_date.substring(0, 10) : '')
    setFormWarranty(a.warranty_expiry ? a.warranty_expiry.substring(0, 10) : '')
    setFormNotes(a.notes || '')
    setModal('edit')
  }

  const handleSave = async () => {
    if (!formName.trim()) return
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        name: formName.trim(),
        type: formType,
        serial_number: formSerial.trim() || null,
        brand: formBrand.trim() || null,
        model: formModel.trim() || null,
        division: formDivision || null,
        department: formDepartment || null,
        purchase_date: formPurchaseDate || null,
        warranty_expiry: formWarranty || null,
        notes: formNotes.trim() || null,
      }
      if (modal === 'edit' && selectedAsset) {
        await api.updateAsset(selectedAsset.id, payload)
      } else {
        await api.createAsset(payload)
      }
      setModal(null)
      await loadAssets()
    } catch {
      alert('ບັນທຶກບໍ່ສຳເລັດ')
    } finally {
      setSaving(false)
    }
  }

  /* ── Delete ────────────────────────────────── */
  const handleDelete = async () => {
    if (!selectedAsset) return
    setSaving(true)
    try {
      await api.deleteAsset(selectedAsset.id)
      setModal(null)
      setSelectedAsset(null)
      if (detailAsset?.id === selectedAsset.id) setDetailAsset(null)
      await loadAssets()
    } catch {
      alert('ລົບບໍ່ສຳເລັດ')
    } finally {
      setSaving(false)
    }
  }

  /* ── Transfer ──────────────────────────────── */
  const openTransferModal = (a: Asset) => {
    setSelectedAsset(a)
    setTransferAction(a.current_holder_name ? 'transfer' : 'assign')
    setTransferHolder('')
    setTransferNote('')
    setModal('transfer')
  }

  const handleTransfer = async () => {
    if (!selectedAsset) return
    if (transferAction !== 'return' && !transferHolder) return
    setSaving(true)
    try {
      const emp = employees.find((e) => e.name === transferHolder)
      await api.transferAsset(selectedAsset.id, {
        action: transferAction,
        to_holder_id: emp ? parseInt(emp.code, 10) || null : null,
        to_holder_name: transferAction === 'return' ? null : transferHolder,
        note: transferNote.trim() || null,
      })
      setModal(null)
      await loadAssets()
      // Refresh detail if open
      if (detailAsset?.id === selectedAsset.id) {
        const res = await api.getAssetHistory(selectedAsset.id)
        const d = res.data as { asset?: Asset; logs?: HolderLog[] } | null
        if (d?.asset) setDetailAsset(d.asset)
        setHistoryLogs(d?.logs || [])
      }
    } catch {
      alert('ດຳເນີນການບໍ່ສຳເລັດ')
    } finally {
      setSaving(false)
    }
  }

  /* ── Render ────────────────────────────────── */
  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-[1400px] mx-auto">
      <style>{assetStyles}</style>

      {/* Header */}
      <div className="mb-6" style={{ animation: 'astFadeUp 0.5s ease-out' }}>
        <div className="flex items-center gap-2.5 mb-2">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 grid place-items-center text-white shadow-lg shadow-sky-500/20">
            <Monitor size={18} />
          </div>
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">ຈັດການຊັບສິນ</span>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">ຊັບສິນ IT</h1>
            <p className="mt-1 text-sm text-slate-500">ບັນທຶກ ແລະ ຕິດຕາມຊັບສິນ IT ທັງໝົດ</p>
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
              <input
                type="text"
                placeholder="ຄົ້ນຫາ ຊື່, ລະຫັດ, Serial..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-4 text-sm text-slate-700 placeholder:text-slate-400 focus:border-sky-300 focus:ring-2 focus:ring-sky-300/15 focus:outline-none transition-all w-full sm:w-[240px]"
              />
            </div>
            <button
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-sky-500/20 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-sky-500/25 sm:w-auto w-full justify-center"
              onClick={openCreateModal}
              type="button"
            >
              <span className="text-lg leading-none">+</span> ເພີ່ມຊັບສິນ
            </button>
          </div>
        </div>
      </div>

      {/* Layout */}
      <div className="rounded-2xl border border-slate-200/80 bg-white shadow-sm overflow-hidden" style={{ animation: 'astFadeUp 0.5s ease-out 0.1s both' }}>
        {/* Status Bar */}
        <div className="w-full border-b border-slate-200/80 bg-slate-50/80 px-3 py-2.5 flex items-center gap-1.5 overflow-x-auto">
          {SIDEBAR_ITEMS.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`flex items-center gap-2 flex-shrink-0 whitespace-nowrap px-3.5 py-2 rounded-full text-xs font-semibold transition-all ${
                activeTab === item.key
                  ? 'bg-sky-50 text-sky-600 font-bold'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
              onClick={() => setActiveTab(item.key)}
            >
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${item.dot}`} />
              <span>{item.label}</span>
              <span className={`font-mono text-[10px] font-bold min-w-[22px] h-[22px] inline-flex items-center justify-center rounded-lg ${
                activeTab === item.key
                  ? 'text-sky-600 bg-sky-100/80'
                  : 'text-slate-400 bg-slate-200/50'
              }`}>
                {counts[item.key] || 0}
              </span>
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="ast-tbl-section flex-1 overflow-x-auto min-w-0">
          {loading ? (
            <div className="text-center py-12 text-slate-400 text-sm font-medium">ກຳລັງໂຫລດ...</div>
          ) : (
            <table className="ast-table w-full border-collapse table-fixed">
              <thead>
                <tr>
                  <th className="px-3.5 py-3 text-[10px] font-bold uppercase tracking-wide text-slate-400 text-left bg-slate-50/60 border-b border-slate-200/80 sticky top-0 z-[1] w-[50px]">#</th>
                  <th className="px-3.5 py-3 text-[10px] font-bold uppercase tracking-wide text-slate-400 text-left bg-slate-50/60 border-b border-slate-200/80 sticky top-0 z-[1]">ລະຫັດ</th>
                  <th className="px-3.5 py-3 text-[10px] font-bold uppercase tracking-wide text-slate-400 text-left bg-slate-50/60 border-b border-slate-200/80 sticky top-0 z-[1]">ຊື່ອຸປະກອນ</th>
                  <th className="px-3.5 py-3 text-[10px] font-bold uppercase tracking-wide text-slate-400 text-left bg-slate-50/60 border-b border-slate-200/80 sticky top-0 z-[1]">ປະເພດ</th>
                  <th className="px-3.5 py-3 text-[10px] font-bold uppercase tracking-wide text-slate-400 text-left bg-slate-50/60 border-b border-slate-200/80 sticky top-0 z-[1]">ຍີ່ຫໍ້ / ລຸ່ນ</th>
                  <th className="px-3.5 py-3 text-[10px] font-bold uppercase tracking-wide text-slate-400 text-left bg-slate-50/60 border-b border-slate-200/80 sticky top-0 z-[1]">ເລກ Serial</th>
                  <th className="px-3.5 py-3 text-[10px] font-bold uppercase tracking-wide text-slate-400 text-left bg-slate-50/60 border-b border-slate-200/80 sticky top-0 z-[1]">ສະຖານະ</th>
                  <th className="px-3.5 py-3 text-[10px] font-bold uppercase tracking-wide text-slate-400 text-left bg-slate-50/60 border-b border-slate-200/80 sticky top-0 z-[1]">ຜູ້ຖືຄອງ</th>
                  <th className="px-3.5 py-3 text-[10px] font-bold uppercase tracking-wide text-slate-400 text-left bg-slate-50/60 border-b border-slate-200/80 sticky top-0 z-[1]">ພະແນກ</th>
                  <th className="px-3.5 py-3 text-[10px] font-bold uppercase tracking-wide text-slate-400 text-right bg-slate-50/60 border-b border-slate-200/80 sticky top-0 z-[1]">ຈັດການ</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-12 text-slate-400 text-sm font-medium">
                      {search ? 'ບໍ່ພົບຜົນ' : 'ຍັງບໍ່ມີຊັບສິນ'}
                    </td>
                  </tr>
                ) : filtered.map((a, idx) => {
                  const sc = STATUS_COLORS[a.status] || STATUS_COLORS.in_stock
                  const tp = TYPE_LABELS[a.type] || TYPE_LABELS.other
                  return (
                    <tr key={a.id} onClick={() => openDetail(a)} className="transition-colors cursor-pointer hover:bg-sky-50/40 last:[&>td]:border-b-0">
                      <td className="ast-col-id px-3.5 py-2.5 text-[11px] font-mono font-bold text-blue-600 border-b border-slate-100 overflow-hidden text-ellipsis whitespace-nowrap" data-label="#">{idx + 1}</td>
                      <td className="ast-col-id ast-col-code px-3.5 py-2.5 text-[11px] font-mono font-bold text-blue-600 border-b border-slate-100 overflow-hidden text-ellipsis whitespace-nowrap" data-label="ລະຫັດ">{a.asset_code || '-'}</td>
                      <td className="ast-col-name px-3.5 py-2.5 text-xs font-semibold text-slate-800 border-b border-slate-100 overflow-hidden text-ellipsis whitespace-nowrap max-w-[220px]" data-label="ຊື່">{a.name}</td>
                      <td className="px-3.5 py-2.5 text-xs text-slate-600 border-b border-slate-100 overflow-hidden text-ellipsis whitespace-nowrap" data-label="ປະເພດ">
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold">
                          <span>{tp.icon}</span> {tp.label}
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5 text-xs text-slate-600 border-b border-slate-100 overflow-hidden text-ellipsis whitespace-nowrap" data-label="ຍີ່ຫໍ້/ລຸ່ນ">{[a.brand, a.model].filter(Boolean).join(' ') || '-'}</td>
                      <td className="px-3.5 py-2.5 text-[11px] font-mono text-slate-600 border-b border-slate-100 overflow-hidden text-ellipsis whitespace-nowrap" data-label="ເລກ Serial">
                        {a.serial_number || '-'}
                      </td>
                      <td className="px-3.5 py-2.5 text-xs text-slate-600 border-b border-slate-100 overflow-hidden text-ellipsis whitespace-nowrap" data-label="ສະຖານະ">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10.5px] font-semibold ${sc.bg} ${sc.text}`}>
                          <span className={`w-[7px] h-[7px] rounded-full ${sc.dot}`} />
                          {STATUS_LABELS[a.status] || a.status}
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5 text-xs text-slate-600 border-b border-slate-100 overflow-hidden text-ellipsis whitespace-nowrap" data-label="ຜູ້ຖືຄອງ">{a.current_holder_name || <span className="text-slate-400">-</span>}</td>
                      <td className="px-3.5 py-2.5 text-xs text-slate-600 border-b border-slate-100 overflow-hidden text-ellipsis whitespace-nowrap" data-label="ພະແນກ">{a.department || <span className="text-slate-400">-</span>}</td>
                      <td className="px-3.5 py-2.5 text-xs border-b border-slate-100" data-label="" onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-1 justify-end items-center">
                          <button
                            className="inline-flex items-center justify-center w-[30px] h-[30px] rounded-lg border border-slate-200 bg-white text-slate-400 text-sm cursor-pointer transition-all hover:border-green-300 hover:text-green-600 hover:bg-green-50 hover:-translate-y-px hover:shadow-sm"
                            title={a.current_holder_name ? 'ໂອນ/ຄືນ' : 'ມອບໃຫ້'}
                            onClick={() => openTransferModal(a)}
                            type="button"
                          >
                            {a.current_holder_name ? '🔄' : '👤'}
                          </button>
                          <button
                            className="inline-flex items-center justify-center w-[30px] h-[30px] rounded-lg border border-slate-200 bg-white text-slate-400 text-sm cursor-pointer transition-all hover:border-amber-300 hover:text-amber-600 hover:bg-amber-50 hover:-translate-y-px hover:shadow-sm"
                            title="ແກ້ໄຂ"
                            onClick={() => openEditModal(a)}
                            type="button"
                          >
                            ✏️
                          </button>
                          <button
                            className="inline-flex items-center justify-center w-[30px] h-[30px] rounded-lg border border-slate-200 bg-white text-slate-400 text-sm cursor-pointer transition-all hover:border-red-300 hover:text-red-500 hover:bg-red-50 hover:-translate-y-px hover:shadow-sm"
                            title="ລົບ"
                            onClick={() => { setSelectedAsset(a); setModal('delete') }}
                            type="button"
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Detail Modal ───────────────────────── */}
      {detailAsset && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[9999] p-5"
          style={{ animation: 'astOverlayFade 0.2s ease-out' }}
          onClick={(e) => { if (e.target === e.currentTarget) setDetailAsset(null) }}
        >
          <div
            className="bg-white w-full max-w-[560px] max-h-[88vh] overflow-auto rounded-2xl border border-slate-200/80 shadow-xl"
            style={{ animation: 'astModalPop 0.3s cubic-bezier(0.34,1.56,0.64,1)' }}
          >
            <div className="px-7 pt-6 pb-5 bg-gradient-to-br from-sky-50/60 to-transparent border-b border-slate-100">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full font-mono">
                  {detailAsset.asset_code || `#${detailAsset.id}`}
                </span>
                <button
                  className="w-7 h-7 rounded-lg bg-black/[0.04] hover:bg-black/[0.08] text-slate-400 hover:text-slate-800 grid place-items-center text-lg transition-all border-none cursor-pointer"
                  onClick={() => setDetailAsset(null)}
                  type="button"
                >
                  ×
                </button>
              </div>
              <h2 className="text-base font-bold text-slate-900 mb-3 leading-snug">{detailAsset.name}</h2>
              <div className="flex items-center gap-2 flex-wrap">
                {(() => {
                  const sc = STATUS_COLORS[detailAsset.status] || STATUS_COLORS.in_stock
                  return (
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10.5px] font-semibold ${sc.bg} ${sc.text}`}>
                      <span className={`w-[7px] h-[7px] rounded-full ${sc.dot}`} />
                      {STATUS_LABELS[detailAsset.status] || detailAsset.status}
                    </span>
                  )
                })()}
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
                  {(TYPE_LABELS[detailAsset.type] || TYPE_LABELS.other).icon}{' '}
                  {(TYPE_LABELS[detailAsset.type] || TYPE_LABELS.other).label}
                </span>
              </div>
            </div>

            <div className="px-7 pt-5 pb-6">
              <div className="grid grid-cols-2 gap-2.5 mb-5 max-sm:grid-cols-1 max-sm:gap-2">
                <div className="bg-slate-50 border border-slate-100 rounded-xl px-3.5 py-2.5 flex flex-col gap-0.5">
                  <span className="text-[9.5px] font-semibold text-slate-400 uppercase tracking-wider">ຍີ່ຫໍ້ / ລຸ່ນ</span>
                  <span className="text-[12.5px] font-semibold text-slate-700">
                    {[detailAsset.brand, detailAsset.model].filter(Boolean).join(' ') || '-'}
                  </span>
                </div>
                <div className="bg-slate-50 border border-slate-100 rounded-xl px-3.5 py-2.5 flex flex-col gap-0.5">
                  <span className="text-[9.5px] font-semibold text-slate-400 uppercase tracking-wider">ເລກ Serial</span>
                  <span className="text-[11px] font-semibold text-slate-700 font-mono">
                    {detailAsset.serial_number || '-'}
                  </span>
                </div>
                <div className="bg-slate-50 border border-slate-100 rounded-xl px-3.5 py-2.5 flex flex-col gap-0.5">
                  <span className="text-[9.5px] font-semibold text-slate-400 uppercase tracking-wider">ຜູ້ຖືຄອງ</span>
                  <span className="text-[12.5px] font-semibold text-slate-700">{detailAsset.current_holder_name || '-'}</span>
                </div>
                <div className="bg-slate-50 border border-slate-100 rounded-xl px-3.5 py-2.5 flex flex-col gap-0.5">
                  <span className="text-[9.5px] font-semibold text-slate-400 uppercase tracking-wider">ຝ່າຍ</span>
                  <span className="text-[12.5px] font-semibold text-slate-700">{detailAsset.division || '-'}</span>
                </div>
                <div className="bg-slate-50 border border-slate-100 rounded-xl px-3.5 py-2.5 flex flex-col gap-0.5">
                  <span className="text-[9.5px] font-semibold text-slate-400 uppercase tracking-wider">ພະແນກ</span>
                  <span className="text-[12.5px] font-semibold text-slate-700">{detailAsset.department || '-'}</span>
                </div>
                <div className="bg-slate-50 border border-slate-100 rounded-xl px-3.5 py-2.5 flex flex-col gap-0.5">
                  <span className="text-[9.5px] font-semibold text-slate-400 uppercase tracking-wider">ວັນທີຊື້</span>
                  <span className="text-[12.5px] font-semibold text-slate-700">{formatDate(detailAsset.purchase_date)}</span>
                </div>
                <div className="bg-slate-50 border border-slate-100 rounded-xl px-3.5 py-2.5 flex flex-col gap-0.5">
                  <span className="text-[9.5px] font-semibold text-slate-400 uppercase tracking-wider">ປະກັນ</span>
                  <span className="text-[12.5px] font-semibold text-slate-700">{formatDate(detailAsset.warranty_expiry)}</span>
                </div>
              </div>

              {detailAsset.notes && (
                <div className="mb-5">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2.5">ໝາຍເຫດ</span>
                  <div className="text-[13px] leading-relaxed text-slate-600 whitespace-pre-wrap bg-slate-50 border border-slate-100 rounded-xl px-3.5 py-3">
                    {detailAsset.notes}
                  </div>
                </div>
              )}

              {/* History Timeline */}
              <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2.5">ປະຫວັດຜູ້ຖືຄອງ</span>
              {historyLoading ? (
                <p className="text-xs text-slate-400">ກຳລັງໂຫລດ...</p>
              ) : historyLogs.length === 0 ? (
                <p className="text-xs text-slate-400">ຍັງບໍ່ມີປະຫວັດ</p>
              ) : (
                <div className="ast-timeline">
                  {historyLogs.map((log, idx) => {
                    const ac = ACTION_LABELS[log.action] || { label: log.action, color: 'text-indigo-500' }
                    const dotColor = ACTION_DOT_COLORS[log.action] || 'bg-indigo-500'
                    const isLast = idx === historyLogs.length - 1
                    return (
                      <div key={log.id} className={`flex items-start gap-3.5 relative ${isLast ? '' : 'pb-3'}`}>
                        <div className={`w-3 h-3 rounded-full -ml-[18px] mt-2.5 flex-shrink-0 z-[1] ${dotColor}`} />
                        <div className="flex-1 bg-slate-50 border border-slate-100 rounded-xl px-3.5 py-2.5 flex flex-col gap-0.5">
                          <div className="flex justify-between items-center">
                            <span className={`text-xs font-bold ${ac.color}`}>{ac.label}</span>
                          </div>
                          {log.action === 'assign' && log.to_holder_name && (
                            <span className="text-[11px] text-slate-500">ມອບໃຫ້: <b>{log.to_holder_name}</b></span>
                          )}
                          {log.action === 'return' && log.from_holder_name && (
                            <span className="text-[11px] text-slate-500">ຄືນຈາກ: <b>{log.from_holder_name}</b></span>
                          )}
                          {log.action === 'transfer' && (
                            <span className="text-[11px] text-slate-500">
                              {log.from_holder_name && <>ຈາກ: <b>{log.from_holder_name}</b> → </>}
                              {log.to_holder_name && <><b>{log.to_holder_name}</b></>}
                            </span>
                          )}
                          {log.note && log.action !== 'create' && (
                            <span className="text-[11px] text-slate-500">{log.note}</span>
                          )}
                          <span className="text-[10.5px] text-slate-300">
                            {formatDateTime(log.created_at)}
                            {log.changed_by_name && ` · ${log.changed_by_name}`}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Create / Edit Modal ────────────────── */}
      {(modal === 'create' || modal === 'edit') && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[9999] p-5"
          style={{ animation: 'astOverlayFade 0.2s ease-out' }}
          onClick={(e) => { if (e.target === e.currentTarget) setModal(null) }}
        >
          <div
            className="bg-white w-full max-w-[480px] rounded-2xl border border-slate-200/80 shadow-xl overflow-hidden"
            style={{ animation: 'astModalPop 0.3s cubic-bezier(0.34,1.56,0.64,1)' }}
          >
            <div className="px-7 pt-7 pb-5 text-center bg-gradient-to-b from-sky-50/40 to-transparent border-b border-slate-100">
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl grid place-items-center bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-500/20 text-2xl">
                {modal === 'create' ? '➕' : '✏️'}
              </div>
              <h3 className="text-lg font-bold text-slate-900">{modal === 'create' ? 'ເພີ່ມຊັບສິນໃໝ່' : 'ແກ້ໄຂຊັບສິນ'}</h3>
              <p className="text-slate-500 text-sm mt-1">{modal === 'create' ? 'ລົງທະບຽນອຸປະກອນ IT ໃໝ່' : 'ແກ້ໄຂຂໍ້ມູນອຸປະກອນ'}</p>
            </div>
            <div className="px-7 py-6">
              <div className="mb-3.5">
                <label className="block text-[11px] font-bold text-slate-600 mb-1.5 tracking-wide">ຊື່ອຸປະກອນ *</label>
                <input className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-sky-300 focus:ring-2 focus:ring-sky-300/15 focus:outline-none transition-all" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="ເຊັ່ນ: Laptop Dell Latitude 5540" />
              </div>
              <div className="mb-3.5">
                <label className="block text-[11px] font-bold text-slate-600 mb-1.5 tracking-wide">ປະເພດ *</label>
                <select className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 focus:border-sky-300 focus:ring-2 focus:ring-sky-300/15 focus:outline-none transition-all" value={formType} onChange={(e) => setFormType(e.target.value)}>
                  {Object.entries(TYPE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v.icon} {v.label}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1 max-sm:gap-0">
                <div className="mb-3.5">
                  <label className="block text-[11px] font-bold text-slate-600 mb-1.5 tracking-wide">ຝ່າຍ</label>
                  <select className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 focus:border-sky-300 focus:ring-2 focus:ring-sky-300/15 focus:outline-none transition-all" value={formDivision} onChange={(e) => { setFormDivision(e.target.value); setFormDepartment('') }}>
                    <option value="">-- ເລືອກຝ່າຍ --</option>
                    {divisions.map((d) => (
                      <option key={d.code} value={d.name}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div className="mb-3.5">
                  <label className="block text-[11px] font-bold text-slate-600 mb-1.5 tracking-wide">ພະແນກ</label>
                  <select className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 focus:border-sky-300 focus:ring-2 focus:ring-sky-300/15 focus:outline-none transition-all disabled:bg-slate-50 disabled:text-slate-400" value={formDepartment} onChange={(e) => setFormDepartment(e.target.value)} disabled={!formDivision}>
                    <option value="">-- ເລືອກພະແນກ --</option>
                    {departments.map((d) => (
                      <option key={d.code} value={d.name}>{d.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1 max-sm:gap-0">
                <div className="mb-3.5">
                  <label className="block text-[11px] font-bold text-slate-600 mb-1.5 tracking-wide">ຍີ່ຫໍ້</label>
                  <input className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-sky-300 focus:ring-2 focus:ring-sky-300/15 focus:outline-none transition-all" value={formBrand} onChange={(e) => setFormBrand(e.target.value)} placeholder="ເຊັ່ນ: Dell, HP" />
                </div>
                <div className="mb-3.5">
                  <label className="block text-[11px] font-bold text-slate-600 mb-1.5 tracking-wide">ລຸ່ນ</label>
                  <input className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-sky-300 focus:ring-2 focus:ring-sky-300/15 focus:outline-none transition-all" value={formModel} onChange={(e) => setFormModel(e.target.value)} placeholder="ເຊັ່ນ: Latitude 5540" />
                </div>
              </div>
              <div className="mb-3.5">
                <label className="block text-[11px] font-bold text-slate-600 mb-1.5 tracking-wide">ເລກ Serial</label>
                <input className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-sky-300 focus:ring-2 focus:ring-sky-300/15 focus:outline-none transition-all" value={formSerial} onChange={(e) => setFormSerial(e.target.value)} placeholder="ເຊັ່ນ: ABC123XYZ" />
              </div>
              <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1 max-sm:gap-0">
                <div className="mb-3.5">
                  <label className="block text-[11px] font-bold text-slate-600 mb-1.5 tracking-wide">ວັນທີຊື້</label>
                  <input className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 focus:border-sky-300 focus:ring-2 focus:ring-sky-300/15 focus:outline-none transition-all" type="date" value={formPurchaseDate} onChange={(e) => setFormPurchaseDate(e.target.value)} />
                </div>
                <div className="mb-3.5">
                  <label className="block text-[11px] font-bold text-slate-600 mb-1.5 tracking-wide">ວັນໝົດປະກັນ</label>
                  <input className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 focus:border-sky-300 focus:ring-2 focus:ring-sky-300/15 focus:outline-none transition-all" type="date" value={formWarranty} onChange={(e) => setFormWarranty(e.target.value)} />
                </div>
              </div>
              <div className="mb-3.5">
                <label className="block text-[11px] font-bold text-slate-600 mb-1.5 tracking-wide">ໝາຍເຫດ</label>
                <textarea
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-sky-300 focus:ring-2 focus:ring-sky-300/15 focus:outline-none transition-all resize-y"
                  rows={3}
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="ໝາຍເຫດເພີ່ມເຕີມ..."
                />
              </div>
            </div>
            <div className="px-7 py-4 bg-slate-50/80 border-t border-slate-100 flex gap-2.5">
              <button className="flex-1 py-2.5 px-4 rounded-xl font-bold text-sm text-slate-600 bg-white border border-slate-200 cursor-pointer transition-all hover:bg-slate-50 hover:-translate-y-px" onClick={() => setModal(null)} type="button">ຍົກເລີກ</button>
              <button
                className="flex-1 py-2.5 px-4 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-sky-500 to-blue-600 border-none cursor-pointer shadow-lg shadow-sky-500/20 transition-all hover:-translate-y-px hover:shadow-xl hover:shadow-sky-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleSave}
                disabled={saving || !formName.trim()}
                type="button"
              >
                {saving ? 'ກຳລັງບັນທຶກ...' : modal === 'create' ? 'ເພີ່ມ' : 'ບັນທຶກ'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Modal ───────────────────────── */}
      {modal === 'delete' && selectedAsset && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[9999] p-5"
          style={{ animation: 'astOverlayFade 0.2s ease-out' }}
          onClick={(e) => { if (e.target === e.currentTarget) setModal(null) }}
        >
          <div
            className="bg-white w-full max-w-[480px] rounded-2xl border border-slate-200/80 shadow-xl overflow-hidden"
            style={{ animation: 'astModalPop 0.3s cubic-bezier(0.34,1.56,0.64,1)' }}
          >
            <div className="px-7 pt-7 pb-5 text-center bg-gradient-to-b from-red-50/40 to-transparent border-b border-slate-100">
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl grid place-items-center bg-gradient-to-br from-red-500 to-red-600 text-white shadow-lg shadow-red-500/25 text-2xl">
                🗑️
              </div>
              <h3 className="text-lg font-bold text-slate-900">ລົບຊັບສິນ</h3>
              <p className="text-slate-500 text-sm mt-1">ທ່ານແນ່ໃຈບໍ ທີ່ຈະລົບ &quot;{selectedAsset.name}&quot;?</p>
            </div>
            <div className="px-7 py-4 bg-slate-50/80 border-t border-slate-100 flex gap-2.5">
              <button className="flex-1 py-2.5 px-4 rounded-xl font-bold text-sm text-slate-600 bg-white border border-slate-200 cursor-pointer transition-all hover:bg-slate-50 hover:-translate-y-px" onClick={() => setModal(null)} type="button">ຍົກເລີກ</button>
              <button
                className="flex-1 py-2.5 px-4 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-red-500 to-red-600 border-none cursor-pointer shadow-lg shadow-red-500/25 transition-all hover:-translate-y-px hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleDelete}
                disabled={saving}
                type="button"
              >
                {saving ? 'ກຳລັງລົບ...' : 'ລົບ'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Transfer Modal ─────────────────────── */}
      {modal === 'transfer' && selectedAsset && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[9999] p-5"
          style={{ animation: 'astOverlayFade 0.2s ease-out' }}
          onClick={(e) => { if (e.target === e.currentTarget) setModal(null) }}
        >
          <div
            className="bg-white w-full max-w-[480px] rounded-2xl border border-slate-200/80 shadow-xl overflow-hidden"
            style={{ animation: 'astModalPop 0.3s cubic-bezier(0.34,1.56,0.64,1)' }}
          >
            <div className="px-7 pt-7 pb-5 text-center bg-gradient-to-b from-green-50/40 to-transparent border-b border-slate-100">
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl grid place-items-center bg-gradient-to-br from-green-500 to-green-600 text-white shadow-lg shadow-green-500/25 text-2xl">
                🔄
              </div>
              <h3 className="text-lg font-bold text-slate-900">ມອບ / ໂອນ / ຄືນ ຊັບສິນ</h3>
              <p className="text-slate-500 text-sm mt-1">{selectedAsset.name}</p>
            </div>
            <div className="px-7 py-6">
              <div className="mb-3.5">
                <label className="block text-[11px] font-bold text-slate-600 mb-1.5 tracking-wide">ການດຳເນີນການ *</label>
                <select className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 focus:border-sky-300 focus:ring-2 focus:ring-sky-300/15 focus:outline-none transition-all" value={transferAction} onChange={(e) => setTransferAction(e.target.value)}>
                  {!selectedAsset.current_holder_name && <option value="assign">👤 ມອບໃຫ້</option>}
                  {selectedAsset.current_holder_name && <option value="transfer">🔄 ໂອນ</option>}
                  {selectedAsset.current_holder_name && <option value="return">📥 ຄືນ</option>}
                </select>
              </div>
              {selectedAsset.current_holder_name && (
                <div className="mb-3.5">
                  <label className="block text-[11px] font-bold text-slate-600 mb-1.5 tracking-wide">ຜູ້ຖືຄອງປັດຈຸບັນ</label>
                  <input className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-500" value={selectedAsset.current_holder_name} disabled />
                </div>
              )}
              {transferAction !== 'return' && (
                <div className="mb-3.5">
                  <label className="block text-[11px] font-bold text-slate-600 mb-1.5 tracking-wide">ຜູ້ຮັບໃໝ່ *</label>
                  <select className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 focus:border-sky-300 focus:ring-2 focus:ring-sky-300/15 focus:outline-none transition-all" value={transferHolder} onChange={(e) => setTransferHolder(e.target.value)}>
                    <option value="">-- ເລືອກພະນັກງານ --</option>
                    {employees.map((emp) => (
                      <option key={emp.code} value={emp.name}>{emp.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="mb-3.5">
                <label className="block text-[11px] font-bold text-slate-600 mb-1.5 tracking-wide">ໝາຍເຫດ</label>
                <textarea
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-sky-300 focus:ring-2 focus:ring-sky-300/15 focus:outline-none transition-all resize-y"
                  rows={2}
                  value={transferNote}
                  onChange={(e) => setTransferNote(e.target.value)}
                  placeholder="ເຫດຜົນການໂອນ/ມອບ..."
                />
              </div>
            </div>
            <div className="px-7 py-4 bg-slate-50/80 border-t border-slate-100 flex gap-2.5">
              <button className="flex-1 py-2.5 px-4 rounded-xl font-bold text-sm text-slate-600 bg-white border border-slate-200 cursor-pointer transition-all hover:bg-slate-50 hover:-translate-y-px" onClick={() => setModal(null)} type="button">ຍົກເລີກ</button>
              <button
                className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-sm text-white border-none cursor-pointer transition-all hover:-translate-y-px hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed ${
                  transferAction === 'return'
                    ? 'bg-gradient-to-r from-sky-500 to-blue-600 shadow-lg shadow-sky-500/20'
                    : 'bg-gradient-to-r from-green-500 to-green-600 shadow-lg shadow-green-500/25'
                }`}
                onClick={handleTransfer}
                disabled={saving || (transferAction !== 'return' && !transferHolder)}
                type="button"
              >
                {saving ? 'ກຳລັງດຳເນີນ...' : transferAction === 'return' ? 'ຄືນ' : transferAction === 'assign' ? 'ມອບ' : 'ໂອນ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
