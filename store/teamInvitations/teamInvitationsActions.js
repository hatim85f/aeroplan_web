import { apiRequest } from '../apiClient';

export const getPendingInvitations = async (token) => {
  const result = await apiRequest('/team-invitations?status=pending', { token });
  return result?.data || result?.invitations || result || [];
};

export const getInvitationHistory = async (token, filters = {}) => {
  const query = Object.entries(filters)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  const result = await apiRequest(`/team-invitations${query ? `?${query}` : ''}`, { token });
  return result?.data || result?.invitations || result || [];
};

export const sendInvitation = async (token, body) => {
  const result = await apiRequest('/team-invitations', { token, method: 'POST', body });
  return result?.data || result?.invitation || result;
};

export const acceptInvitation = async (token, invitationId) => {
  const result = await apiRequest(`/team-invitations/${invitationId}/accept`, { token, method: 'PATCH' });
  return result?.data || result;
};

export const rejectInvitation = async (token, invitationId) => {
  const result = await apiRequest(`/team-invitations/${invitationId}/reject`, { token, method: 'PATCH' });
  return result?.data || result;
};
