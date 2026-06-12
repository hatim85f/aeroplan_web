import { apiRequest } from '../apiClient';

const buildQuery = (params = {}) => {
  const q = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return q ? `?${q}` : '';
};

export const listAccountAssignments = async (token, params = {}) => {
  const result = await apiRequest(`/account-assignments${buildQuery(params)}`, { token });
  return Array.isArray(result?.data) ? result.data : [];
};

export const createAccountAssignments = async (token, payload) => {
  const result = await apiRequest('/account-assignments', { token, method: 'POST', body: payload });
  return result?.data || result;
};

export const updateAccountAssignment = async (token, id, payload) => {
  const result = await apiRequest(`/account-assignments/${id}`, { token, method: 'PATCH', body: payload });
  return result?.data || result;
};

export const deleteAccountAssignment = async (token, id) => {
  const result = await apiRequest(`/account-assignments/${id}`, { token, method: 'DELETE' });
  return result?.data || result;
};

export const listCoverageReps = async (token) => {
  const result = await apiRequest('/account-assignments/reps', { token });
  return Array.isArray(result?.data) ? result.data : [];
};

export const setSalesAttribution = async (token, salesRecordId, repAttributions) => {
  const result = await apiRequest(`/sales/${salesRecordId}/attribution`, {
    token,
    method: 'PATCH',
    body: { repAttributions },
  });
  return result?.data || result;
};
