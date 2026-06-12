import { apiRequest } from '../apiClient';

const dataOf = (r) => r?.data ?? r;

export const getNotifications = async (token) => {
  const r = await apiRequest('/notifications', { token });
  return Array.isArray(r?.data) ? r.data : [];
};

export const markNotificationOpened = async (token, id) =>
  dataOf(await apiRequest(`/notifications/${id}/open`, { token, method: 'PATCH' }));
