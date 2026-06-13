import React, { useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AppShell from '../../components/AppShell';
import { colors } from '../../constants/colors';
import { globalHeight, globalWidth } from '../../constants/globalWidth';
import { getAccounts, getMyVisitAccounts, bulkAssignRep } from '../../store/accounts/accountActions';

const isManager = (role) =>
  ['admin', 'manager', 'senior_manager'].includes(String(role).toLowerCase());

const ACCOUNT_TYPE_COLORS = {
  Healthcare: { bg: '#E8F5E9', text: '#2E7D32' },
  Pharmacy:   { bg: '#E3F2FD', text: '#1565C0' },
  Hospital:   { bg: '#FFF3E0', text: '#E65100' },
  Clinic:     { bg: '#F3E5F5', text: '#6A1B9A' },
};

function TypePill({ type }) {
  const t = type || 'Clinic';
  const c = ACCOUNT_TYPE_COLORS[t] || { bg: colors.backgroundColor, text: colors.textSecondary };
  return (
    <View style={[styles.typePill, { backgroundColor: c.bg }]}>
      <Text style={[styles.typePillText, { color: c.text }]}>{t}</Text>
    </View>
  );
}

function StatusPill({ active }) {
  return (
    <View style={[styles.statusPill, active ? styles.pillActive : styles.pillInactive]}>
      <Text style={[styles.statusPillText, active ? styles.pillTextActive : styles.pillTextInactive]}>
        {active ? 'Active' : 'Inactive'}
      </Text>
    </View>
  );
}

function StatCard({ icon, accent, label, value, sub }) {
  const a = accent || colors.accents.blue;
  return (
    <View style={[styles.statCard, { backgroundColor: a.bg, borderColor: a.border }]}>
      <View style={[styles.statIcon, { backgroundColor: a.chip }]}>
        <Ionicons name={icon} size={20} color={colors.white} />
      </View>
      <View style={styles.statBody}>
        <Text style={[styles.statLabel, { color: a.label }]}>{label}</Text>
        <Text style={[styles.statValue, { color: a.value }]}>{value}</Text>
        {sub ? <Text style={[styles.statSub, { color: a.label }]}>{sub}</Text> : null}
      </View>
    </View>
  );
}

/* ─── Main Screen ───────────────────────────────────────────────────────── */
export default function AccountsScreen({ navigation, userDetails, appMetadata, onSignOut }) {
  const user = userDetails?.user || userDetails?.data?.user || userDetails || {};
  const token = userDetails?.token || userDetails?.data?.token || '';
  const role = user.role || '';
  const userId = user._id || user.id || '';
  const managerRole = isManager(role);

  const SEGMENTS = managerRole
    ? ['All Accounts']
    : ['All Accounts', 'My Assigned'];

  const [accounts, setAccounts] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [segment, setSegment] = useState('All Accounts');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState([]);
  const [bulkAssigning, setBulkAssigning] = useState(false);
  const [myAssignedTotal, setMyAssignedTotal] = useState(0);

  // Fetch total assigned-to-me count for the stat card
  useEffect(() => {
    if (managerRole) return;
    getMyVisitAccounts(token, { page: 1, limit: 1 })
      .then((res) => setMyAssignedTotal(res.pagination?.total || 0))
      .catch(() => {});
  }, [token, managerRole]);

  const fetchAccounts = useCallback(async (pg = 1) => {
    setLoading(true);
    setError('');
    try {
      const filters = { page: pg, limit: 20, ...(search ? { search } : {}) };
      const fn = segment === 'My Assigned' ? getMyVisitAccounts : getAccounts;
      const res = await fn(token, filters);
      setAccounts(Array.isArray(res.accounts) ? res.accounts : []);
      setPagination(res.pagination || { page: pg, limit: 20, total: 0, pages: 1 });
    } catch (e) {
      setError(e.message || 'Failed to load accounts');
    } finally {
      setLoading(false);
    }
  }, [token, search, segment]);

  useEffect(() => {
    const t = setTimeout(() => { setPage(1); fetchAccounts(1); }, 300);
    return () => clearTimeout(t);
  }, [search, segment]);

  useEffect(() => { fetchAccounts(page); }, [page]);

  const handlePageChange = (p) => {
    if (p < 1 || p > (pagination.pages || 1)) return;
    setPage(p);
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleBulkAssign = async () => {
    if (!selectedIds.length) return;
    setBulkAssigning(true);
    try {
      await bulkAssignRep(token, selectedIds, userId);
      setSelectedIds([]);
      fetchAccounts(page);
      // Refresh assigned count
      getMyVisitAccounts(token, { page: 1, limit: 1 })
        .then((res) => setMyAssignedTotal(res.pagination?.total || 0))
        .catch(() => {});
    } catch (e) {
      alert(e.message || 'Failed to assign accounts');
    } finally {
      setBulkAssigning(false);
    }
  };

  const totalPages = pagination.pages || Math.ceil((pagination.total || 0) / (pagination.limit || 20)) || 1;

  return (
    <AppShell
      navigation={navigation}
      userDetails={userDetails}
      appMetadata={appMetadata}
      onSignOut={onSignOut}
      activeRoute="Accounts"
    >
      {/* Page header */}
      <View style={styles.pageHeader}>
        <View>
          <Text style={styles.pageTitle}>Accounts</Text>
          <Text style={styles.pageSubtitle}>
            {managerRole
              ? 'Manage all your customer and partner accounts'
              : 'Browse accounts and self-assign to ones you cover'}
          </Text>
        </View>
        {managerRole && (
          <Pressable style={styles.btnPrimary} onPress={() => navigation.navigate('AccountForm', { mode: 'create' })}>
            <Ionicons name="add" size={16} color={colors.white} />
            <Text style={styles.btnPrimaryText}>Add Account</Text>
          </Pressable>
        )}
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <StatCard
          icon="business-outline" accent={colors.accents.blue}
          label="Total Accounts" value={pagination.total || accounts.length}
        />
        {managerRole ? (
          <StatCard
            icon="checkmark-circle-outline" accent={colors.accents.teal}
            label="Active Accounts"
            value={accounts.filter((a) => a.isActive !== false).length}
            sub={pagination.total ? `${Math.round(accounts.filter((a) => a.isActive !== false).length / Math.max(accounts.length, 1) * 100)}% of total` : ''}
          />
        ) : (
          <StatCard
            icon="person-circle-outline" accent={colors.accents.teal}
            label="My Assigned" value={myAssignedTotal}
            sub="Accounts assigned to me"
          />
        )}
        <StatCard
          icon="people-outline" accent={colors.accents.rose}
          label={managerRole ? 'Assigned Reps' : 'Selected'}
          value={managerRole
            ? [...new Set(
                accounts.flatMap((a) => (a.assignedMedicalRepIds || a.assignedReps || []).map((r) =>
                  typeof r === 'string' ? r : (r?._id || r?.userId || r?.id || '')
                ))
              ).values()].filter(Boolean).length
            : selectedIds.length}
          sub={managerRole ? 'Across all accounts' : selectedIds.length > 0 ? 'Ready to assign' : 'Tap + to select accounts'}
        />
        <StatCard
          icon="calendar-outline" accent={colors.accents.amber}
          label="Total Pages" value={totalPages} sub={`Page ${page} of ${totalPages}`}
        />
      </View>

      {/* Table card */}
      <View style={styles.tableCard}>
        {/* Toolbar */}
        <View style={styles.toolbar}>
          <View style={styles.searchWrap}>
            <Ionicons name="search" size={14} color={colors.textSecondary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search accounts by name, city, or rep..."
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
          <Pressable style={styles.btnOutline}>
            <Ionicons name="filter-outline" size={13} color={colors.primary} />
            <Text style={styles.btnOutlineText}>Filters</Text>
          </Pressable>
        </View>

        {/* Segments */}
        <View style={styles.segmentRow}>
          {SEGMENTS.map((seg) => (
            <Pressable
              key={seg}
              style={[styles.segmentTab, segment === seg && styles.segmentTabActive]}
              onPress={() => { setSegment(seg); setPage(1); setSelectedIds([]); }}
            >
              <Text style={[styles.segmentText, segment === seg && styles.segmentTextActive]}>{seg}</Text>
            </Pressable>
          ))}
        </View>

        {/* Rep assign banner */}
        {!managerRole && selectedIds.length > 0 && (
          <View style={styles.assignBanner}>
            <View style={styles.assignBannerLeft}>
              <View style={styles.assignBannerBadge}>
                <Text style={styles.assignBannerBadgeText}>{selectedIds.length}</Text>
              </View>
              <Text style={styles.assignBannerText}>
                {selectedIds.length === 1 ? 'account' : 'accounts'} selected — assign yourself as a rep
              </Text>
            </View>
            <View style={styles.assignBannerActions}>
              <Pressable style={styles.assignBannerCancel} onPress={() => setSelectedIds([])}>
                <Text style={styles.assignBannerCancelText}>Clear</Text>
              </Pressable>
              <Pressable
                style={[styles.assignBannerSubmit, bulkAssigning && { opacity: 0.7 }]}
                onPress={handleBulkAssign}
                disabled={bulkAssigning}
              >
                {bulkAssigning
                  ? <ActivityIndicator size={13} color={colors.white} />
                  : <Ionicons name="person-add-outline" size={13} color={colors.white} />}
                <Text style={styles.assignBannerSubmitText}>
                  {bulkAssigning ? 'Assigning...' : `Assign to Me`}
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Table head */}
        <View style={styles.tableHead}>
          <Text style={[styles.th, { flex: 2.5 }]}>Account Name</Text>
          <Text style={[styles.th, { flex: 1.5 }]}>Account Type</Text>
          <Text style={[styles.th, { flex: 2 }]}>City, Address</Text>
          <Text style={[styles.th, { flex: 2 }]}>Account Handler</Text>
          <Text style={[styles.th, { flex: 1.5 }]}>Last Planned Visit</Text>
          <Text style={[styles.th, { flex: 1 }]}>Status</Text>
          <Text style={[styles.th, { flex: 1 }]}>Actions</Text>
        </View>

        {/* Body */}
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.loadingText}>Loading accounts...</Text>
          </View>
        ) : error ? (
          <View style={styles.centered}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.retryBtn} onPress={() => fetchAccounts(page)}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : accounts.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons
              name={segment === 'My Assigned' ? 'person-outline' : 'business-outline'}
              size={36} color={colors.textMuted}
            />
            <Text style={styles.emptyTitle}>
              {segment === 'My Assigned' ? 'No assigned accounts yet' : 'No accounts found'}
            </Text>
            <Text style={styles.emptyText}>
              {segment === 'My Assigned'
                ? 'Go to All Accounts and tap + to assign yourself.'
                : 'Try adjusting your search or filters.'}
            </Text>
          </View>
        ) : (
          accounts.map((account, idx) => {
            const id = account._id || account.id || account.accountId;
            const name = account.accountName || account.name || 'Unnamed';
            const type = account.accountType || account.type || 'Clinic';
            const contact = account.keyContact || account.contactPerson || '—';
            const address = account.location?.address || account.address || '—';
            const reps = (account.assignedMedicalRepIds || account.assignedReps || []).map((r) =>
              typeof r === 'string' ? r : (r?._id || r?.userId || r?.id || '')
            ).filter(Boolean);
            const visitDate = account.lastPlannedVisit?.date;
            const active = account.isActive !== false && account.status !== 'inactive';
            const selected = selectedIds.includes(id);
            const alreadyAssigned = reps.includes(userId);

            return (
              <Pressable
                key={id || idx}
                style={[styles.tableRow, idx % 2 === 1 && styles.tableRowAlt, selected && styles.tableRowSelected]}
                onPress={() => navigation.navigate('AccountDetail', { accountId: id })}
              >
                <View style={[styles.td, { flex: 2.5 }]}>
                  <Text style={styles.cellPrimary} numberOfLines={1}>{name}</Text>
                  <Text style={styles.cellSub} numberOfLines={1}>{contact}</Text>
                </View>
                <View style={[styles.td, { flex: 1.5 }]}>
                  <TypePill type={type} />
                </View>
                <View style={[styles.td, { flex: 2 }]}>
                  <Text style={styles.cellSecondary} numberOfLines={2}>{address}</Text>
                </View>
                <View style={[styles.td, { flex: 2 }]}>
                  <Text style={styles.cellSecondary} numberOfLines={1}>
                    {reps.length > 0 ? `${reps.length} rep${reps.length !== 1 ? 's' : ''}` : '—'}
                  </Text>
                </View>
                <View style={[styles.td, { flex: 1.5 }]}>
                  {visitDate ? (
                    <>
                      <Text style={styles.cellSecondary}>{new Date(visitDate).toLocaleDateString()}</Text>
                      <Text style={styles.cellSub}>{new Date(visitDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                    </>
                  ) : (
                    <Text style={styles.cellSecondary}>—</Text>
                  )}
                </View>
                <View style={[styles.td, { flex: 1 }]}>
                  <StatusPill active={active} />
                </View>
                <View style={[styles.td, { flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center' }]}>
                  <Pressable
                    style={styles.actionIcon}
                    onPress={(e) => { e.stopPropagation(); navigation.navigate('AccountDetail', { accountId: id }); }}
                  >
                    <Ionicons name="eye-outline" size={15} color={colors.textSecondary} />
                  </Pressable>
                  {managerRole && (
                    <Pressable
                      style={styles.actionIcon}
                      onPress={(e) => { e.stopPropagation(); navigation.navigate('AccountForm', { mode: 'edit', accountId: id }); }}
                    >
                      <Ionicons name="pencil-outline" size={15} color={colors.primary} />
                    </Pressable>
                  )}
                  {/* Rep self-assign button — only on All Accounts tab and not yet assigned */}
                  {!managerRole && segment === 'All Accounts' && !alreadyAssigned && (
                    <Pressable
                      style={[styles.addBtn, selected && styles.addBtnSelected]}
                      onPress={(e) => { e.stopPropagation(); toggleSelect(id); }}
                    >
                      <Ionicons
                        name={selected ? 'checkmark' : 'add'}
                        size={15}
                        color={selected ? colors.white : colors.primary}
                      />
                    </Pressable>
                  )}
                </View>
              </Pressable>
            );
          })
        )}

        {/* Pagination */}
        {!loading && accounts.length > 0 && (
          <View style={styles.pagination}>
            <Text style={styles.paginationInfo}>
              Showing {((page - 1) * (pagination.limit || 20)) + 1}–{Math.min(page * (pagination.limit || 20), pagination.total || accounts.length)} of {pagination.total || accounts.length} accounts
            </Text>
            <View style={styles.pageButtons}>
              <Pressable style={[styles.pageBtn, page <= 1 && styles.pageBtnDisabled]} onPress={() => handlePageChange(page - 1)} disabled={page <= 1}>
                <Ionicons name="chevron-back" size={14} color={page <= 1 ? colors.textMuted : colors.textPrimary} />
              </Pressable>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                return start + i;
              }).filter((p) => p >= 1 && p <= totalPages).map((p) => (
                <Pressable key={p} style={[styles.pageNum, page === p && styles.pageNumActive]} onPress={() => handlePageChange(p)}>
                  <Text style={[styles.pageNumText, page === p && styles.pageNumTextActive]}>{p}</Text>
                </Pressable>
              ))}
              {totalPages > 5 && <Text style={styles.pageDots}>...</Text>}
              {totalPages > 5 && (
                <Pressable style={[styles.pageNum, page === totalPages && styles.pageNumActive]} onPress={() => handlePageChange(totalPages)}>
                  <Text style={[styles.pageNumText, page === totalPages && styles.pageNumTextActive]}>{totalPages}</Text>
                </Pressable>
              )}
              <Pressable style={[styles.pageBtn, page >= totalPages && styles.pageBtnDisabled]} onPress={() => handlePageChange(page + 1)} disabled={page >= totalPages}>
                <Ionicons name="chevron-forward" size={14} color={page >= totalPages ? colors.textMuted : colors.textPrimary} />
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </AppShell>
  );
}

/* ─── Styles ─────────────────────────────────────────────────────────────── */
const shadow = { shadowColor: '#11224A', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 14, elevation: 3 };

const styles = StyleSheet.create({
  pageHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: globalHeight('1.5%'), flexWrap: 'wrap', gap: 10 },
  pageTitle: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  pageSubtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 3 },

  statsRow: { flexDirection: 'row', gap: 12, marginBottom: globalHeight('1.5%'), flexWrap: 'wrap' },
  statCard: { flex: 1, minWidth: 160, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.surface, padding: 16, ...shadow },
  statIcon: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  statBody: { flex: 1 },
  statLabel: { fontSize: 12, color: colors.textSecondary, marginBottom: 2 },
  statValue: { fontSize: 22, fontWeight: '800', color: colors.textPrimary },
  statSub: { fontSize: 11, color: colors.textMuted, marginTop: 1 },

  tableCard: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.surface, overflow: 'hidden', ...shadow },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderBottomWidth: 1, borderBottomColor: colors.border, flexWrap: 'wrap' },
  searchWrap: { flex: 1, minWidth: 220, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, height: 38 },
  searchInput: { flex: 1, fontSize: 13, color: colors.textPrimary, outlineStyle: 'none' },

  segmentRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.border, paddingHorizontal: 14 },
  segmentTab: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  segmentTabActive: { borderBottomColor: colors.primary },
  segmentText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  segmentTextActive: { color: colors.primary, fontWeight: '700' },

  assignBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: colors.primary + '0D',
    borderBottomWidth: 1, borderBottomColor: colors.primary + '30',
    flexWrap: 'wrap', gap: 10,
  },
  assignBannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  assignBannerBadge: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  assignBannerBadgeText: { fontSize: 12, fontWeight: '800', color: colors.white },
  assignBannerText: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  assignBannerActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  assignBannerCancel: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 7, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  assignBannerCancelText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  assignBannerSubmit: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 7, backgroundColor: colors.primary,
  },
  assignBannerSubmitText: { fontSize: 12, fontWeight: '700', color: colors.white },

  tableHead: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.backgroundColor, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  th: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: colors.border },
  tableRowAlt: { backgroundColor: colors.backgroundColor + '60' },
  tableRowSelected: { backgroundColor: colors.primary + '08' },
  td: { justifyContent: 'center', paddingRight: 8 },
  cellPrimary: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  cellSecondary: { fontSize: 12, color: colors.textSecondary },
  cellSub: { fontSize: 11, color: colors.textMuted, marginTop: 1 },

  typePill: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  typePillText: { fontSize: 11, fontWeight: '700' },
  statusPill: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  pillActive: { backgroundColor: '#E7F8EF' },
  pillInactive: { backgroundColor: '#FFF4EE' },
  statusPillText: { fontSize: 11, fontWeight: '700' },
  pillTextActive: { color: colors.success },
  pillTextInactive: { color: '#F97316' },

  actionIcon: { width: 28, height: 28, borderRadius: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.backgroundColor },

  addBtn: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  addBtnSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },

  centered: { alignItems: 'center', padding: 40, gap: 10 },
  loadingText: { color: colors.textSecondary, fontSize: 13 },
  errorText: { color: colors.danger, fontSize: 13 },
  retryBtn: { borderWidth: 1, borderColor: colors.primary, borderRadius: 6, paddingHorizontal: 14, paddingVertical: 7 },
  retryText: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  emptyState: { alignItems: 'center', padding: 48, gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  emptyText: { fontSize: 13, color: colors.textSecondary },

  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderTopWidth: 1, borderTopColor: colors.border, flexWrap: 'wrap', gap: 8 },
  paginationInfo: { fontSize: 12, color: colors.textSecondary },
  pageButtons: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pageBtn: { width: 30, height: 30, borderRadius: 6, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  pageBtnDisabled: { opacity: 0.4 },
  pageNum: { width: 30, height: 30, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  pageNumActive: { backgroundColor: colors.primary },
  pageNumText: { fontSize: 12, color: colors.textSecondary },
  pageNumTextActive: { color: colors.white, fontWeight: '700' },
  pageDots: { fontSize: 12, color: colors.textMuted, paddingHorizontal: 4 },

  btnPrimary: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 8 },
  btnPrimaryText: { color: colors.white, fontSize: 13, fontWeight: '700' },
  btnOutline: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.primary, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
  btnOutlineText: { color: colors.primary, fontSize: 13, fontWeight: '700' },
});
