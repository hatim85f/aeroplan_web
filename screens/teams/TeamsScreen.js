import React, { useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AppShell from '../../components/AppShell';
import { colors } from '../../constants/colors';
import { globalHeight, globalWidth } from '../../constants/globalWidth';
import { getMyTeams, deleteTeam } from '../../store/teams/teamsActions';
import { getPendingInvitations } from '../../store/teamInvitations/teamInvitationsActions';
import { getTeamLineName } from '../../store/helpers';

const isManager = (role) => ['admin', 'manager', 'senior_manager'].includes(String(role).toLowerCase());

const TEAM_COLORS = ['#8B5CF6', '#0F6FFF', '#F97316', '#22C55E', '#EF4444', '#F6A900', '#14B8A6'];
const getTeamColor = (idx) => TEAM_COLORS[idx % TEAM_COLORS.length];

function getInitials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return 'TM';
}

function StatusPill({ active }) {
  return (
    <View style={[styles.pill, active ? styles.pillActive : styles.pillInactive]}>
      <Text style={[styles.pillText, active ? styles.pillTextActive : styles.pillTextInactive]}>
        {active ? 'Active' : 'Inactive'}
      </Text>
    </View>
  );
}

function VisibilityTag({ isPublic }) {
  return (
    <View style={[styles.visTag, isPublic ? styles.visPublic : styles.visPrivate]}>
      <Text style={[styles.visTagText, isPublic ? styles.visPublicText : styles.visPrivateText]}>
        {isPublic ? '+ Public' : 'Private'}
      </Text>
    </View>
  );
}

