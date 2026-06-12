import { apiRequest } from '../apiClient';

const buildQuery = (params = {}) => {
  const q = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return q ? `?${q}` : '';
};

const dataOf = (result) => result?.data ?? result;
const listOf = (result) => (Array.isArray(result?.data) ? result.data : []);

export const listPlanningAccounts = async (token, params = {}) =>
  listOf(await apiRequest(`/planning/accounts${buildQuery(params)}`, { token }));

export const getAccountSource = async (token, params = {}) =>
  listOf(await apiRequest(`/planning/accounts/source${buildQuery(params)}`, { token }));

export const createPlanningAccount = async (token, payload) =>
  dataOf(await apiRequest('/planning/accounts', { token, method: 'POST', body: payload }));

export const updatePlanningAccount = async (token, id, payload) =>
  dataOf(await apiRequest(`/planning/accounts/${id}`, { token, method: 'PATCH', body: payload }));

export const deletePlanningAccount = async (token, id) =>
  dataOf(await apiRequest(`/planning/accounts/${id}`, { token, method: 'DELETE' }));

export const getMyCalendar = async (token, params = {}) =>
  dataOf(await apiRequest(`/planning/calendar/my${buildQuery(params)}`, { token }));

export const getTeamDay = async (token, params = {}) =>
  dataOf(await apiRequest(`/planning/calendar/team${buildQuery(params)}`, { token }));

export const getTeamWeek = async (token, params = {}) =>
  dataOf(await apiRequest(`/planning/calendar/team-week${buildQuery(params)}`, { token }));

export const createVisits = async (token, visits, userId) =>
  dataOf(await apiRequest('/planning/visits', { token, method: 'POST', body: { visits, ...(userId ? { userId } : {}) } }));

export const updateVisit = async (token, id, payload) =>
  dataOf(await apiRequest(`/planning/visits/${id}`, { token, method: 'PATCH', body: payload }));

export const deleteVisit = async (token, id) =>
  dataOf(await apiRequest(`/planning/visits/${id}`, { token, method: 'DELETE' }));

export const submitPlan = async (token, payload) =>
  dataOf(await apiRequest('/planning/submit', { token, method: 'POST', body: payload }));

export const getManagerDashboard = async (token, params = {}) =>
  dataOf(await apiRequest(`/planning/dashboard/manager${buildQuery(params)}`, { token }));

export const getAccountsReport = async (token, params = {}) =>
  dataOf(await apiRequest(`/planning/reports/accounts${buildQuery(params)}`, { token }));

export const getRepsReport = async (token, params = {}) =>
  dataOf(await apiRequest(`/planning/reports/reps${buildQuery(params)}`, { token }));
