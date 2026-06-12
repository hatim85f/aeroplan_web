const structureManagerRoles = new Set(['admin', 'manager', 'senior_manager']);
// Operational roles that can create/edit channels, rep coverage, etc. — excludes senior_manager.
const operationsManagerRoles = new Set(['admin', 'manager']);

const roleOf = (user) => String(user?.role || '').trim().toLowerCase();

export const canManageStructure = (user) => structureManagerRoles.has(roleOf(user));

// Admin or manager only (senior_manager excluded). Use for Rep Coverage and editing Sales Channels.
export const canManageOperations = (user) => operationsManagerRoles.has(roleOf(user));

export const isSeniorManager = (user) => roleOf(user) === 'senior_manager';

export const isAdmin = (user) => roleOf(user) === 'admin';
