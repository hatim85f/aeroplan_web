import { apiRequest } from '../apiClient';

const buildQuery = (params = {}) => {
  const q = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return q ? `?${q}` : '';
};

export const listAreas = async (token, params = {}) => {
  const result = await apiRequest(`/areas${buildQuery(params)}`, { token });
  const raw = Array.isArray(result?.data) ? result.data
    : Array.isArray(result?.data?.areas) ? result.data.areas
    : Array.isArray(result?.areas) ? result.areas : [];
  return { areas: raw, pagination: result?.pagination || result?.data?.pagination || { page: 1, limit: raw.length || 20, total: raw.length, pages: 1 } };
};

export const getAreaById = async (token, id) => {
  const result = await apiRequest(`/areas/${id}`, { token });
  return result?.data || result?.area || result;
};

export const createArea = async (token, payload) => {
  const result = await apiRequest('/areas', { token, method: 'POST', body: payload });
  return result?.data || result?.area || result;
};

export const updateArea = async (token, id, payload) => {
  const result = await apiRequest(`/areas/${id}`, { token, method: 'PATCH', body: payload });
  return result?.data || result?.area || result;
};

export const updateAreaStatus = async (token, id, payload) => {
  const result = await apiRequest(`/areas/${id}/status`, { token, method: 'PATCH', body: payload });
  return result?.data || result?.area || result;
};

export const deleteArea = async (token, id) => apiRequest(`/areas/${id}`, { token, method: 'DELETE' });
