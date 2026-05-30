import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AppShell from '../../components/AppShell';
import { colors } from '../../constants/colors';
import { globalHeight, globalWidth } from '../../constants/globalWidth';
import {
  listSalesTeamMembers,
  updateSalesTeamMemberStatus,
  deleteSalesTeamMember,
} from '../../store/salesTeam/salesTeamActions';

const isManager = (role) =>
  ['admin', 'manager', 'senior_manager'].includes(String(role).toLowerCase());

/* ─── Helpers ────────────────────────────────────────────────────────────── */
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getInitials(name) {
  return (name || '?')
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('');
}

/* ─── Sub-components ─────────────────────────────────────────────────────── */
function StatCard({ icon, iconColor, iconBg, label, value, sub }) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <View style={styles.statBody}>
        <Text style={styles.statLabel}>{label}</Text>
        <Text style={styles.statValue}>{value ?? '—'}</Text>
        {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
      </View>
    </View>
  );
}

function StatusToggle({ isActive, onToggle, loading }) {
  return (
    <Pressable
      style={[styles.toggle, isActive ? styles.toggleOn : styles.toggleOff]}
      onPress={onToggle}
      disabled={loading}
    >
      {loading
        ? <ActivityIndicator size={10} color={colors.white} />
        : <View style={[styles.toggleThumb, isActive ? styles.toggleThumbOn : styles.toggleThumbOff]} />
      }
    </Pressable>
  );
}

function PositionPill({ position }) {
  const colors2 = {
    bg: '#EFF6FF',
    text: '#1D4ED8',
  };
  if (!position) return null;
  return (
    <View style={[styles.posPill, { backgroundColor: colors2.bg }]}>
      <Text style={[styles.posPillText, { color: colors2.text }]}>{position}</Text>
    </View>
  );
}