/* ─── Manager View ──────────────────────────────────────────────────────── */
function ManagerView({ teams, loading, error, navigation, token, onRefresh }) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [deletingId, setDeletingId] = useState(null);
  const PAGE_SIZE = 8;

  const filtered = teams.filter((t) => {
    const name = t.teamName || t.name || '';
    return !search || name.toLowerCase().includes(search.toLowerCase());
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleDelete = async (teamId) => {
    if (!window.confirm('Delete this team?')) return;
    setDeletingId(teamId);
    try {
      await deleteTeam(token, teamId);
      onRefresh();
    } catch (e) {
      alert(e.message || 'Failed to delete');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <View>
      {/* Header */}
      <View style={styles.pageHeader}>
        <View>
          <Text style={styles.pageTitle}>Teams</Text>
          <Text style={styles.pageSubtitle}>Manage and oversee all teams across your organization.</Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable style={styles.btnPrimary} onPress={() => navigation.navigate('CreateTeam')}>
            <Ionicons name="add" size={16} color={colors.white} />
            <Text style={styles.btnPrimaryText}>Create Team</Text>
          </Pressable>
          <Pressable style={styles.btnOutline}>
            <Ionicons name="download-outline" size={14} color={colors.primary} />
            <Text style={styles.btnOutlineText}>Export</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.tableCard}>
        {/* Toolbar */}
        <View style={styles.toolbar}>
          <View style={styles.searchWrap}>
            <Ionicons name="search" size={14} color={colors.textSecondary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search teams..."
              placeholderTextColor={colors.textSecondary}
              value={search}
              onChangeText={(t) => { setSearch(t); setPage(1); }}
            />
          </View>
          <Pressable style={styles.btnOutline}>
            <Ionicons name="layers-outline" size={13} color={colors.primary} />
            <Text style={styles.btnOutlineText}>Line</Text>
            <Ionicons name="chevron-down" size={12} color={colors.textSecondary} />
          </Pressable>
          <Pressable style={styles.btnOutline}>
            <Ionicons name="checkmark-circle-outline" size={13} color={colors.primary} />
            <Text style={styles.btnOutlineText}>Status</Text>
            <Ionicons name="chevron-down" size={12} color={colors.textSecondary} />
          </Pressable>
          <Pressable style={styles.btnOutline}>
            <Ionicons name="eye-outline" size={13} color={colors.primary} />
            <Text style={styles.btnOutlineText}>Visibility</Text>
            <Ionicons name="chevron-down" size={12} color={colors.textSecondary} />
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.loadingText}>Loading teams...</Text>
          </View>
        ) : error ? (
          <View style={styles.centered}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.retryBtn} onPress={onRefresh}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.tableHead}>
              <Text style={[styles.th, { flex: 2 }]}>Team</Text>
              <Text style={[styles.th, { flex: 2 }]}>Description</Text>
              <Text style={[styles.th, { flex: 1.5 }]}>Line</Text>
              <Text style={[styles.th, { flex: 1 }]}>Members</Text>
              <Text style={[styles.th, { flex: 1 }]}>Status</Text>
              <Text style={[styles.th, { flex: 1 }]}>Visibility</Text>
              <Text style={[styles.th, { flex: 1 }]}>Actions</Text>
            </View>

            {paged.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={32} color={colors.textMuted} />
                <Text style={styles.emptyText}>No teams yet.</Text>
              </View>
            ) : (
              paged.map((team, idx) => {
                const id = team._id || team.id || team.teamId;
                const name = team.teamName || team.name || 'Unnamed Team';
                const desc = team.description || '—';
                const lineName = getTeamLineName(team) || '—';
                const members = team.numberOfMembers || team.members?.length || team.memberCount || 0;
                const active = team.isActive !== false && team.status !== 'inactive';
                const isPublic = team.visibility === 'organization' || team.visibility === 'public' || team.isPublic === true;
                const color = getTeamColor((page - 1) * PAGE_SIZE + idx);

                const logo = team.teamLogo || team.logo;
                return (
                  <Pressable
                    key={id || idx}
                    style={styles.tableRow}
                    onPress={() => navigation.navigate('TeamDetail', { teamId: id })}
                  >
                    <View style={[styles.td, { flex: 2, flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
                      {logo ? (
                        <Image source={{ uri: logo }} style={styles.logoImg} resizeMode="cover" />
                      ) : (
                        <View style={[styles.initCircle, { backgroundColor: color }]}>
                          <Text style={styles.initText}>{getInitials(name)}</Text>
                        </View>
                      )}
                      <Text style={styles.cellPrimary} numberOfLines={1}>{name}</Text>
                    </View>
                    <View style={[styles.td, { flex: 2 }]}>
                      <Text style={styles.cellSecondary} numberOfLines={2}>{desc}</Text>
                    </View>
                    <View style={[styles.td, { flex: 1.5 }]}>
                      <Text style={styles.cellSecondary} numberOfLines={1}>{lineName}</Text>
                    </View>
                    <View style={[styles.td, { flex: 1 }]}>
                      <Text style={styles.cellSecondary}>{members}</Text>
                    </View>
                    <View style={[styles.td, { flex: 1 }]}>
                      <StatusPill active={active} />
                    </View>
                    <View style={[styles.td, { flex: 1 }]}>
                      <VisibilityTag isPublic={isPublic} />
                    </View>
                    <View style={[styles.td, { flex: 1, flexDirection: 'row', gap: 8 }]}>
                      <Pressable
                        onPress={(e) => { e.stopPropagation(); navigation.navigate('CreateTeam', { teamId: id }); }}
                        style={styles.actionIcon}
                      >
                        <Ionicons name="pencil-outline" size={15} color={colors.primary} />
                      </Pressable>
                      <Pressable
                        onPress={(e) => { e.stopPropagation(); handleDelete(id); }}
                        style={styles.actionIcon}
                        disabled={deletingId === id}
                      >
                        {deletingId === id
                          ? <ActivityIndicator size={14} color={colors.danger} />
                          : <Ionicons name="trash-outline" size={15} color={colors.danger} />}
                      </Pressable>
                    </View>
                  </Pressable>
                );
              })
            )}

            {filtered.length > 0 && (
              <View style={styles.pagination}>
                <Text style={styles.paginationInfo}>
                  Showing {Math.min((page - 1) * PAGE_SIZE + 1, filtered.length)} to{' '}
                  {Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} teams
                </Text>
                <View style={styles.pageButtons}>
                  <Pressable
                    style={[styles.pageBtn, page === 1 && styles.pageBtnDisabled]}
                    onPress={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    <Ionicons name="chevron-back" size={14} color={page === 1 ? colors.textMuted : colors.textPrimary} />
                  </Pressable>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1).map((p) => (
                    <Pressable
                      key={p}
                      style={[styles.pageNum, page === p && styles.pageNumActive]}
                      onPress={() => setPage(p)}
                    >
                      <Text style={[styles.pageNumText, page === p && styles.pageNumTextActive]}>{p}</Text>
                    </Pressable>
                  ))}
                  <Pressable
                    style={[styles.pageBtn, page === totalPages && styles.pageBtnDisabled]}
                    onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    <Ionicons name="chevron-forward" size={14} color={page === totalPages ? colors.textMuted : colors.textPrimary} />
                  </Pressable>
                </View>
              </View>
            )}
          </>
        )}
      </View>
    </View>
  );
}

