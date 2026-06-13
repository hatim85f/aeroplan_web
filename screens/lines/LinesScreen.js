import React, { useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AppShell from '../../components/AppShell';
import { colors } from '../../constants/colors';
import { globalHeight, globalWidth } from '../../constants/globalWidth';
import { getLines, deleteLine } from '../../store/lines/linesActions';
import { getPendingInvitations } from '../../store/teamInvitations/teamInvitationsActions';

const isManager = (role) => ['admin', 'manager', 'senior_manager'].includes(String(role).toLowerCase());

const LINE_COLORS = ['#8B5CF6', '#0F6FFF', '#F97316', '#22C55E', '#EF4444', '#F6A900', '#14B8A6'];
const getLineColor = (idx) => LINE_COLORS[idx % LINE_COLORS.length];

function getInitials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return 'LN';
}

/* ─── Status Pill ───────────────────────────────────────────────────────── */
function StatusPill({ active }) {
  return (
    <View style={[styles.pill, active ? styles.pillActive : styles.pillInactive]}>
      <Text style={[styles.pillText, active ? styles.pillTextActive : styles.pillTextInactive]}>
        {active ? 'Active' : 'Inactive'}
      </Text>
    </View>
  );
}

/* ─── Metric Card ───────────────────────────────────────────────────────── */
function MetricCard({ label, value, icon, color, accent }) {
  return (
    <View style={[styles.metricCard, accent && { backgroundColor: accent.bg, borderColor: accent.border }]}>
      <View style={[styles.metricIconBox, accent ? { backgroundColor: accent.chip } : { backgroundColor: color + '22' }]}>
        <Ionicons name={icon} size={18} color={accent ? colors.white : color} />
      </View>
      <Text style={[styles.metricValue, accent && { color: accent.value }]}>{value}</Text>
      <Text style={[styles.metricLabel, accent && { color: accent.label }]}>{label}</Text>
    </View>
  );
}

