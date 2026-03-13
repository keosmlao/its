const STORAGE_KEY = 'it.user'
const TOKEN_KEY = 'it.token'

export interface StoredUser {
  id: number
  name: string
  username: string
  role: string
  avatar?: string
  displayName?: string
  department_id?: number
  [key: string]: unknown
}

export const getStoredUser = (): StoredUser | null => {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    const user = JSON.parse(raw)
    if (!user?.id || !user?.role) {
      localStorage.removeItem(STORAGE_KEY)
      return null
    }
    return user as StoredUser
  } catch {
    return null
  }
}

export const storeUser = (user: StoredUser) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
}

export const storeToken = (token: string) => {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token)
  }
}

export const getToken = (): string | null => {
  return localStorage.getItem(TOKEN_KEY)
}

export const clearUser = () => {
  localStorage.removeItem(STORAGE_KEY)
  localStorage.removeItem(TOKEN_KEY)
}
