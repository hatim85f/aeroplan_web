import { apiRequest } from '../apiClient';

const buildQuery = (params = {}) => {
  const q = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return q ? `?${q}` : '';
};

export const listStockAccounts = async (token, params = {}) => {
  const result = await apiRequest(`/stock-accounts${buildQuery(params)}`, { token });
  return Array.isArray(result?.data) ? result.data : [];
};

export const createStockAccount = async (token, payload) => {
  const result = await apiRequest('/stock-accounts', { token, method: 'POST', body: payload });
  return result?.data || result;
};

export const getStockAccountDetails = async (token, id) => {
  const result = await apiRequest(`/stock-accounts/${id}`, { token });
  return result?.data || result;
};

export const deleteStockAccount = async (token, id) => {
  const result = await apiRequest(`/stock-accounts/${id}`, { token, method: 'DELETE' });
  return result?.data || result;
};

export const updateStockAccount = async (token, id, payload) => {
  const result = await apiRequest(`/stock-accounts/${id}`, { token, method: 'PATCH', body: payload });
  return result?.data || result;
};

export const addLinkedAccounts = async (token, id, linkedAccountIds) => {
  const result = await apiRequest(`/stock-accounts/${id}/linked-accounts`, {
    token, method: 'POST', body: { linkedAccountIds },
  });
  return result?.data || result;
};

export const removeLinkedAccount = async (token, id, accountId) => {
  const result = await apiRequest(`/stock-accounts/${id}/linked-accounts/${accountId}`, {
    token, method: 'DELETE',
  });
  return result?.data || result;
};

export const getLatestStock = async (token, id) => {
  const result = await apiRequest(`/stock-accounts/${id}/latest`, { token });
  return Array.isArray(result?.data) ? result.data : [];
};

export const createStockUpdate = async (token, id, items) => {
  const result = await apiRequest(`/stock-accounts/${id}/updates`, {
    token, method: 'POST', body: { items },
  });
  return result?.data || result;
};

export const getStockHistory = async (token, id, params = {}) => {
  const result = await apiRequest(`/stock-accounts/${id}/history${buildQuery(params)}`, { token });
  return Array.isArray(result?.data) ? result.data : [];
};

export const recalculateSalesInflow = async (token, id) => {
  const result = await apiRequest(`/stock-accounts/${id}/recalculate-sales-inflow`, { token, method: 'POST' });
  return result?.data || result;
};
