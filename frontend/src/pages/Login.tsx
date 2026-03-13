import { useEffect, useState, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../lib/api'
import { storeToken, storeUser, type StoredUser } from '../lib/auth'

const LINE_CHANNEL_ID = import.meta.env.VITE_LINE_CHANNEL_ID || ''
const LINE_CALLBACK_URL = import.meta.env.VITE_LINE_CALLBACK_URL || ''

const ROLE_DEFAULT_PATH: Record<string, string> = {
  manager: '/manager/dashboard',
  helpdesk: '/dashboard',
  it_support: '/dashboard',
  lead_programmer: '/dev/dashboard',
  programmer: '/dev/dashboard',
  user: '/dashboard',
}

export default function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const processedRef = useRef(false)

  const redirectToLine = () => {
    const state = Math.random().toString(36).substring(2)
    sessionStorage.setItem('line_login_state', state)
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: LINE_CHANNEL_ID,
      redirect_uri: LINE_CALLBACK_URL,
      state,
      scope: 'profile openid',
    })
    window.location.href = `https://access.line.me/oauth2/v2.1/authorize?${params.toString()}`
  }

  useEffect(() => {
    const code = searchParams.get('code')
    if (code) return
    const ua = navigator.userAgent || ''
    const isLineBrowser = /Line\//i.test(ua) || /LIFF/i.test(ua)
    if (isLineBrowser && !sessionStorage.getItem('line_auto_tried')) {
      sessionStorage.setItem('line_auto_tried', '1')
      setLoading(true)
      redirectToLine()
    }
  }, [searchParams])

  useEffect(() => {
    const code = searchParams.get('code')
    if (!code || processedRef.current) return
    processedRef.current = true
    setLoading(true)
    setError('')
    sessionStorage.removeItem('line_auto_tried')

    api.lineLogin(code)
      .then((response) => {
        const token = response.data.token || response.data.access_token || response.data.jwt
        if (!token) { setError('Login failed: missing token'); setLoading(false); return }
        storeToken(token)
        const user: StoredUser | undefined = response.data.user
        if (user) {
          storeUser(user)
          navigate(ROLE_DEFAULT_PATH[user.role] || '/dashboard', { replace: true })
        } else { setError('Login failed: missing user data'); setLoading(false) }
      })
      .catch((err: unknown) => {
        const apiErr = err as { response?: { data?: { error?: string } } }
        setError(apiErr?.response?.data?.error || 'LINE login failed. Please try again.')
        setLoading(false)
      })
  }, [searchParams, navigate])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-sky-50/30 p-4">
      <div className="w-full max-w-sm">
        <div className="rounded-2xl bg-white border border-slate-200/80 shadow-xl shadow-slate-200/50 overflow-hidden">
          {/* Header */}
          <div className="px-8 pt-10 pb-6 text-center bg-gradient-to-b from-slate-50 to-white">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-violet-500 via-blue-500 to-cyan-400 grid place-items-center text-3xl shadow-lg shadow-violet-500/20">
              🏢
            </div>
            <h1 className="text-2xl font-bold text-slate-900">ລະບົບ IT</h1>
            <p className="text-sm text-slate-400 mt-1">ຊ່ວຍເຫຼືອ ແລະ ພັດທະນາ</p>
          </div>

          {/* Form */}
          <div className="px-8 pb-8">
            {error && (
              <div className="mb-4 rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            {loading ? (
              <p className="text-center text-sm text-slate-400 py-4">ກຳລັງເຂົ້າສູ່ລະບົບ...</p>
            ) : (
              <button
                type="button"
                onClick={redirectToLine}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#06C755] text-white text-base font-bold shadow-lg shadow-[#06C755]/20 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-[#06C755]/25"
              >
                ເຂົ້າສູ່ລະບົບດ້ວຍ LINE
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
