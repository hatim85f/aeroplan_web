import { apiRequest } from '../apiClient';

const buildQuery = (params = {}) => {
  const q = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return q ? `?${q}` : '';
};

/**
 * GET /api/sales-team
 * Returns { data: [...], pagination: {...} }
 */
export const listSalesTeamMembers = async (token, params = {}) => {
  const result = await apiRequest(`/sales-team${buildQuery(params)}`, { token });
  return {
    data: result?.data || result?.salesTeam || [],
    pagination: result?.pagination || { page: 1, limit: 20, total: 0, pages: 1 },
  };
};

/**
 * GET /api/sales-team/:id
 */
export const getSalesTeamMemberById = async (token, id) => {
  const result = await apiRequest(`/sales-team/${id}`, { token });
  return result?.data || result?.salesTeamMember || result;
};

/**
 * POST /api/sales-team
 * Body: { fullName, phone, email, position, accountIds, managerId, teamManaged, notes, isActive }
 */
export const createSalesTeamMember = async (token, payload) => {
  const result = await apiRequest('/sales-team', { token, method: 'POST', body: payload });
  return result?.data || result?.salesTeamMember || result;
};

/**
 * PATCH /api/sales-team/:id
 */
export const updateSalesTeamMember = async (token, id, payload) => {
  const result = await apiRequest(`/sales-team/${id}`, { token, method: 'PATCH', body: payload });
  return result?.data || result?.salesTeamMember || result;
};

/**
 * PATCH /api/sales-team/:id/status
 * Body: { isActive: boolean, status: "active" | "inactive" }
 */
export const updateSalesTeamMemberStatus = async (token, id, isActive) => {
  const result = await apiRequest(`/sales-team/${id}/status`, {
    token,
    method: 'PATCH',
    body: { isActive, status: isActive ? 'active' : 'inactive' },
  });
  return result?.data || result;
};

/**
 * DELETE /api/sales-team/:id
 */
export const deleteSalesTeamMember = async (token, id) => {
  return apiRequest(`/sales-team/${id}`, { token, method: 'DELETE' });
};

/**
 * GET /api/sales-team/account/:accountId
 * Returns array of sales team members assigned to this account
 */
export const getSalesTeamByAccount = async (token, accountId) => {
  const result = await apiRequest(`/sales-team/account/${accountId}`, { token });
  return result?.data || result?.salesTeam || [];
};
