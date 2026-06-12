import { apiRequest } from '../apiClient';

const buildQuery = (params = {}) => {
  const q = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return q ? `?${q}` : '';
};

export const getMyAchievement = async (token, params = {}) => {
  const result = await apiRequest(`/achievements/my${buildQuery(params)}`, { token });
  return result?.data || result;
};

export const getTeamAchievement = async (token, params = {}) => {
  const result = await apiRequest(`/achievements/team${buildQuery(params)}`, { token });
  return result?.data || result;
};
