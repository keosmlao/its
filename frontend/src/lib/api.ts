import { getToken, clearUser } from './auth'

const BASE_URL = '/api'

interface ApiResponse {
  data: any
  status: number
}

async function request(
  method: string,
  path: string,
  body?: unknown,
  isFormData?: boolean,
): Promise<ApiResponse> {
  const headers: Record<string, string> = {}
  const token = getToken()
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
    headers['X-Access-Token'] = token
  }
  if (body && !isFormData) {
    headers['Content-Type'] = 'application/json'
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: isFormData ? (body as FormData) : body ? JSON.stringify(body) : undefined,
  })

  if (response.status === 401) {
    clearUser()
  }

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    const error: Record<string, unknown> = new Error('Request failed') as unknown as Record<string, unknown>
    error.response = { status: response.status, data }
    throw error
  }

  return { data, status: response.status }
}

class ApiClient {
  lineLogin(code: string) { return request('POST', '/auth/line', { code }) }
  me() { return request('GET', '/auth/me') }

  listTickets() { return request('GET', '/tickets') }
  getTicket(id: number | string) { return request('GET', `/tickets/${id}`) }
  createTicket(payload: Record<string, unknown>) { return request('POST', '/tickets', payload) }
  updateTicket(id: number | string, payload: Record<string, unknown>) { return request('PATCH', `/tickets/${id}`, payload) }
  deleteTicket(id: number | string) { return request('DELETE', `/tickets/${id}`) }
  assignTicket(id: number | string, payload: Record<string, unknown>) { return request('POST', `/tickets/${id}/assign`, payload) }
  assignTicketWithStatus(id: number | string, payload: Record<string, unknown>) { return request('POST', `/tickets/${id}/assign-status`, payload) }
  takeTicket(id: number | string, payload: Record<string, unknown>) { return request('POST', `/tickets/${id}/take`, payload) }
  assignOrTakeTicket(id: number | string, payload: Record<string, unknown>) { return request('POST', `/tickets/${id}/assign-take`, payload) }
  updateTicketStatus(id: number | string, payload: Record<string, unknown>) { return request('PATCH', `/tickets/${id}/status`, payload) }
  updateTicketPriority(id: number | string, payload: Record<string, unknown>) { return request('PATCH', `/tickets/${id}/priority`, payload) }
  getTicketHistory(id: number | string) { return request('GET', `/tickets/${id}/history`) }

  listProjects() { return request('GET', '/projects') }
  getProject(id: number | string) { return request('GET', `/projects/${id}`) }
  createProject(payload: Record<string, unknown>) { return request('POST', '/projects', payload) }
  updateProject(id: number | string, payload: Record<string, unknown>) { return request('PATCH', `/projects/${id}`, payload) }
  deleteProject(id: number | string) { return request('DELETE', `/projects/${id}`) }
  closeProject(id: number | string) { return request('POST', `/projects/${id}/close`) }
  reopenProject(id: number | string) { return request('POST', `/projects/${id}/reopen`) }
  getProjectHistory(id: number | string) { return request('GET', `/projects/${id}/history`) }
  setProjectRequirements(id: number | string, payload: FormData | Record<string, unknown>) {
    if (payload && !(payload instanceof FormData) && typeof payload === 'object') {
      const body = new FormData()
      if ('requirements_text' in payload) body.append('requirements_text', String(payload.requirements_text ?? ''))
      if ('requirements_items' in payload) {
        const items = Array.isArray(payload.requirements_items) ? payload.requirements_items : []
        body.append('requirements_items', JSON.stringify(items))
      }
      if ('files' in payload && Array.isArray(payload.files)) {
        ;(payload.files as (File | null)[]).forEach((file) => { if (file) body.append('files', file) })
      }
      return request('POST', `/projects/${id}/requirements`, body, true)
    }
    return request('POST', `/projects/${id}/requirements`, payload as FormData, true)
  }

  listTasks() { return request('GET', '/tasks') }
  createTask(payload: Record<string, unknown>) { return request('POST', '/tasks', payload) }
  updateTask(id: number | string, payload: Record<string, unknown>) { return request('PATCH', `/tasks/${id}`, payload) }
  deleteTask(id: number | string) { return request('DELETE', `/tasks/${id}`) }

  listKnowledge() { return request('GET', '/knowledge') }
  createKnowledge(payload: Record<string, unknown>) { return request('POST', '/knowledge', payload) }
  updateKnowledge(id: number | string, payload: Record<string, unknown>) { return request('PATCH', `/knowledge/${id}`, payload) }
  deleteKnowledge(id: number | string) { return request('DELETE', `/knowledge/${id}`) }

  listAssets() { return request('GET', '/assets') }
  createAsset(payload: Record<string, unknown>) { return request('POST', '/assets', payload) }
  updateAsset(id: number | string, payload: Record<string, unknown>) { return request('PATCH', `/assets/${id}`, payload) }
  deleteAsset(id: number | string) { return request('DELETE', `/assets/${id}`) }
  transferAsset(id: number | string, payload: Record<string, unknown>) { return request('POST', `/assets/${id}/transfer`, payload) }
  getAssetHistory(id: number | string) { return request('GET', `/assets/${id}/history`) }

  listUsers() { return request('GET', '/users') }
  createUser(payload: Record<string, unknown>) { return request('POST', '/users', payload) }
  updateUser(id: number | string, payload: Record<string, unknown>) { return request('PATCH', `/users/${id}`, payload) }
  deleteUser(id: number | string) { return request('DELETE', `/users/${id}`) }
  listSupportUsers() { return request('GET', '/support-users') }
  listDepartments() { return request('GET', '/departments') }
  listDivisions() { return request('GET', '/divisions') }
  listDepartmentsByDivision(divisionCode: string) { return request('GET', `/divisions/${divisionCode}/departments`) }
  listRequesters(params?: { division_code?: string; department_code?: string }) {
    const q = new URLSearchParams()
    if (params?.division_code) q.set('division_code', params.division_code)
    if (params?.department_code) q.set('department_code', params.department_code)
    const qs = q.toString()
    return request('GET', `/requesters${qs ? `?${qs}` : ''}`)
  }
  listAssignments() { return request('GET', '/assignments') }

  listCategories() { return request('GET', '/categories') }
  createCategory(payload: Record<string, unknown>) { return request('POST', '/categories', payload) }
  deleteCategory(id: number | string) { return request('DELETE', `/categories/${id}`) }

  listSla() { return request('GET', '/sla') }
  createSla(payload: Record<string, unknown>) { return request('POST', '/sla', payload) }
  updateSla(id: number | string, payload: Record<string, unknown>) { return request('PATCH', `/sla/${id}`, payload) }
  deleteSla(id: number | string) { return request('DELETE', `/sla/${id}`) }

  listNotifications() { return request('GET', '/notifications') }
  markNotificationsRead(ids?: number[]) { return request('PATCH', '/notifications', ids ? { ids } : {}) }
}

const api = new ApiClient()
export default api
export { ApiClient }
