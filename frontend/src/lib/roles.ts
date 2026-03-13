export const ROLE_LABELS: Record<string, string> = {
  user: 'User',
  manager: 'Manager',
  superviser: 'Superviser',
  programer: 'Programer',
  it_support: 'IT Support',
  helpdesk: 'Helpdesk',
}

export const ALL_ROLES = Object.keys(ROLE_LABELS)
export const MANAGER_ROLES = ['manager', 'superviser']
export const SUPPORT_ROLES = ['it_support', 'helpdesk']
