import { apiRequest } from '../apiClient';

const buildQuery = (params = {}) => {
  const q = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return q ? `?${q}` : '';
};

export const listTargetAssignments = async (token, params = {}) => {
  const result = await apiRequest(`/target-assignments${buildQuery(params)}`, { token });
  const raw = result?.data || result?.assignments || result?.targetAssignments || [];
  return {
    assignments: Array.isArray(raw) ? raw : [],
    pagination: result?.pagination || { page: 1, limit: 20, total: 0, pages: 1 },
  };
};

export const getTargetOverview = async (token, params = {}) => {
  const result = await apiRequest(`/target-assignments/overview${buildQuery(params)}`, { token });
  return result?.data || result;
};

export const getTargetAssignmentById = async (token, id) => {
  const result = await apiRequest(`/target-assignments/${id}`, { token });
  return result?.data || result?.assignment || result;
};

export const getTargetMonthlyBreakdown = async (token, id, phasingId) => {
  const q = phasingId ? `?phasingId=${encodeURIComponent(phasingId)}` : '';
  const result = await apiRequest(`/target-assignments/${id}/monthly-breakdown${q}`, { token });
  return result?.data || result;
};

export const createTargetAssignment = async (token, payload) => {
  const result = await apiRequest('/target-assignments', { token, method: 'POST', body: payload });
  return result?.data || result?.assignment || result;
};

export const bulkCreateTargetAssignments = async (token, payload) => {
  const result = await apiRequest('/target-assignments/bulk', { token, method: 'POST', body: payload });
  return result?.data || result;
};

export const updateTargetAssignment = async (token, id, payload) => {
  const result = await apiRequest(`/target-assignments/${id}`, { token, method: 'PATCH', body: payload });
  return result?.data || result?.assignment || result;
};

export const updateTargetAssignmentStatus = async (token, id, payload) => {
  const result = await apiRequest(`/target-assignments/${id}/status`, { token, method: 'PATCH', body: payload });
  return result?.data || result?.assignment || result;
};

export const deleteTargetAssignment = async (token, id) => {
  return apiRequest(`/target-assignments/${id}`, { token, method: 'DELETE' });
};
