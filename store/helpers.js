export const canManageStructure = (user) => {
  const role = String(user?.role || '').toLowerCase();
  return ['admin', 'manager', 'senior_manager'].includes(role);
};

export const asList = (result, keys = []) => {
  if (Array.isArray(result)) return result;
  if (!result) return [];
  for (const key of [...keys, 'data', 'items', 'results', 'list']) {
    if (Array.isArray(result[key])) return result[key];
  }
  return [];
};

export const getTeamId = (team) => team?._id || team?.id || team?.teamId || '';
export const getLineId = (line) => line?.lineId || line?.id || line?._id || '';
export const getTeamName = (team) => team?.teamName || team?.name || '';
export const getLineName = (line) => line?.lineName || line?.name || '';

export const getMemberCount = (team) => {
  if (typeof team?.members?.length === 'number') return team.members.length;
  return team?.numberOfMembers ?? team?.memberCount ?? team?.membersCount ?? 0;
};

export const getTeamLineName = (team) => {
  if (team?.lineNames?.length) return team.lineNames.join(', ');
  if (team?.lines?.length) {
    const names = team.lines.map((l) => getLineName(l)).filter(Boolean);
    if (names.length) return names.join(', ');
  }
  return getLineName(team?.line) || team?.lineName || '—';
};
