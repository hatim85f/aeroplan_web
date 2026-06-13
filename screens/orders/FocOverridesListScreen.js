import React, { useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AppShell from '../../components/AppShell';
import { colors } from '../../constants/colors';
import { globalHeight, globalWidth } from '../../constants/globalWidth';
import { listFocOverrides, deleteFocOverrides } from '../../store/focOverrides/focOverrideActions';

const isManager = (role) =>
  ['admin', 'manager', 'senior_manager'].includes(String(role).toLowerCase());

/* ─── Helpers ────────────────────────────────────────────────────────────── */
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getFocStatus(startDate, endDate) {
  const today = new Date();
  const s = new Date(startDate);
  const e = new Date(endDate);
  if (today < s) return { label: 'Upcoming', bg: '#EFF6FF', text: '#1D4ED8' };
  if (today > e) return { label: 'Expired',  bg: '#FEF2F2', text: '#DC2626' };
  return                { label: 'Active',   bg: '#ECFDF5', text: '#059669' };
}

/* ─── Sub-components ─────────────────────────────────────────────────────── */
function StatCard({ icon, accent, label, value, sub }) {
  const a = accent || colors.accents.blue;
  return (
    <View style={[styles.statCard, { backgroundColor: a.bg, borderColor: a.border }]}>
      <View style={[styles.statIcon, { backgroundColor: a.chip }]}>
        <Ionicons name={icon} size={20} color={colors.white} />
      </View>
      <View style={styles.statBody}>
        <Text style={[styles.statLabel, { color: a.label }]}>{label}</Text>
        <Text style={[styles.statValue, { color: a.value }]}>{value ?? '—'}</Text>
        {sub ? <Text style={[styles.statSub, { color: a.label }]}>{sub}</Text> : null}
      </View>
    </View>
  );
}

function StatusPill({ startDate, endDate }) {
  const s = getFocStatus(startDate, endDate);
  return (
    <View style={[styles.statusPill, { backgroundColor: s.bg }]}>
      <Text style={[styles.statusPillText, { color: s.text }]}>{s.label}</Text>
    </View>
  );
}

/* ─── Main Screen ────────────────────────────────────────────────────────── */
export default function FocOverridesListScreen({
  navigation, userDetails, appMetadata, onSignOut,
}) {
  const user  = userDetails?.user || userDetails?.data?.user || userDetails || {};
  const token = userDetails?.token || userDetails?.data?.token || '';
  const role  = user.role || '';
  const managerRole = isManager(role);

  const [overrides,   setOverrides]   = useState([]);
  const [pagination,  setPagination]  = useState({ page: 1, limit: 20, total: 0, pages: 1 });
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [search,      setSearch]      = useState('');
  const [page,        setPage]        = useState(1);
  const [deleting,    setDeleting]    = useState(null);

  const fetchData = useCallback(async (pg = 1) => {
    setLoading(true);
    setError('');
    try {
      const params = { page: pg, limit: 20, ...(search ? { search } : {}) };
      const res = await listFocOverrides(token, params);
      setOverrides(Array.isArray(res.data) ? res.data : []);
      setPagination(res.pagination || { page: pg, limit: 20, total: 0, pages: 1 });
    } catch (e) {
      setError(e.message || 'Failed to load FOC overrides');
    } finally {
      setLoading(false);
    }
  }, [token, search]);

  useEffect(() => {
    const t = setTimeout(() => { setPage(1); fetchData(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { fetchData(page); }, [page]);

  const handleDelete = async (item) => {
    const accountId = item.accountId?._id || item.accountId;
    if (!accountId) return;
    const name = item.accountId?.accountName || 'this account';
    if (!window.confirm(`Delete all FOC overrides for "${name}"? This cannot be undone.`)) return;
    setDeleting(item._id || item.id);
    try {
      await deleteFocOverrides(token, accountId);
      fetchData(page);
    } catch (e) {
      alert(e.message || 'Failed to delete override');
    } finally {
      setDeleting(null);
    }
  };

  const totalPages = pagination.pages || 1;
  const today = new Date();
  const activeCount = overrides.filter((o) => {
    const s = new Date(o.startDate), e = new Date(o.endDate);
    return today >= s && today <= e;
  }).length;
  const totalProductsCovered = overrides.reduce((sum, o) => sum + (o.overrides?.length || 0), 0);

  return (
    <AppShell
      navigation={navigation}
      userDetails={userDetails}
      appMetadata={appMetadata}
      onSignOut={onSignOut}
      activeRoute="FOC Overrides"
    >
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <View style={styles.pageHeader}>
        <View>
          <Text style={styles.pageTitle}>FOC Overrides</Text>
          <Text style={styles.pageSubtitle}>
            Free-of-charge discount overrides applied per account
          </Text>
        </View>
        {managerRole && (
          <View style={styles.headerActions}>
            <Pressable
              style={styles.btnOutline}
              onPress={() => navigation.navigate('FocLookup')}
            >
              <Ionicons name="search-outline" size={14} color={colors.primary} />
              <Text style={styles.btnOutlineText}>Quick Lookup</Text>
            </Pressable>
            <Pressable
              style={styles.btnPrimary}
              onPress={() => navigation.navigate('FocOverrideForm', { mode: 'create' })}
            >
              <Ionicons name="add" size={16} color={colors.white} />
              <Text style={styles.btnPrimaryText}>Add Override</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* ── Stats ───────────────────────────────────────────────────────── */}
      <View style={styles.statsRow}>
        <StatCard
          icon="document-text-outline" accent={colors.accents.blue}
          label="Total Override Docs" value={pagination.total || overrides.length}
        />
        <StatCard
          icon="checkmark-circle-outline" accent={colors.accents.teal}
          label="Active Now" value={activeCount}
          sub={overrides.length ? `${Math.round(activeCount / overrides.length * 100)}% of listed` : ''}
        />
        <StatCard
          icon="cube-outline" accent={colors.accents.rose}
          label="Products Covered" value={totalProductsCovered}
          sub="Across all overrides"
        />
        <StatCard
          icon="layers-outline" accent={colors.accents.amber}
          label="Pages" value={totalPages}
          sub={`Page ${page} of ${totalPages}`}
        />
      </View>

      {/* ── Table card ──────────────────────────────────────────────────── */}
      <View style={styles.tableCard}>

        {/* Toolbar */}
        <View style={styles.toolbar}>
          <View style={styles.searchWrap}>
            <Ionicons name="search" size={14} color={colors.textSecondary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by account name..."
              placeholderTextColor={colors.textSecondary}
              value={search}
              onChangeText={setSearch}
            />
            {search ? (
              <Pressable onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={15} color={colors.textMuted} />
              </Pressable>
            ) : null}
          </View>
          <Pressable style={styles.refreshBtn} onPress={() => fetchData(page)}>
            <Ionicons name="refresh-outline" size={14} color={colors.primary} />
            <Text style={styles.btnOutlineText}>Refresh</Text>
          </Pressable>
        </View>

        {/* Table head */}
        <View style={styles.tableHead}>
          <Text style={[styles.th, { flex: 2.5 }]}>Account</Text>
          <Text style={[styles.th, { flex: 1.5 }]}>Valid From</Text>
          <Text style={[styles.th, { flex: 1.5 }]}>Valid To</Text>
          <Text style={[styles.th, { flex: 1 }]}>Products</Text>
          <Text style={[styles.th, { flex: 1.2 }]}>Status</Text>
          <Text style={[styles.th, { flex: 1.3 }]}>Actions</Text>
        </View>

        {/* Table body */}
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.loadingText}>Loading FOC overrides...</Text>
          </View>
        ) : error ? (
          <View style={styles.centered}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.retryBtn} onPress={() => fetchData(page)}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : overrides.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={40} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No FOC overrides found</Text>
            <Text style={styles.emptyText}>
              {search
                ? 'Try adjusting your search term.'
                : managerRole
                  ? 'Click "Add Override" to create the first one.'
                  : 'No overrides have been set up yet.'}
            </Text>
          </View>
        ) : (
          overrides.map((item, idx) => {
            const rowId = item._id || item.id;
            const accountId = item.accountId?._id || item.accountId;
            const acctName = item.accountId?.accountName || item.accountId?.name || '—';
            const prodCount = item.overrides?.length || 0;
            const even = idx % 2 === 0;
            const isDeleting = deleting === rowId;

            return (
              <View
                key={rowId}
                style={[styles.tableRow, even && styles.tableRowAlt]}
              >
                {/* Account */}
                <Pressable
                  style={[styles.td, { flex: 2.5 }]}
                  onPress={() => navigation.navigate('FocOverrideDetails', { accountId })}
                >
                  <Text style={styles.tdLink}>{acctName}</Text>
                </Pressable>

                {/* Dates */}
                <Text style={[styles.tdText, { flex: 1.5 }]}>{fmtDate(item.startDate)}</Text>
                <Text style={[styles.tdText, { flex: 1.5 }]}>{fmtDate(item.endDate)}</Text>

                {/* Products count */}
                <View style={[styles.td, { flex: 1 }]}>
                  <View style={styles.countBadge}>
                    <Text style={styles.countBadgeText}>{prodCount}</Text>
                  </View>
                </View>

                {/* Status */}
                <View style={[styles.td, { flex: 1.2 }]}>
                  <StatusPill startDate={item.startDate} endDate={item.endDate} />
                </View>

                {/* Actions */}
                <View style={[styles.td, { flex: 1.3, flexDirection: 'row', gap: 6 }]}>
                  <Pressable
                    style={styles.iconBtn}
                    onPress={() => navigation.navigate('FocOverrideDetails', { accountId })}
                  >
                    <Ionicons name="eye-outline" size={14} color={colors.primary} />
                  </Pressable>
                  {managerRole && (
                    <>
                      <Pressable
                        style={styles.iconBtn}
                        onPress={() =>
                          navigation.navigate('FocOverrideForm', {
                            mode: 'edit',
                            accountId,
                            existingData: item,
                          })
                        }
                      >
                        <Ionicons name="pencil-outline" size={14} color={colors.warning} />
                      </Pressable>
                      <Pressable
                        style={[styles.iconBtn, isDeleting && { opacity: 0.5 }]}
                        onPress={() => handleDelete(item)}
                        disabled={isDeleting}
                      >
                        {isDeleting
                          ? <ActivityIndicator size={12} color={colors.danger} />
                          : <Ionicons name="trash-outline" size={14} color={colors.danger} />
                        }
                      </Pressable>
                    </>
                  )}
                </View>
              </View>
            );
          })
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <View style={styles.pagination}>
            <Pressable
              style={[styles.pageBtn, page <= 1 && styles.pageBtnDisabled]}
              onPress={() => page > 1 && setPage(page - 1)}
              disabled={page <= 1}
            >
              <Ionicons name="chevron-back" size={14}
                color={page <= 1 ? colors.textMuted : colors.primary} />
              <Text style={[styles.pageBtnText, page <= 1 && styles.pageBtnTextDisabled]}>
                Prev
              </Text>
            </Pressable>
            <Text style={styles.pageInfo}>Page {page} of {totalPages}</Text>
            <Pressable
              style={[styles.pageBtn, page >= totalPages && styles.pageBtnDisabled]}
              onPress={() => page < totalPages && setPage(page + 1)}
              disabled={page >= totalPages}
            >
              <Text style={[styles.pageBtnText, page >= totalPages && styles.pageBtnTextDisabled]}>
                Next
              </Text>
              <Ionicons name="chevron-forward" size={14}
                color={page >= totalPages ? colors.textMuted : colors.primary} />
            </Pressable>
          </View>
        )}
      </View>
    </AppShell>
  );
}

/* ─── Styles ─────────────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  pageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: globalHeight('2%'),
  },
  pageTitle: {
    fontSize: globalWidth('1.4%'),
    fontWeight: '800',
    color: colors.textPrimary,
  },
  pageSubtitle: {
    fontSize: globalWidth('0.75%'),
    color: colors.textSecondary,
    marginTop: globalHeight('0.4%'),
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: globalWidth('0.7%'),
  },

  /* Stats */
  statsRow: {
    flexDirection: 'row',
    gap: globalWidth('1.2%'),
    marginBottom: globalHeight('2%'),
    flexWrap: 'wrap',
  },
  statCard: {
    flex: 1,
    minWidth: globalWidth('14%'),
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: globalWidth('1%'),
    flexDirection: 'row',
    alignItems: 'center',
    gap: globalWidth('0.8%'),
  },
  statIcon: {
    width: globalWidth('2.6%'),
    height: globalWidth('2.6%'),
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statBody: { flex: 1 },
  statLabel: { fontSize: globalWidth('0.6%'), color: colors.textMuted, fontWeight: '600' },
  statValue: { fontSize: globalWidth('1.1%'), fontWeight: '800', color: colors.textPrimary, marginTop: 2 },
  statSub: { fontSize: globalWidth('0.56%'), color: colors.textSecondary, marginTop: 2 },

  /* Table card */
  tableCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: globalHeight('2%'),
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: globalWidth('0.8%'),
    padding: globalWidth('0.9%'),
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundColor,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: globalWidth('0.6%'),
    height: globalHeight('4.2%'),
    gap: globalWidth('0.4%'),
  },
  searchInput: {
    flex: 1,
    fontSize: globalWidth('0.72%'),
    color: colors.textPrimary,
    outlineStyle: 'none',
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: globalWidth('0.7%'),
    height: globalHeight('4.2%'),
  },

  tableHead: {
    flexDirection: 'row',
    paddingHorizontal: globalWidth('1%'),
    paddingVertical: globalHeight('1%'),
    backgroundColor: colors.backgroundColor,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  th: {
    fontSize: globalWidth('0.62%'),
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  tableRow: {
    flexDirection: 'row',
    paddingHorizontal: globalWidth('1%'),
    paddingVertical: globalHeight('1.2%'),
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tableRowAlt: { backgroundColor: colors.backgroundColor },

  td: { justifyContent: 'center' },
  tdLink: {
    fontSize: globalWidth('0.72%'),
    fontWeight: '700',
    color: colors.primary,
  },
  tdText: {
    fontSize: globalWidth('0.72%'),
    color: colors.textPrimary,
  },
  tdSub: {
    fontSize: globalWidth('0.58%'),
    color: colors.textSecondary,
    marginTop: 2,
  },

  countBadge: {
    backgroundColor: colors.primaryLight,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  countBadgeText: {
    fontSize: globalWidth('0.65%'),
    fontWeight: '700',
    color: colors.primary,
  },

  statusPill: {
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  statusPillText: {
    fontSize: globalWidth('0.62%'),
    fontWeight: '700',
  },

  iconBtn: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Buttons */
  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: globalWidth('1%'),
    height: globalHeight('4.4%'),
  },
  btnPrimaryText: {
    color: colors.white,
    fontSize: globalWidth('0.72%'),
    fontWeight: '700',
  },
  btnOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: globalWidth('1%'),
    height: globalHeight('4.4%'),
  },
  btnOutlineText: {
    color: colors.primary,
    fontSize: globalWidth('0.72%'),
    fontWeight: '700',
  },

  /* States */
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: globalHeight('4%'),
    gap: 8,
  },
  loadingText: { fontSize: globalWidth('0.72%'), color: colors.textSecondary },
  errorText: { fontSize: globalWidth('0.72%'), color: colors.danger },
  retryBtn: {
    backgroundColor: colors.primaryLight,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  retryText: { color: colors.primary, fontWeight: '700', fontSize: globalWidth('0.72%') },

  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: globalHeight('5%'),
    gap: 8,
  },
  emptyTitle: {
    fontSize: globalWidth('0.85%'),
    fontWeight: '700',
    color: colors.textPrimary,
  },
  emptyText: {
    fontSize: globalWidth('0.72%'),
    color: colors.textSecondary,
    textAlign: 'center',
    maxWidth: globalWidth('30%'),
  },

  /* Pagination */
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: globalWidth('0.9%'),
    gap: globalWidth('0.8%'),
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  pageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: globalWidth('0.7%'),
    paddingVertical: globalHeight('0.6%'),
  },
  pageBtnDisabled: { opacity: 0.4 },
  pageBtnText: { fontSize: globalWidth('0.68%'), color: colors.primary, fontWeight: '700' },
  pageBtnTextDisabled: { color: colors.textMuted },
  pageInfo: { fontSize: globalWidth('0.68%'), color: colors.textSecondary, fontWeight: '600' },
});
