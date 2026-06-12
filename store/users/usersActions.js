import { apiRequest } from '../apiClient';

const buildQuery = (params = {}) => {
  const q = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return q ? `?${q}` : '';
};

export const listUsers = async (token, params = {}) => {
  const result = await apiRequest(`/users${buildQuery(params)}`, { token });
  return result?.data?.users || result?.data || result?.users || result || [];
};
