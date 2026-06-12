import { apiRequest } from '../apiClient';

const buildQuery = (params = {}) => {
  const q = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return q ? `?${q}` : '';
};

export const listSharedSalesRules = async (token, params = {}) => {
  const result = await apiRequest(`/shared-sales-rules${buildQuery(params)}`, { token });
  const raw = Array.isArray(result?.data) ? result.data
    : Array.isArray(result?.data?.rules) ? result.data.rules
    : Array.isArray(result?.data?.sharedSalesRules) ? result.data.sharedSalesRules
    : Array.isArray(result?.rules) ? result.rules
    : Array.isArray(result?.sharedSalesRules) ? result.sharedSalesRules : [];
  return { rules: raw, pagination: result?.pagination || result?.data?.pagination || { page: 1, limit: raw.length || 20, total: raw.length, pages: 1 } };
};

export const getSharedSalesRuleById = async (token, id) => {
  const result = await apiRequest(`/shared-sales-rules/${id}`, { token });
  return result?.data || result?.rule || result?.sharedSalesRule || result;
};

export const createSharedSalesRule = async (token, payload) => {
  const result = await apiRequest('/shared-sales-rules', { token, method: 'POST', body: payload });
  return result?.data || result?.rule || result?.sharedSalesRule || result;
};

export const updateSharedSalesRule = async (token, id, payload) => {
  const result = await apiRequest(`/shared-sales-rules/${id}`, { token, method: 'PATCH', body: payload });
  return result?.data || result?.rule || result?.sharedSalesRule || result;
};

export const updateSharedSalesRuleStatus = async (token, id, payload) => {
  const result = await apiRequest(`/shared-sales-rules/${id}/status`, { token, method: 'PATCH', body: payload });
  return result?.data || result?.rule || result?.sharedSalesRule || result;
};

export const deleteSharedSalesRule = async (token, id) => {
  if (!id) throw new Error('Shared sales rule id is required for delete');
  return apiRequest(`/shared-sales-rules/${encodeURIComponent(String(id))}`, { token, method: 'DELETE' });
};
