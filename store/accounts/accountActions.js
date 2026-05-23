import { apiRequest } from '../apiClient';

export const getAccounts = async (token, filters = {}) => {
  const query = Object.entries(filters)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  const result = await apiRequest(`/accounts${query ? `?${query}` : ''}`, { token });
  return {
    accounts: result?.data || result?.accounts || [],
    pagination: result?.pagination || { page: 1, limit: 20, total: 0, pages: 0 },
  };
};

export const getMyVisitAccounts = async (token, filters = {}) => {
  const query = Object.entries(filters)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  const result = await apiRequest(`/accounts/my-visits${query ? `?${query}` : ''}`, { token });
  return {
    accounts: result?.data || result?.accounts || [],
    pagination: result?.pagination || { page: 1, limit: 20, total: 0, pages: 0 },
  };
};

export const getAccountById = async (token, accountId) => {
  const result = await apiRequest(`/accounts/${accountId}`, { token });
  return result?.data || result?.account || result;
};

export const createAccount = async (token, body) => {
  const result = await apiRequest('/accounts', { token, method: 'POST', body });
  return result?.data || result?.account || result;
};

export const updateAccount = async (token, accountId, body) => {
  const result = await apiRequest(`/accounts/${accountId}`, { token, method: 'PATCH', body });
  return result?.data || result?.account || result;
};

export const deleteAccount = async (token, accountId) => {
  return apiRequest(`/accounts/${accountId}`, { token, method: 'DELETE' });
};

export const selectForVisit = async (token, accountId) => {
  const result = await apiRequest(`/accounts/${accountId}/select-for-visit`, { token, method: 'PATCH' });
  return result?.data || result;
};

export const unselectForVisit = async (token, accountId) => {
  const result = await apiRequest(`/accounts/${accountId}/unselect-for-visit`, { token, method: 'PATCH' });
  return result?.data || result;
};

export const bulkAssignRep = async (token, accountIds, medicalRepId) => {
  const result = await apiRequest('/accounts/assign-rep-bulk', {
    token, method: 'PATCH', body: { accountIds, medicalRepId },
  });
  return result?.data || result;
};

export const bulkCreateAccounts = async (token, accounts) => {
  const result = await apiRequest('/accounts/bulk', { token, method: 'POST', body: { accounts } });
  return result?.data || result;
};