/* ─── Manager View ──────────────────────────────────────────────────────── */
function ManagerView({ lines, loading, error, navigation, token, onRefresh }) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [deletingId, setDeletingId] = useState(null);
  const PAGE_SIZE = 7;

  const filtered = lines.filter((l) =>
    !search || (l.lineName || l.name || '').toLowerCase().includes(search.toLowerCase())
  );
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const totalTeams = lines.reduce((s, l) => s + (l.teams?.length || l.teamCount || 0), 0);
  const totalMembers = lines.reduce((s, l) => s + (l.numberOfMembers || l.members?.length || l.memberCount || 0), 0);
  const activeLines = lines.filter((l) => l.isActive !== false && l.status !== 'inactive').length;

  const handleDelete = async (lineId) => {
    if (!window.confirm('Delete this line?')) return;
    setDeletingId(lineId);
    try {
      await deleteLine(token, lineId);
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
          <Text style={styles.pageTitle}>Lines</Text>
          <Text style={styles.pageSubtitle}>Manage your product lines and organizational structure.</Text>
        </View>
        <Pressable
          style={styles.btnPrimary}
          onPress={() => navigation.navigate('CreateLine')}
        >
          <Ionicons name="add" size={16} color={colors.white} />
          <Text style={styles.btnPrimaryText}>Add Line</Text>
        </Pressable>
      </View>

      {/* Metrics */}
      <View style={styles.metricsRow}>
        <MetricCard label="Total Lines" value={lines.length} icon="layers-outline" color={colors.primary} accent={colors.accents.blue} />
        <MetricCard label="Total Teams" value={totalTeams} icon="people-outline" color="#8B5CF6" accent={colors.accents.teal} />
        <MetricCard label="Total Members" value={totalMembers} icon="person-outline" color={colors.success} accent={colors.accents.rose} />
        <MetricCard label="Active Lines" value={activeLines} icon="checkmark-circle-outline" color={colors.warning} accent={colors.accents.amber} />
      </View>

      {/* Table Card */}
      <View style={styles.tableCard}>
        {/* Toolbar */}
        <View style={styles.toolbar}>
          <View style={styles.searchWrap}>
            <Ionicons name="search" size={14} color={colors.textSecondary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search lines..."
              placeholderTextColor={colors.textSecondary}
              value={search}
              onChangeText={(t) => { setSearch(t); setPage(1); }}
            />
          </View>
          <Pressable style={styles.btnOutline}>
            <Ionicons name="filter" size={13} color={colors.primary} />
            <Text style={styles.btnOutlineText}>Filters</Text>
          </Pressable>
          <Pressable style={styles.btnOutline}>
            <Ionicons name="swap-vertical" size={13} color={colors.primary} />
            <Text style={styles.btnOutlineText}>Sort By</Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.loadingText}>Loading lines...</Text>
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
            {/* Table header */}
            <View style={styles.tableHead}>
              <Text style={[styles.th, { flex: 2 }]}>Line</Text>
              <Text style={[styles.th, { flex: 2 }]}>Description</Text>
              <Text style={[styles.th, { flex: 1 }]}>Teams</Text>
              <Text style={[styles.th, { flex: 1 }]}>Members</Text>
              <Text style={[styles.th, { flex: 1 }]}>Status</Text>
              <Text style={[styles.th, { flex: 1 }]}>Actions</Text>
            </View>

            {paged.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="layers-outline" size={32} color={colors.textMuted} />
                <Text style={styles.emptyText}>No lines yet.</Text>
              </View>
            ) : (
              paged.map((line, idx) => {
                const id = line.lineId || line._id || line.id;
                const name = line.lineName || line.name || 'Unnamed Line';
                const desc = line.description || '—';
                const teamCount = line.teams?.length || line.teamCount || 0;
                const memberCount = line.numberOfMembers || line.members?.length || line.memberCount || 0;
                const active = line.isActive !== false && line.status !== 'inactive';
                const color = getLineColor((page - 1) * PAGE_SIZE + idx);

                const logo = line.lineLogo || line.logo;
                return (
                  <Pressable
                    key={id || idx}
                    style={styles.tableRow}
                    onPress={() => navigation.navigate('LineDetail', { lineId: id })}
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
                    <View style={[styles.td, { flex: 1 }]}>
                      <Text style={styles.cellSecondary}>{teamCount}</Text>
                    </View>
                    <View style={[styles.td, { flex: 1 }]}>
                      <Text style={styles.cellSecondary}>{memberCount}</Text>
                    </View>
                    <View style={[styles.td, { flex: 1 }]}>
                      <StatusPill active={active} />
                    </View>
                    <View style={[styles.td, { flex: 1, flexDirection: 'row', gap: 8 }]}>
                      <Pressable
                        onPress={(e) => { e.stopPropagation(); navigation.navigate('CreateLine', { lineId: id }); }}
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

            {/* Pagination */}
            {filtered.length > 0 && (
              <View style={styles.pagination}>
                <Text style={styles.paginationInfo}>
                  Showing {Math.min((page - 1) * PAGE_SIZE + 1, filtered.length)} to{' '}
                  {Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} lines
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

/* ─── Rep View ──────────────────────────────────────────────────────────── */
function RepView({ user, navigation }) {
  const lineId = user?.lineId || user?.line?._id || user?.line?.id;
  const lineName = user?.line?.lineName || user?.line?.name || user?.lineName;

  if (!lineId) {
    return (
      <View>
        <View style={styles.pageHeader}>
          <View>
            <Text style={styles.pageTitle}>My Line</Text>
            <Text style={styles.pageSubtitle}>Your assigned product line</Text>
          </View>
        </View>
        <View style={styles.emptyCard}>
          <Ionicons name="layers-outline" size={40} color={colors.textMuted} />
          <Text style={styles.emptyCardTitle}>Not Assigned to a Line</Text>
          <Text style={styles.emptyCardSub}>
            You are not assigned to a line yet. Please wait for a manager to send you an invitation.
          </Text>
          <Pressable
            style={styles.btnOutline}
            onPress={() => navigation.navigate('TeamInvitations')}
          >
            <Text style={styles.btnOutlineText}>Check Invitations</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View>
      <View style={styles.pageHeader}>
        <View>
          <Text style={styles.pageTitle}>My Line</Text>
          <Text style={styles.pageSubtitle}>Your assigned product line</Text>
        </View>
      </View>
      <Pressable
        style={styles.lineCard}
        onPress={() => navigation.navigate('LineDetail', { lineId })}
      >
        {user?.line?.lineLogo || user?.line?.logo ? (
          <Image
            source={{ uri: user.line.lineLogo || user.line.logo }}
            style={{ width: 44, height: 44, borderRadius: 22 }}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.initCircle, { backgroundColor: colors.primary, width: 44, height: 44, borderRadius: 22 }]}>
            <Text style={[styles.initText, { fontSize: 16 }]}>{getInitials(lineName || '')}</Text>
          </View>
        )}
        <View style={styles.lineCardInfo}>
          <Text style={styles.lineCardName}>{lineName || 'My Line'}</Text>
          <Text style={styles.lineCardId}>Line ID: {lineId}</Text>
        </View>
        <StatusPill active />
        <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
      </Pressable>
    </View>
  );
}

/* ─── Main Screen ───────────────────────────────────────────────────────── */
export default function LinesScreen({ navigation, userDetails, appMetadata, onSignOut }) {
  const user = userDetails?.user || userDetails?.data?.user || userDetails || {};
  const token = userDetails?.token || userDetails?.data?.token || '';
  const role = user.role || '';
  const manager = isManager(role);

  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(manager);
  const [error, setError] = useState('');
  const [pendingCount, setPendingCount] = useState(0);

  const fetchLines = useCallback(async () => {
    if (!manager) return;
    setLoading(true);
    setError('');
    try {
      const data = await getLines(token);
      setLines(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message || 'Failed to load lines');
    } finally {
      setLoading(false);
    }
  }, [token, manager]);

  const fetchPending = useCallback(async () => {
    try {
      const data = await getPendingInvitations(token);
      setPendingCount(Array.isArray(data) ? data.length : 0);
    } catch {
      // silent
    }
  }, [token]);

  useEffect(() => {
    fetchLines();
    fetchPending();
  }, [fetchLines, fetchPending]);

  return (
    <AppShell
      navigation={navigation}
      userDetails={userDetails}
      appMetadata={appMetadata}
      onSignOut={onSignOut}
      activeRoute="Lines"
      pendingCount={pendingCount}
    >
      {manager
        ? <ManagerView
            lines={lines}
            loading={loading}
            error={error}
            navigation={navigation}
            token={token}
            onRefresh={fetchLines}
          />
        : <RepView user={user} navigation={navigation} />}
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
  },
  pageTitle: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  pageSubtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },

  metricsRow: {
    flexDirection: 'row',
    gap: globalWidth('0.8%'),
    marginBottom: globalHeight('1.5%'),
    flexWrap: 'wrap',
  },
  metricCard: {
    flex: 1,
    minWidth: globalWidth('12%'),
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
    padding: globalWidth('0.9%'),
    ...shadow,
    gap: 4,
  },
  metricIconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  metricValue: { fontSize: 22, fontWeight: '800', color: colors.textPrimary },
  metricLabel: { fontSize: 12, color: colors.textSecondary },

  tableCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    ...shadow,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchWrap: {
    flex: 1,
    maxWidth: 280,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 36,
    backgroundColor: colors.surface,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: colors.textPrimary,
    outlineStyle: 'none',
  },

  tableHead: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundColor,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  th: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },

  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  td: { justifyContent: 'center', paddingRight: 8 },
  cellPrimary: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  cellSecondary: { fontSize: 12, color: colors.textSecondary },

  initCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  initText: { color: colors.white, fontSize: 11, fontWeight: '800' },
  logoImg: { width: 32, height: 32, borderRadius: 16, flexShrink: 0 },

  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  pillActive: { backgroundColor: '#E7F8EF' },
  pillInactive: { backgroundColor: '#FFF4EE' },
  pillText: { fontSize: 11, fontWeight: '700' },
  pillTextActive: { color: colors.success },
  pillTextInactive: { color: '#F97316' },

  actionIcon: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.backgroundColor,
  },

  centered: { alignItems: 'center', padding: 32, gap: 12 },
  loadingText: { color: colors.textSecondary, fontSize: 13 },
  errorText: { color: colors.danger, fontSize: 13, textAlign: 'center' },
  retryBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  retryText: { color: colors.primary, fontSize: 13, fontWeight: '700' },

  emptyState: { alignItems: 'center', padding: 32, gap: 8 },
  emptyText: { fontSize: 14, color: colors.textSecondary },

  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  paginationInfo: { fontSize: 12, color: colors.textSecondary },
  pageButtons: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pageBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageBtnDisabled: { opacity: 0.4 },
  pageNum: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageNumActive: { backgroundColor: colors.primary },
  pageNumText: { fontSize: 12, color: colors.textSecondary },
  pageNumTextActive: { color: colors.white, fontWeight: '700' },

  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
  },
  btnPrimaryText: { color: colors.white, fontSize: 13, fontWeight: '700' },
  btnOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  btnOutlineText: { color: colors.primary, fontSize: 13, fontWeight: '700' },

  emptyCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
    padding: 40,
    alignItems: 'center',
    gap: 12,
    ...shadow,
  },
  emptyCardTitle: { fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  emptyCardSub: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', maxWidth: 400 },

  lineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
    padding: 16,
    ...shadow,
  },
  lineCardInfo: { flex: 1 },
  lineCardName: { fontSize: 15, fontWeight: '800', color: colors.textPrimary },
  lineCardId: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
});
