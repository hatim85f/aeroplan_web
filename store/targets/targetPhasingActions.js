import { apiRequest } from '../apiClient';

const buildQuery = (params = {}) => {
  const q = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return q ? `?${q}` : '';
};

export const listTargetPhasing = async (token, params = {}) => {
  const result = await apiRequest(`/target-phasing${buildQuery(params)}`, { token });
  const raw = result?.data || result?.phasings || result?.phasing || [];
  return {
    phasings: Array.isArray(raw) ? raw : [],
    pagination: result?.pagination || { page: 1, limit: 50, total: 0, pages: 1 },
  };
};

export const getTargetPhasingById = async (token, id) => {
  const result = await apiRequest(`/target-phasing/${id}`, { token });
  return result?.data || result?.phasing || result;
};

export const createTargetPhasing = async (token, payload) => {
  const result = await apiRequest('/target-phasing', { token, method: 'POST', body: payload });
  return result?.data || result?.phasing || result;
};

export const updateTargetPhasing = async (token, id, payload) => {
  const result = await apiRequest(`/target-phasing/${id}`, { token, method: 'PATCH', body: payload });
  return result?.data || result?.phasing || result;
};

export const updateTargetPhasingStatus = async (token, id, payload) => {
  const result = await apiRequest(`/target-phasing/${id}/status`, { token, method: 'PATCH', body: payload });
  return result?.data || result?.phasing || result;
};

export const deleteTargetPhasing = async (token, id) => {
  return apiRequest(`/target-phasing/${id}`, { token, method: 'DELETE' });
};
