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

const pickUnique = (list) => {
  const seen = new Set();
  return list.filter((m) => {
    const id = m.userId || m._id || m.medicalRepId || m.id;
    if (!id || seen.has(String(id))) return false;
    seen.add(String(id));
    return true;
  });
};

const chunk = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

/**
 * Fetch every medical rep across all teams in a single flattened list.
 * Uses getMyTeams which returns members embedded — no extra per-team requests.
 * Falls back to batched per-team calls (5 at a time) if members aren't embedded.
 */
export const listAllMedicalReps = async (token) => {
  /* getMyTeams embeds members[] on each team — avoids N extra round-trips */
  const teams = await getMyTeams(token);
  const teamsArr = Array.isArray(teams) ? teams : [];

  const embedded = teamsArr.flatMap((t) => {
    const ms = t.members || t.teamMembers || t.medicalReps || [];
    return Array.isArray(ms)
      ? ms.map((m) => ({ ...m, _teamName: t.teamName || t.name || '' }))
      : [];
  });

  if (embedded.length > 0) return pickUnique(embedded);

  /* Fallback: fetch members in batches of 5 teams to avoid server overload */
  const batches = chunk(teamsArr, 5);
  const all = [];
  for (const batch of batches) {
    const results = await Promise.all(
      batch.map((t) =>
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
    all.push(...results.flat());
  }
  return pickUnique(all);
};
