const structureManagerRoles = new Set(['admin', 'manager', 'senior_manager']);

export const canManageStructure = (user) =>
  structureManagerRoles.has(String(user?.role || '').trim().toLowerCase());
