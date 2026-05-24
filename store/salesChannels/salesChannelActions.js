import { apiRequest } from '../apiClient';

const buildQuery = (params = {}) => {
  const q = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return q ? `?${q}` : '';
};

const unwrap = (result) =>
  result?.data?.salesChannels ||
  result?.data?.channels ||
  result?.data ||
  result?.salesChannels ||
  result?.channels ||
  result;

export const listSalesChannels = async (token, params = {}) => {
  const result = await apiRequest(`/sales-channels${buildQuery(params)}`, { token });
  const raw = unwrap(result);
  return {
    channels: Array.isArray(raw) ? raw : [],
    pagination: result?.pagination || { page: 1, limit: 50, total: 0, pages: 1 },
  };
};

export const getSalesChannelById = async (token, id) => {
  const result = await apiRequest(`/sales-channels/${id}`, { token });
  return result?.data?.salesChannel || result?.data?.channel || result?.data || result?.salesChannel || result?.channel || result;
};

export const createSalesChannel = async (token, payload) => {
  const result = await apiRequest('/sales-channels', { token, method: 'POST', body: payload });
  return result?.data?.salesChannel || result?.data?.channel || result?.data || result?.salesChannel || result?.channel || result;
};

export const updateSalesChannel = async (token, id, payload) => {
  const result = await apiRequest(`/sales-channels/${id}`, { token, method: 'PATCH', body: payload });
  return result?.data?.salesChannel || result?.data?.channel || result?.data || result?.salesChannel || result?.channel || result;
};

export const updateSalesChannelStatus = async (token, id, payload) => {
  const result = await apiRequest(`/sales-channels/${id}/status`, { token, method: 'PATCH', body: payload });
  return result?.data?.salesChannel || result?.data?.channel || result?.data || result?.salesChannel || result?.channel || result;
};

export const deleteSalesChannel = async (token, id) => {
  return apiRequest(`/sales-channels/${id}`, { token, method: 'DELETE' });
};