/* ─── Rep View (auto-redirect or empty) ─────────────────────────────────── */
function RepView({ navigation, token }) {
  const [loading, setLoading] = useState(true);
  const [empty, setEmpty] = useState(false);

  useEffect(() => {
    getMyTeams(token)
      .then((teams) => {
        const list = Array.isArray(teams) ? teams : [];
        if (list.length > 0) {
          const id = list[0]._id || list[0].id || list[0].teamId;
          navigation.replace('TeamDetail', { teamId: id });
        } else {
          setEmpty(true);
        }
      })
      .catch(() => setEmpty(true))
      .finally(() => setLoading(false));
  }, [token, navigation]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={styles.loadingText}>Loading your team...</Text>
      </View>
    );
  }

  if (empty) {
    return (
      <View>
        <View style={styles.pageHeader}>
          <View>
            <Text style={styles.pageTitle}>Teams</Text>
            <Text style={styles.pageSubtitle}>Your team information</Text>
          </View>
        </View>
        <View style={styles.emptyCard}>
          <Ionicons name="people-outline" size={40} color={colors.textMuted} />
          <Text style={styles.emptyCardTitle}>Not Assigned to a Team</Text>
          <Text style={styles.emptyCardSub}>You are not assigned to a team yet.</Text>
          <Pressable style={styles.btnOutline} onPress={() => navigation.navigate('TeamInvitations')}>
            <Text style={styles.btnOutlineText}>Check Invitations</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return null;
}

/* ─── Main Screen ───────────────────────────────────────────────────────── */
export default function TeamsScreen({ navigation, userDetails, appMetadata, onSignOut }) {
  const user = userDetails?.user || userDetails?.data?.user || userDetails || {};
  const token = userDetails?.token || userDetails?.data?.token || '';
  const role = user.role || '';
  const manager = isManager(role);

  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(manager);
  const [error, setError] = useState('');
  const [pendingCount, setPendingCount] = useState(0);

  const fetchTeams = useCallback(async () => {
    if (!manager) return;
    setLoading(true);
    setError('');
    try {
      const data = await getMyTeams(token);
      setTeams(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message || 'Failed to load teams');
    } finally {
      setLoading(false);
    }
  }, [token, manager]);

  const fetchPending = useCallback(async () => {
    try {
      const data = await getPendingInvitations(token);
      setPendingCount(Array.isArray(data) ? data.length : 0);
    } catch { /* silent */ }
  }, [token]);

  useEffect(() => {
    fetchTeams();
    fetchPending();
  }, [fetchTeams, fetchPending]);

  return (
    <AppShell
      navigation={navigation}
      userDetails={userDetails}
      appMetadata={appMetadata}
      onSignOut={onSignOut}
      activeRoute="Teams"
      pendingCount={pendingCount}
    >
      {manager
        ? <ManagerView
            teams={teams}
            loading={loading}
            error={error}
            navigation={navigation}
            token={token}
            onRefresh={fetchTeams}
          />
        : <RepView navigation={navigation} token={token} />}
    </AppShell>
  );
}

/* ─── Styles ────────────────────────────────────────────────────────────── */
const shadow = { shadowColor: '#11224A', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 14, elevation: 3 };

const styles = StyleSheet.create({
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: globalHeight('1.8%'),
    flexWrap: 'wrap',
    gap: 10,
  },
  pageTitle: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  pageSubtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  headerActions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },

  tableCard: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    backgroundColor: colors.surface, overflow: 'hidden', ...shadow,
  },
  toolbar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border, flexWrap: 'wrap',
  },
  searchWrap: {
    flex: 1, minWidth: 180, flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    paddingHorizontal: 10, height: 36,
  },
  searchInput: { flex: 1, fontSize: 13, color: colors.textPrimary, outlineStyle: 'none' },

  tableHead: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.backgroundColor,
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  th: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  tableRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  td: { justifyContent: 'center', paddingRight: 8 },
  cellPrimary: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  cellSecondary: { fontSize: 12, color: colors.textSecondary },

  initCircle: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  initText: { color: colors.white, fontSize: 11, fontWeight: '800' },
  logoImg: { width: 32, height: 32, borderRadius: 16, flexShrink: 0 },

  pill: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  pillActive: { backgroundColor: '#E7F8EF' },
  pillInactive: { backgroundColor: '#FFF4EE' },
  pillText: { fontSize: 11, fontWeight: '700' },
  pillTextActive: { color: colors.success },
  pillTextInactive: { color: '#F97316' },

  visTag: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  visPublic: { backgroundColor: '#DBEAFF' },
  visPrivate: { backgroundColor: colors.backgroundColor },
  visTagText: { fontSize: 11, fontWeight: '700' },
  visPublicText: { color: colors.primary },
  visPrivateText: { color: colors.textSecondary },

  actionIcon: {
    width: 28, height: 28, borderRadius: 6, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.backgroundColor,
  },

  centered: { alignItems: 'center', padding: 32, gap: 12 },
  loadingText: { color: colors.textSecondary, fontSize: 13 },
  errorText: { color: colors.danger, fontSize: 13 },
  retryBtn: { borderWidth: 1, borderColor: colors.primary, borderRadius: 6, paddingHorizontal: 14, paddingVertical: 7 },
  retryText: { color: colors.primary, fontSize: 13, fontWeight: '700' },

  emptyState: { alignItems: 'center', padding: 32, gap: 8 },
  emptyText: { fontSize: 14, color: colors.textSecondary },

  pagination: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 12, borderTopWidth: 1, borderTopColor: colors.border,
  },
  paginationInfo: { fontSize: 12, color: colors.textSecondary },
  pageButtons: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pageBtn: {
    width: 28, height: 28, borderRadius: 6, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  pageBtnDisabled: { opacity: 0.4 },
  pageNum: { width: 28, height: 28, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  pageNumActive: { backgroundColor: colors.primary },
  pageNumText: { fontSize: 12, color: colors.textSecondary },
  pageNumTextActive: { color: colors.white, fontWeight: '700' },

  btnPrimary: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 8,
  },
  btnPrimaryText: { color: colors.white, fontSize: 13, fontWeight: '700' },
  btnOutline: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: colors.primary, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8,
  },
  btnOutlineText: { color: colors.primary, fontSize: 13, fontWeight: '700' },

  emptyCard: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    backgroundColor: colors.surface, padding: 40, alignItems: 'center', gap: 12, ...shadow,
  },
  emptyCardTitle: { fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  emptyCardSub: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', maxWidth: 400 },
});
