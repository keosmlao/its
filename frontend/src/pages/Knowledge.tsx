import { useState } from 'react'
import { Search, BookOpen, Eye } from 'lucide-react'

interface Article {
  id: number
  title: string
  category: string
  icon: string
  content: string
  views: number
}

const articles: Article[] = [
  { id: 1, title: 'ວິທີ Reset Password Email', category: 'Account', icon: '🔐', content: 'ຂັ້ນຕອນການ reset password...', views: 156 },
  { id: 2, title: 'ການຕິດຕັ້ງ VPN', category: 'Network', icon: '🌐', content: 'ວິທີຕິດຕັ້ງ VPN...', views: 89 },
  { id: 3, title: 'ແກ້ໄຂ Printer ພິມບໍ່ອອກ', category: 'Hardware', icon: '🖨️', content: 'ຂັ້ນຕອນການແກ້ໄຂ...', views: 234 },
  { id: 4, title: 'ຕິດຕັ້ງ Microsoft Office', category: 'Software', icon: '💿', content: 'ວິທີຕິດຕັ້ງ Office...', views: 312 },
  { id: 5, title: 'ເຊື່ອມຕໍ່ WiFi ບໍລິສັດ', category: 'Network', icon: '📶', content: 'ຂັ້ນຕອນການເຊື່ອມຕໍ່...', views: 178 },
]

const categories = ['all', 'Account', 'Network', 'Hardware', 'Software']

export default function KnowledgePage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')

  const filteredArticles = articles.filter(a => {
    if (selectedCategory !== 'all' && a.category !== selectedCategory) return false
    if (searchQuery && !a.title.toLowerCase().includes(searchQuery.toLowerCase())) return false
    return true
  })

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 grid place-items-center text-white shadow-lg shadow-amber-500/20">
            <BookOpen size={18} />
          </div>
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">ຄັງຄວາມຮູ້</span>
        </div>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">ຄັງຄວາມຮູ້</h1>
        <p className="mt-1.5 text-sm text-slate-500">ຄົ້ນຫາບົດຄວາມ ແລະ ຄູ່ມືການແກ້ໄຂບັນຫາ</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center mb-6">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300" />
          <input
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-700 outline-none transition placeholder:text-slate-300 focus:border-sky-300 focus:ring-2 focus:ring-sky-300/15"
            placeholder="ຄົ້ນຫາບົດຄວາມ..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-1.5">
          {categories.map(cat => (
            <button
              key={cat}
              type="button"
              className={`px-3.5 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                selectedCategory === cat
                  ? 'bg-slate-900 text-white shadow-md shadow-slate-900/15'
                  : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700'
              }`}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat === 'all' ? 'ທັງໝົດ' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredArticles.map(article => (
          <div
            key={article.id}
            className="group rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 cursor-pointer"
          >
            <div className="flex items-start gap-3.5">
              <span className="text-3xl shrink-0">{article.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-slate-900 group-hover:text-sky-600 transition-colors">{article.title}</div>
                <div className="text-[11px] text-slate-400 font-medium mt-1">{article.category}</div>
                <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-2">
                  <Eye size={12} />
                  <span>{article.views} ເບິ່ງ</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredArticles.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-20 text-slate-300">
          <span className="text-5xl">📚</span>
          <span className="text-sm font-medium">ບໍ່ພົບບົດຄວາມ</span>
        </div>
      )}
    </div>
  )
}
