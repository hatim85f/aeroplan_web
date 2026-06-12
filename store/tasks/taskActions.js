import { apiRequest } from '../apiClient';

const buildQuery = (params = {}) => {
  const q = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return q ? `?${q}` : '';
};
const dataOf = (r) => r?.data ?? r;
const listOf = (r) => (Array.isArray(r?.data) ? r.data : []);

export const listMyTasks = async (token, params = {}) => listOf(await apiRequest(`/tasks/my${buildQuery(params)}`, { token }));
export const listTeamTasks = async (token, params = {}) => listOf(await apiRequest(`/tasks/team${buildQuery(params)}`, { token }));
export const getAssignableUsers = async (token) => listOf(await apiRequest('/tasks/assignable-users', { token }));
export const createTask = async (token, body) => dataOf(await apiRequest('/tasks', { token, method: 'POST', body }));
export const getTaskDashboard = async (token, id, params = {}) => dataOf(await apiRequest(`/tasks/${id}/dashboard${buildQuery(params)}`, { token }));
export const updateTask = async (token, id, body) => dataOf(await apiRequest(`/tasks/${id}`, { token, method: 'PATCH', body }));
export const archiveTask = async (token, id) => dataOf(await apiRequest(`/tasks/${id}`, { token, method: 'DELETE' }));
export const addAssignees = async (token, id, userIds) => dataOf(await apiRequest(`/tasks/${id}/assignees`, { token, method: 'POST', body: { userIds } }));
export const removeAssignee = async (token, id, userId) => dataOf(await apiRequest(`/tasks/${id}/assignees/${userId}`, { token, method: 'DELETE' }));
export const completeStep = async (token, id, stepId, note) => dataOf(await apiRequest(`/tasks/${id}/steps/${stepId}/complete`, { token, method: 'POST', body: { note } }));
export const uncompleteStep = async (token, id, stepId) => dataOf(await apiRequest(`/tasks/${id}/steps/${stepId}/uncomplete`, { token, method: 'POST' }));
export const addRecurringCompletion = async (token, id, body) => dataOf(await apiRequest(`/tasks/${id}/recurring/complete`, { token, method: 'POST', body }));
export const listMessages = async (token, id, params = {}) => listOf(await apiRequest(`/tasks/${id}/messages${buildQuery(params)}`, { token }));
export const sendMessage = async (token, id, body) => dataOf(await apiRequest(`/tasks/${id}/messages`, { token, method: 'POST', body }));
export const deleteMessage = async (token, id, messageId) => dataOf(await apiRequest(`/tasks/${id}/messages/${messageId}`, { token, method: 'DELETE' }));
export const getMyTaskDashboard = async (token) => dataOf(await apiRequest('/tasks/dashboard/my', { token }));
export const getTeamTaskDashboard = async (token) => dataOf(await apiRequest('/tasks/dashboard/team', { token }));
export const getTaskReport = async (token, params = {}) => dataOf(await apiRequest(`/tasks/reports/progress${buildQuery(params)}`, { token }));
