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

/**
 * Fetch every medical rep across all teams in a single flattened list.
 * First tries members embedded in the team objects; falls back to per-team
 * member calls if the list endpoint doesn't embed them.
 * Each returned object has at minimum: userId, fullName, teamName.
 */
export const listAllMedicalReps = async (token) => {
  const teams = await getTeams(token);
  const teamsArr = Array.isArray(teams) ? teams : [];

  // Try extracting members already embedded in team objects
  const embedded = teamsArr.flatMap((t) => {
    const ms = t.members || t.teamMembers || t.medicalReps || [];
    return Array.isArray(ms)
      ? ms.map((m) => ({ ...m, _teamName: t.teamName || t.name || '' }))
      : [];
  });

  const pickUnique = (list) => {
    const seen = new Set();
    return list.filter((m) => {
      const id = m.userId || m._id || m.medicalRepId || m.id;
      if (!id || seen.has(String(id))) return false;
      seen.add(String(id));
      return true;
    });
  };

  if (embedded.length > 0) return pickUnique(embedded);

  // Fallback: one request per team
  const arrays = await Promise.all(
    teamsArr.map((t) =>
      getTeamMembers(token, t._id || t.teamId || t.id)
        .then((ms) =>
          (Array.isArray(ms) ? ms : []).map((m) => ({
            ...m,
            _teamName: t.teamName || t.name || '',
          }))
        )
        .catch(() => [])
    )
  );
  return pickUnique(arrays.flat());
};
