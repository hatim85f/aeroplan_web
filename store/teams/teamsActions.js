import { apiRequest } from '../apiClient';

export const getTeams = async (token) => {
  const result = await apiRequest('/teams', { token });
  return result?.data || result?.teams || result || [];
};

export const getMyTeams = async (token) => {
  const result = await apiRequest('/teams/my-teams', { token });
  return result?.data || result?.teams || result || [];
};

export const getTeamById = async (token, teamId) => {
  const result = await apiRequest(`/teams/${teamId}`, { token });
  return (
    result?.data?.team ||
    result?.data?.teamDetails ||
    result?.data?.teamInfo ||
    result?.team ||
    result?.data ||
    result
  );
};

export const getTeamMembers = async (token, teamId) => {
  const result = await apiRequest(`/teams/${teamId}/members`, { token });
  return result?.data || result?.members || result || [];
};

export const createTeam = async (token, body) => {
  const result = await apiRequest('/teams', { token, method: 'POST', body });
  return result?.data || result?.team || result;
};

export const updateTeam = async (token, teamId, body) => {
  const result = await apiRequest(`/teams/${teamId}`, { token, method: 'PATCH', body });
  return result?.data || result?.team || result;
};

export const deleteTeam = async (token, teamId) => {
  const result = await apiRequest(`/teams/${teamId}`, { token, method: 'DELETE' });
  return result;
};

export const removeTeamMember = async (token, teamId, userId) => {
  const result = await apiRequest(`/teams/${teamId}/members/${userId}`, { token, method: 'DELETE' });
  return result;
};

export const getTeamDashboard = async (token) => {
  const result = await apiRequest('/teams/dashboard', { token });
  return result?.data || result;
};

export const getTeamTargets = async (token, teamId) => {
  const result = await apiRequest(`/teams/${teamId}/targets`, { token });
  return result?.data || result?.targets || result || [];
};

export const getTeamReports = async (token, teamId) => {
  const result = await apiRequest(`/teams/${teamId}/reports`, { token });
  return result?.data || result?.reports || result || [];
};

export const getTeamHierarchy = async (token, teamId) => {
  const result = await apiRequest(`/teams/${teamId}/hierarchy`, { token });
  return result?.data?.hierarchy || result?.hierarchy || result?.data || result;
};

export const getTeamPermissions = async (token, teamId) => {
  const result = await apiRequest(`/teams/${teamId}/permissions`, { token });
  return result?.data || result?.permissions || result || [];
};
