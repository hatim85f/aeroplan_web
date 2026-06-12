import { apiRequest } from '../apiClient';

export const getLines = async (token) => {
  const result = await apiRequest('/lines', { token });
  // Handle: { data: [...] }, { lines: [...] }, or bare array
  const raw = result?.data || result?.lines || result;
  return Array.isArray(raw) ? raw : [];
};

export const getLineById = async (token, lineId) => {
  const result = await apiRequest(`/lines/${lineId}`, { token });
  return (
    result?.data?.line ||
    result?.data?.lineDetails ||
    result?.line ||
    result?.data ||
    result
  );
};

export const createLine = async (token, body) => {
  const result = await apiRequest('/lines', { token, method: 'POST', body });
  return result?.data || result?.line || result;
};

export const updateLine = async (token, lineId, body) => {
  const result = await apiRequest(`/lines/${lineId}`, { token, method: 'PATCH', body });
  return result?.data || result?.line || result;
};

export const deleteLine = async (token, lineId) => {
  const result = await apiRequest(`/lines/${lineId}`, { token, method: 'DELETE' });
  return result;
};

export const removeLineMember = async (token, lineId, userId) => {
  const result = await apiRequest(`/lines/${lineId}/members/${userId}`, { token, method: 'DELETE' });
  return result;
};

export const inviteToLine = async (token, body) => {
  const result = await apiRequest('/team-invitations', { token, method: 'POST', body });
  return result?.data || result?.invitation || result;
};