/* ─── Filter dropdown ────────────────────────────────────────────────────── */
function FilterSelect({ value, options, onChange, placeholder }) {
  const [open, setOpen] = useState(false);
  const label = options.find((o) => o.value === value)?.label || placeholder;
  return (
    <View style={styles.filterWrap}>
      <Pressable style={styles.filterTrigger} onPress={() => setOpen((o) => !o)}>
        <Text style={[styles.filterTriggerText, !value && { color: colors.textMuted }]}>{label}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={12} color={colors.textSecondary} />
      </Pressable>
      {open && (
        <View style={styles.filterPanel}>
          {options.map((opt) => (
            <Pressable
              key={opt.value}
              style={[styles.filterOpt, value === opt.value && styles.filterOptActive]}
              onPress={() => { onChange(opt.value); setOpen(false); }}
            >
              <Text style={[styles.filterOptText, value === opt.value && { color: colors.primary, fontWeight: '700' }]}>
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

const POSITION_OPTIONS = [
  { value: '', label: 'All Positions' },
  { value: 'Medical Rep', label: 'Medical Rep' },
  { value: 'Senior Rep', label: 'Senior Rep' },
  { value: 'Key Account Manager', label: 'Key Account Manager' },
  { value: 'Senior Medical Representative', label: 'Senior Medical Rep' },
  { value: 'Sales Manager', label: 'Sales Manager' },
];

/* ─── Main Screen ────────────────────────────────────────────────────────── */
export default function SalesTeamScreen({ navigation, userDetails, appMetadata, onSignOut }) {
  const user        = userDetails?.user || userDetails?.data?.user || userDetails || {};
  const token       = userDetails?.token || userDetails?.data?.token || '';
  const role        = user.role || '';
  const managerRole = isManager(role);

  const [members,    setMembers]    = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 });
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');
  const [search,     setSearch]     = useState('');
  const [filterStatus,   setFilterStatus]   = useState('');
  const [filterPosition, setFilterPosition] = useState('');
  const [page,       setPage]       = useState(1);
  const [toggling,   setToggling]   = useState(null);
  const [deleting,   setDeleting]   = useState(null);

  const fetchData = useCallback(async (pg = 1) => {
    setLoading(true);
    setError('');
    try {
      const params = { page: pg, limit: 20 };
      if (search)         params.search   = search;
      if (filterStatus) {
        params.status   = filterStatus;
        params.isActive = filterStatus === 'active';
      }
      if (filterPosition) params.position = filterPosition;
      const res = await listSalesTeamMembers(token, params);
      setMembers(Array.isArray(res.data) ? res.data : []);
      setPagination(res.pagination || { page: pg, limit: 20, total: 0, pages: 1 });
    } catch (e) {
      setError(e.message || 'Failed to load sales team');
    } finally {
      setLoading(false);
    }
  }, [token, search, filterStatus, filterPosition]);

  useEffect(() => {
    const t = setTimeout(() => { setPage(1); fetchData(1); }, 300);
    return () => clearTimeout(t);
  }, [search, filterStatus, filterPosition]);

  useEffect(() => { fetchData(page); }, [page]);

  const handleToggleStatus = async (member) => {
    const id = member._id || member.id;
    setToggling(id);
    try {
      await updateSalesTeamMemberStatus(token, id, !member.isActive);
      fetchData(page);
    } catch (e) {
      alert(e.message || 'Failed to update status');
    } finally {
      setToggling(null);
    }
  };

  const handleDelete = async (member) => {
    const id   = member._id || member.id;
    const name = member.fullName || member.name || 'this member';
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    setDeleting(id);
    try {
      await deleteSalesTeamMember(token, id);
      fetchData(page);
    } catch (e) {
      alert(e.message || 'Failed to delete');
    } finally {
      setDeleting(null);
    }
  };

  const totalPages    = pagination.pages || 1;
  const activeCount   = members.filter((m) => m.isActive !== false && m.status !== 'inactive').length;
  const inactiveCount = members.length - activeCount;
  const totalAssigned = members.reduce((s, m) => s + (m.assignedAccounts?.length || m.accountIds?.length || 0), 0);

  // ── Hierarchical sort: KAMs/roots first, then their direct reports below ──
  const sortedMembers = useMemo(() => {
    // Skip hierarchy when a search/filter is active — flat list makes more sense
    if (search || filterStatus || filterPosition) return members;

    const getId  = (m) => m._id || m.id || '';
    const getMgrId = (m) => {
      const mgr = m.managerId;
      if (!mgr) return null;
      return typeof mgr === 'object' ? (mgr._id || mgr.id || null) : mgr;
    };

    const memberIds = new Set(members.map(getId));
    // Roots = no manager, OR manager not in current page
    const roots   = members.filter((m) => !getMgrId(m) || !memberIds.has(getMgrId(m)));
    const reports = members.filter((m) =>  getMgrId(m) &&  memberIds.has(getMgrId(m)));

    const result = [];
    const placed = new Set();

    roots.forEach((root) => {
      const rootId = getId(root);
      result.push({ ...root, _level: 0, _isGroupRoot: true });
      placed.add(rootId);
      // Direct reports of this root
      const direct = reports.filter((r) => getMgrId(r) === rootId);
      direct.forEach((r) => {
        result.push({ ...r, _level: 1, _isGroupRoot: false });
        placed.add(getId(r));
      });
    });

    // Any leftover (nested > 1 level deep, or orphaned)
    members.forEach((m) => {
      if (!placed.has(getId(m))) result.push({ ...m, _level: 1, _isGroupRoot: false });
    });

    return result;
  }, [members, search, filterStatus, filterPosition]);

  return (
    <AppShell
      navigation={navigation}
      userDetails={userDetails}
      appMetadata={appMetadata}
      onSignOut={onSignOut}
      activeRoute="Sales Team"
    >
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <View style={styles.pageHeader}>
        <View>
          <Text style={styles.pageTitle}>Sales Team</Text>
          <Text style={styles.pageSubtitle}>
            Manage salespeople linked to accounts and order communication
          </Text>
        </View>
        {managerRole && (
          <Pressable
            style={styles.btnPrimary}
            onPress={() => navigation.navigate('SalesTeamForm', { mode: 'create' })}
          >
            <Ionicons name="add" size={15} color={colors.white} />
            <Text style={styles.btnPrimaryText}>+ Salesperson</Text>
          </Pressable>
        )}
      </View>

      {/* ── Stats ───────────────────────────────────────────────────────── */}
      <View style={styles.statsRow}>
        <StatCard
          icon="people-outline" iconColor="#0F6FFF" iconBg="#E8F0FF"
          label="Total Salespeople" value={pagination.total}
        />
        <StatCard
          icon="checkmark-circle-outline" iconColor="#059669" iconBg="#ECFDF5"
          label="Active"
          value={activeCount}
          sub={members.length ? `${Math.round(activeCount / members.length * 100)}% of total` : ''}
        />
        <StatCard
          icon="close-circle-outline" iconColor="#DC2626" iconBg="#FEF2F2"
          label="Inactive"
          value={inactiveCount}
          sub={members.length ? `${Math.round(inactiveCount / members.length * 100)}% of total` : ''}
        />
        <StatCard
          icon="business-outline" iconColor="#F97316" iconBg="#FFF3E0"
          label="Assigned Accounts"
          value={totalAssigned}
          sub="Across this page"
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
              placeholder="Search by name, email, or phone..."
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
          <FilterSelect
            value={filterPosition}
            options={POSITION_OPTIONS}
            onChange={setFilterPosition}
            placeholder="All Positions"
          />
          <FilterSelect
            value={filterStatus}
            options={STATUS_OPTIONS}
            onChange={setFilterStatus}
            placeholder="All Statuses"
          />
          {managerRole && (
            <Pressable style={styles.btnOutline} onPress={() => navigation.navigate('SalesTeamForm', { mode: 'create' })}>
              <Ionicons name="add" size={14} color={colors.primary} />
              <Text style={styles.btnOutlineText}>Salesperson</Text>
            </Pressable>
          )}
        </View>

        {/* Table head */}
        <View style={styles.tableHead}>
          <Text style={[styles.th, { flex: 2 }]}>Full Name</Text>
          <Text style={[styles.th, { flex: 1.6 }]}>Position</Text>
          <Text style={[styles.th, { flex: 1.6 }]}>Phone</Text>
          <Text style={[styles.th, { flex: 2 }]}>Email</Text>
          <Text style={[styles.th, { flex: 1 }]}>Accounts</Text>
          <Text style={[styles.th, { flex: 1.8 }]}>Manager / KAM</Text>
          <Text style={[styles.th, { flex: 1 }]}>Status</Text>
          <Text style={[styles.th, { flex: 1.5 }]}>Created</Text>
          <Text style={[styles.th, { flex: 1.5 }]}>Actions</Text>
        </View>

        {/* Body */}
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.loadingText}>Loading sales team...</Text>
          </View>
        ) : error ? (
          <View style={styles.centered}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.retryBtn} onPress={() => fetchData(page)}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : members.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={40} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No sales team members found</Text>
            <Text style={styles.emptyText}>
              {search || filterStatus || filterPosition
                ? 'Try adjusting your filters.'
                : managerRole ? 'Click "+ Salesperson" to add the first member.' : 'No members added yet.'}
            </Text>
          </View>
        ) : (
          sortedMembers.map((member, idx) => {
            const id        = member._id || member.id;
            const name      = member.fullName || member.name || '—';
            const position  = member.position || '—';
            const phone     = member.phone || member.phoneNumber || '—';
            const email     = member.email || '—';
            const acctCount = member.accountIds?.length || member.assignedAccounts?.length || 0;
            const manager   = member.managerId?.fullName || member.managerId?.name || '—';
            const active    = member.isActive !== false && member.status !== 'inactive';
            const even      = idx % 2 === 0;
            const isToggling  = toggling === id;
            const isDeleting  = deleting === id;
            const isChild     = member._level === 1;   // indented report
            const isGroupRoot = member._isGroupRoot;   // top-level / KAM

            return (
              <View
                key={id}
                style={[
                  styles.tableRow,
                  even && styles.tableRowAlt,
                  isGroupRoot && styles.tableRowRoot,
                ]}
              >
                {/* Name + avatar (indent for direct reports) */}
                <Pressable
                  style={[styles.td, { flex: 2, flexDirection: 'row', alignItems: 'center', gap: 6 }]}
                  onPress={() => navigation.navigate('SalesTeamDetails', { memberId: id })}
                >
                  {isChild && (
                    <View style={styles.indentLine}>
                      <Text style={styles.indentArrow}>↳</Text>
                    </View>
                  )}
                  <View style={[styles.avatar, isGroupRoot && styles.avatarRoot]}>
                    <Text style={[styles.avatarText, isGroupRoot && styles.avatarTextRoot]}>
                      {getInitials(name)}
                    </Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.tdLink} numberOfLines={1}>{name}</Text>
                  </View>
                </Pressable>

                {/* Position */}
                <View style={[styles.td, { flex: 1.6 }]}>
                  <PositionPill position={position} />
                </View>

                {/* Phone */}
                <View style={{ flex: 1.6, minWidth: 0, justifyContent: 'center' }}>
                  <Text style={styles.tdText} numberOfLines={1}>{phone}</Text>
                </View>

                {/* Email */}
                <View style={{ flex: 2, minWidth: 0, justifyContent: 'center' }}>
                  <Text style={styles.tdText} numberOfLines={1}>{email}</Text>
                </View>

                {/* Accounts count */}
                <View style={[styles.td, { flex: 1 }]}>
                  {acctCount > 0 ? (
                    <View style={styles.countBadge}>
                      <Text style={styles.countBadgeText}>{acctCount}</Text>
                    </View>
                  ) : (
                    <Text style={styles.tdMuted}>0</Text>
                  )}
                </View>

                {/* Manager */}
                <View style={{ flex: 1.8, minWidth: 0, justifyContent: 'center' }}>
                  <Text style={styles.tdText} numberOfLines={1}>{manager}</Text>
                </View>

                {/* Status toggle */}
                <View style={[styles.td, { flex: 1 }]}>
                  {managerRole ? (
                    <StatusToggle
                      isActive={active}
                      onToggle={() => handleToggleStatus(member)}
                      loading={isToggling}
                    />
                  ) : (
                    <View style={[styles.statusPill, { backgroundColor: active ? '#ECFDF5' : '#FEF2F2' }]}>
                      <Text style={[styles.statusPillText, { color: active ? '#059669' : '#DC2626' }]}>
                        {active ? 'Active' : 'Inactive'}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Created */}
                <View style={{ flex: 1.5, minWidth: 0, justifyContent: 'center' }}>
                  <Text style={styles.tdMuted} numberOfLines={1}>{fmtDate(member.createdAt)}</Text>
                </View>

                {/* Actions */}
                <View style={[styles.td, { flex: 1.5, flexDirection: 'row', gap: 5 }]}>
                  <Pressable
                    style={styles.iconBtn}
                    onPress={() => navigation.navigate('SalesTeamDetails', { memberId: id })}
                  >
                    <Ionicons name="eye-outline" size={14} color={colors.primary} />
                  </Pressable>
                  {managerRole && (
                    <>
                      <Pressable
                        style={styles.iconBtn}
                        onPress={() => navigation.navigate('SalesTeamForm', { mode: 'edit', memberId: id })}
                      >
                        <Ionicons name="pencil-outline" size={14} color={colors.warning} />
                      </Pressable>
                      <Pressable
                        style={[styles.iconBtn, { borderColor: '#FCA5A5' }, isDeleting && { opacity: 0.5 }]}
                        onPress={() => handleDelete(member)}
                        disabled={isDeleting}
                      >
                        {isDeleting
                          ? <ActivityIndicator size={11} color={colors.danger} />
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
              <Ionicons name="chevron-back" size={14} color={page <= 1 ? colors.textMuted : colors.primary} />
              <Text style={[styles.pageBtnText, page <= 1 && { color: colors.textMuted }]}>Prev</Text>
            </Pressable>
            <Text style={styles.pageInfo}>
              Page {page} of {totalPages} · {pagination.total} members
            </Text>
            <Pressable
              style={[styles.pageBtn, page >= totalPages && styles.pageBtnDisabled]}
              onPress={() => page < totalPages && setPage(page + 1)}
              disabled={page >= totalPages}
            >
              <Text style={[styles.pageBtnText, page >= totalPages && { color: colors.textMuted }]}>Next</Text>
              <Ionicons name="chevron-forward" size={14} color={page >= totalPages ? colors.textMuted : colors.primary} />
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
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: globalHeight('2%'),
  },
  pageTitle:    { fontSize: globalWidth('1.4%'), fontWeight: '800', color: colors.textPrimary },
  pageSubtitle: { fontSize: globalWidth('0.75%'), color: colors.textSecondary, marginTop: globalHeight('0.4%') },

  statsRow: {
    flexDirection: 'row', gap: globalWidth('1.2%'),
    marginBottom: globalHeight('2%'), flexWrap: 'wrap',
  },
  statCard: {
    flex: 1, minWidth: globalWidth('14%'),
    backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1,
    borderColor: colors.border, padding: globalWidth('1%'),
    flexDirection: 'row', alignItems: 'center', gap: globalWidth('0.8%'),
  },
  statIcon:  { width: globalWidth('2.6%'), height: globalWidth('2.6%'), borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  statBody:  { flex: 1 },
  statLabel: { fontSize: globalWidth('0.6%'), color: colors.textMuted, fontWeight: '600' },
  statValue: { fontSize: globalWidth('1.1%'), fontWeight: '800', color: colors.textPrimary, marginTop: 2 },
  statSub:   { fontSize: globalWidth('0.56%'), color: colors.textSecondary, marginTop: 2 },

  tableCard: {
    backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1,
    borderColor: colors.border, overflow: 'hidden', marginBottom: globalHeight('2%'),
  },
  toolbar: {
    flexDirection: 'row', alignItems: 'center', gap: globalWidth('0.7%'),
    padding: globalWidth('0.9%'), borderBottomWidth: 1, borderBottomColor: colors.border,
    flexWrap: 'wrap',
  },
  searchWrap: {
    flex: 1, minWidth: globalWidth('18%'),
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.backgroundColor, borderRadius: 8, borderWidth: 1,
    borderColor: colors.border, paddingHorizontal: globalWidth('0.6%'),
    height: globalHeight('4.2%'), gap: globalWidth('0.4%'),
  },
  searchInput: {
    flex: 1, fontSize: globalWidth('0.72%'),
    color: colors.textPrimary, outlineStyle: 'none',
  },

  filterWrap: { position: 'relative' },
  filterTrigger: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: 8, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: globalWidth('0.7%'), height: globalHeight('4.2%'),
    backgroundColor: colors.surface,
  },
  filterTriggerText: { fontSize: globalWidth('0.68%'), color: colors.textPrimary, fontWeight: '600' },
  filterPanel: {
    position: 'absolute', top: globalHeight('4.6%'), left: 0, zIndex: 100,
    backgroundColor: colors.surface, borderRadius: 8, borderWidth: 1,
    borderColor: colors.border, minWidth: 160,
    shadowColor: colors.shadow, shadowOpacity: 0.1, shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 }, elevation: 8,
  },
  filterOpt:       { paddingHorizontal: 14, paddingVertical: globalHeight('1%') },
  filterOptActive: { backgroundColor: colors.surfaceSoft },
  filterOptText:   { fontSize: globalWidth('0.68%'), color: colors.textPrimary },

  tableHead: {
    flexDirection: 'row', paddingHorizontal: globalWidth('1%'),
    paddingVertical: globalHeight('1%'), backgroundColor: colors.backgroundColor,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  th: {
    fontSize: globalWidth('0.6%'), fontWeight: '700',
    color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row', paddingHorizontal: globalWidth('1%'),
    paddingVertical: globalHeight('1.1%'), alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  tableRowAlt:  { backgroundColor: colors.backgroundColor },
  // Group-root row (KAM / top-level) gets a subtle left accent
  tableRowRoot: {
    borderLeftWidth: 3, borderLeftColor: colors.primary,
  },
  td:     { justifyContent: 'center' },
  tdLink: { fontSize: globalWidth('0.72%'), fontWeight: '700', color: colors.primary },
  tdText: { fontSize: globalWidth('0.72%'), color: colors.textPrimary },
  tdMuted:{ fontSize: globalWidth('0.68%'), color: colors.textSecondary },

  // Hierarchy indent
  indentLine:  { width: 16, alignItems: 'center', flexShrink: 0 },
  indentArrow: { fontSize: globalWidth('0.62%'), color: colors.textMuted, lineHeight: 16 },

  avatar: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: colors.primaryLight,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  avatarText: { fontSize: globalWidth('0.6%'), fontWeight: '800', color: colors.primary },
  // Root-member avatar is slightly larger with a stronger colour
  avatarRoot:     { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primary },
  avatarTextRoot: { color: colors.white, fontWeight: '900' },

  posPill: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start' },
  posPillText: { fontSize: globalWidth('0.58%'), fontWeight: '700' },

  countBadge: {
    backgroundColor: colors.primaryLight, borderRadius: 20,
    paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start',
  },
  countBadgeText: { fontSize: globalWidth('0.62%'), fontWeight: '700', color: colors.primary },

  statusPill:     { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start' },
  statusPillText: { fontSize: globalWidth('0.6%'), fontWeight: '700' },

  toggle: {
    width: 36, height: 20, borderRadius: 10,
    justifyContent: 'center', paddingHorizontal: 2,
  },
  toggleOn:        { backgroundColor: colors.success },
  toggleOff:       { backgroundColor: colors.textMuted },
  toggleThumb:     { width: 16, height: 16, borderRadius: 8, backgroundColor: colors.white },
  toggleThumbOn:   { alignSelf: 'flex-end' },
  toggleThumbOff:  { alignSelf: 'flex-start' },

  iconBtn: {
    width: 28, height: 28, borderRadius: 6,
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },

  btnPrimary: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: colors.primary, borderRadius: 8,
    paddingHorizontal: globalWidth('1%'), height: globalHeight('4.4%'),
  },
  btnPrimaryText: { color: colors.white, fontSize: globalWidth('0.72%'), fontWeight: '700' },
  btnOutline: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: 8, borderWidth: 1, borderColor: colors.primary,
    paddingHorizontal: globalWidth('1%'), height: globalHeight('4.4%'),
  },
  btnOutlineText: { color: colors.primary, fontSize: globalWidth('0.72%'), fontWeight: '700' },

  centered: { alignItems: 'center', justifyContent: 'center', paddingVertical: globalHeight('4%'), gap: 8 },
  loadingText: { fontSize: globalWidth('0.72%'), color: colors.textSecondary },
  errorText:   { fontSize: globalWidth('0.72%'), color: colors.danger },
  retryBtn:    { backgroundColor: colors.primaryLight, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 6 },
  retryText:   { color: colors.primary, fontWeight: '700', fontSize: globalWidth('0.72%') },

  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: globalHeight('5%'), gap: 8 },
  emptyTitle: { fontSize: globalWidth('0.85%'), fontWeight: '700', color: colors.textPrimary },
  emptyText:  { fontSize: globalWidth('0.72%'), color: colors.textSecondary, textAlign: 'center', maxWidth: globalWidth('30%') },

  pagination: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    padding: globalWidth('0.9%'), gap: globalWidth('0.8%'),
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  pageBtn:         { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, borderWidth: 1, borderColor: colors.border, paddingHorizontal: globalWidth('0.7%'), paddingVertical: globalHeight('0.6%') },
  pageBtnDisabled: { opacity: 0.4 },
  pageBtnText:     { fontSize: globalWidth('0.68%'), color: colors.primary, fontWeight: '700' },
  pageInfo:        { fontSize: globalWidth('0.68%'), color: colors.textSecondary, fontWeight: '600' },
});
