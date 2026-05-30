import React, { useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AppShell from '../../components/AppShell';
import { colors } from '../../constants/colors';
import { globalHeight, globalWidth } from '../../constants/globalWidth';
import {
  listTargetAssignments,
  updateTargetAssignmentStatus,
  deleteTargetAssignment,
} from '../../store/targets/targetAssignmentActions';
import { listSalesTeamMembers } from '../../store/salesTeam/salesTeamActions';
import { listProducts } from '../../store/products/productActions';
import { listSalesChannels } from '../../store/salesChannels/salesChannelActions';

const isManager = (role) =>
  ['admin', 'manager', 'senior_manager'].includes(String(role).toLowerCase());

const THIS_YEAR = new Date().getFullYear();

const STATUS_STYLE = {
  active:   { bg: '#DCFCE7', text: '#15803D' },
  upcoming: { bg: '#FFF7ED', text: '#C2410C' },
  expired:  { bg: '#F1F5F9', text: '#64748B' },
  inactive: { bg: '#F1F5F9', text: '#64748B' },
};

function StatusBadge({ status }) {
  const s = STATUS_STYLE[String(status).toLowerCase()] || STATUS_STYLE.inactive;
  return (
    <View style={[styles.badge, { backgroundColor: s.bg }]}>
      <Text style={[styles.badgeText, { color: s.text }]}>
        {String(status).charAt(0).toUpperCase() + String(status).slice(1)}
      </Text>
    </View>
  );
}

function FilterDropdown({ label, options, value, onChange, style }) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  return (
    <View style={[{ position: 'relative', zIndex: open ? 30 : 1 }, style]}>
      <Pressable style={styles.filterBtn} onPress={() => setOpen((v) => !v)}>
        <Text style={styles.filterBtnText} numberOfLines={1}>{selected?.label || label}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={12} color={colors.textSecondary} />
      </Pressable>
      {open && (
        <View style={styles.filterDropdown}>
          <ScrollView style={{ maxHeight: 220 }}>
            {options.map((opt) => (
              <Pressable
                key={opt.value}
                style={[styles.filterOpt, opt.value === value && styles.filterOptActive]}
                onPress={() => { onChange(opt.value); setOpen(false); }}
              >
                <Text style={[styles.filterOptText, opt.value === value && styles.filterOptTextActive]}
                  numberOfLines={1}>
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

function Pagination({ page, pages, total, onPage }) {
  if (pages <= 1) return null;
  return (
    <View style={styles.pagination}>
      <Text style={styles.paginationInfo}>
        Page {page} of {pages} · {total} total
      </Text>
      <View style={styles.paginationBtns}>
        <Pressable style={[styles.pageBtn, page <= 1 && styles.pageBtnDisabled]} onPress={() => page > 1 && onPage(page - 1)} disabled={page <= 1}>
          <Ionicons name="chevron-back" size={14} color={page <= 1 ? colors.textMuted : colors.textPrimary} />
        </Pressable>
        {Array.from({ length: Math.min(pages, 5) }, (_, i) => {
          const pg = page <= 3 ? i + 1 : page - 2 + i;
          if (pg < 1 || pg > pages) return null;
          return (
            <Pressable key={pg} style={[styles.pageBtn, pg === page && styles.pageBtnActive]} onPress={() => onPage(pg)}>
              <Text style={[styles.pageBtnText, pg === page && styles.pageBtnTextActive]}>{pg}</Text>
            </Pressable>
          );
        })}
        <Pressable style={[styles.pageBtn, page >= pages && styles.pageBtnDisabled]} onPress={() => page < pages && onPage(page + 1)} disabled={page >= pages}>
          <Ionicons name="chevron-forward" size={14} color={page >= pages ? colors.textMuted : colors.textPrimary} />
        </Pressable>
      </View>
    </View>
  );
}

export default function TargetAssignmentsScreen({ navigation, userDetails, appMetadata, onSignOut }) {
  const user    = userDetails?.user || userDetails?.data?.user || userDetails || {};
  const token   = userDetails?.token || userDetails?.data?.token || '';
  const role    = user.role || '';
  const manager = isManager(role);

  const [assignments, setAssignments] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [filterRep, setFilterRep] = useState('');
  const [filterProduct, setFilterProduct] = useState('');
  const [filterChannel, setFilterChannel] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterYear, setFilterYear] = useState(String(THIS_YEAR));
  const [page, setPage] = useState(1);

  const [reps, setReps] = useState([]);
  const [products, setProducts] = useState([]);
  const [channels, setChannels] = useState([]);

  const [deletingId, setDeletingId] = useState('');
  const [togglingId, setTogglingId] = useState('');

  /* load filter options */
  useEffect(() => {
    listSalesTeamMembers(token, { limit: 200 }).then(({ data }) => setReps(data)).catch(() => {});
    listProducts(token, { limit: 200, status: 'active' }).then(({ products: p }) => setProducts(p)).catch(() => {});
    listSalesChannels(token, { status: 'active' }).then(({ channels: c }) => setChannels(c)).catch(() => {});
  }, [token]);

  const fetchAssignments = useCallback(async (pg = 1) => {
    setLoading(true);
    setError('');
    try {
      const params = { page: pg, limit: 20 };
      if (filterYear)    params.year      = filterYear;
      if (filterRep)     params.userId    = filterRep;
      if (filterProduct) params.productId = filterProduct;
      if (filterChannel) params.channelId = filterChannel;
      if (filterStatus)  params.status    = filterStatus;
      if (search.trim()) params.search    = search.trim();
      const res = await listTargetAssignments(token, params);
      setAssignments(res.assignments);
      setPagination(res.pagination);
    } catch (e) {
      setError(e.message || 'Failed to load assignments');
    } finally {
      setLoading(false);
    }
  }, [token, filterYear, filterRep, filterProduct, filterChannel, filterStatus, search]);

  useEffect(() => { setPage(1); fetchAssignments(1); }, [filterYear, filterRep, filterProduct, filterChannel, filterStatus]);

  useEffect(() => {
    const t = setTimeout(() => { setPage(1); fetchAssignments(1); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const handleToggleStatus = async (a) => {
    const id = a._id || a.id;
    const newStatus = a.status === 'active' ? 'inactive' : 'active';
    setTogglingId(id);
    try {
      await updateTargetAssignmentStatus(token, id, { status: newStatus });
      fetchAssignments(page);
    } catch (e) {
      alert(e.message || 'Failed to update status');
    } finally {
      setTogglingId('');
    }
  };

  const handleDelete = async (a) => {
    const id = a._id || a.id;
    if (!confirm(`Delete this target assignment? This cannot be undone.`)) return;
    setDeletingId(id);
    try {
      await deleteTargetAssignment(token, id);
      fetchAssignments(page);
    } catch (e) {
      alert(e.message || 'Failed to delete');
    } finally {
      setDeletingId('');
    }
  };

  const repOpts   = [{ value: '', label: 'All Reps' }, ...reps.map((r) => ({ value: r.userId || r._id, label: r.fullName || r.name || r.email || r._id }))];
  const prodOpts  = [{ value: '', label: 'All Products' }, ...products.map((p) => ({ value: p._id || p.productId, label: `${p.productName || p.name}${p.productNickname ? ` (${p.productNickname})` : ''}` }))];
  const chanOpts  = [{ value: '', label: 'All Channels' }, ...channels.map((c) => ({ value: c._id || c.channelId, label: c.channelName || c.channelKey }))];
  const statOpts  = [
    { value: '', label: 'All Status' },
    { value: 'active', label: 'Active' },
    { value: 'upcoming', label: 'Upcoming' },
    { value: 'expired', label: 'Expired' },
    { value: 'inactive', label: 'Inactive' },
  ];
  const yearOpts = [{ value: '', label: 'All Years' }, ...[THIS_YEAR - 1, THIS_YEAR, THIS_YEAR + 1].map((y) => ({ value: String(y), label: String(y) }))];

  const fmtDate = (d) => d ? d.slice(0, 10) : '—';
  const fmtNum  = (n) => n != null ? Number(n).toLocaleString() : '—';
  const fmtVal  = (v, cur) => {
    if (v == null) return '—';
    const sym = cur === 'AED' ? 'AED ' : '$';
    return `${sym}${Number(v).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  };

  return (
    <AppShell navigation={navigation} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} activeRoute="TargetAssignments">

      {/* Page header */}
      <View style={styles.pageHeader}>
        <View>
          <Text style={styles.pageTitle}>Target Assignments</Text>
          <Text style={styles.pageSubtitle}>Manage sales target assignments by rep, product, and channel</Text>
        </View>
        {manager && (
          <View style={styles.headerActions}>
            <Pressable style={styles.btnOutline} onPress={() => navigation.navigate('TargetBulkImport')}>
              <Ionicons name="cloud-upload-outline" size={14} color={colors.primary} />
              <Text style={styles.btnOutlineText}>Bulk Upload</Text>
            </Pressable>
            <Pressable style={styles.btnPrimary} onPress={() => navigation.navigate('TargetAssignmentForm', { mode: 'create' })}>
              <Ionicons name="add" size={14} color={colors.white} />
              <Text style={styles.btnPrimaryText}>Add Assignment</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* Filters */}
      <View style={styles.filtersRow}>
        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={14} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search by rep, product..."
            placeholderTextColor={colors.textMuted}
          />
          {search ? (
            <Pressable onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={14} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
        <FilterDropdown label="All Reps"     options={repOpts}  value={filterRep}     onChange={setFilterRep}     style={{ zIndex: 25 }} />
        <FilterDropdown label="All Products" options={prodOpts} value={filterProduct} onChange={setFilterProduct} style={{ zIndex: 24 }} />
        <FilterDropdown label="All Channels" options={chanOpts} value={filterChannel} onChange={setFilterChannel} style={{ zIndex: 23 }} />
        <FilterDropdown label="All Status"   options={statOpts} value={filterStatus}  onChange={setFilterStatus}  style={{ zIndex: 22 }} />
        <FilterDropdown label="Year"         options={yearOpts} value={filterYear}    onChange={setFilterYear}    style={{ zIndex: 21 }} />
        {(filterRep || filterProduct || filterChannel || filterStatus || search) && (
          <Pressable style={styles.clearBtn} onPress={() => { setFilterRep(''); setFilterProduct(''); setFilterChannel(''); setFilterStatus(''); setSearch(''); }}>
            <Text style={styles.clearBtnText}>Clear</Text>
          </Pressable>
        )}
      </View>

      {/* Table */}
      {loading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.btnOutline} onPress={() => fetchAssignments(page)}>
            <Text style={styles.btnOutlineText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.tableCard}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ minWidth: 1000 }}>
              {/* Head */}
              <View style={styles.tableHead}>
                {['Medical Rep','Product','Channel','Start','End','Units','Value','Currency','Status','Actions'].map((h) => (
                  <Text key={h} style={[styles.th, h === 'Actions' && { textAlign: 'right' }]}>{h}</Text>
                ))}
              </View>

              {assignments.length === 0 ? (
                <View style={styles.emptyRow}>
                  <Text style={styles.emptyRowText}>No target assignments found</Text>
                </View>
              ) : (
                assignments.map((a) => {
                  const id       = a._id || a.id;
                  const product  = a.productId || {};
                  const channel  = a.channelId || {};
                  const repName  = a.userId?.fullName || a.userId?.name || a.repName || a.repId?.fullName || '—';
                  const pName    = product.productName || product.name || a.productName || '—';
                  const pNick    = product.productNickname || a.productNickname || '';
                  const chName   = channel.channelName || channel.channelKey || a.channelName || '—';
                  const currency = a.currency || 'USD';
                  return (
                    <View key={id} style={styles.tableRow}>
                      <Text style={styles.td} numberOfLines={1}>{repName}</Text>
                      <View style={styles.tdProduct}>
                        <Text style={styles.tdProductName} numberOfLines={1}>{pName}</Text>
                        {pNick ? <Text style={styles.tdProductNick}>{pNick}</Text> : null}
                      </View>
                      <Text style={styles.td} numberOfLines={1}>{chName}</Text>
                      <Text style={styles.td}>{fmtDate(a.startDate)}</Text>
                      <Text style={styles.td}>{fmtDate(a.endDate)}</Text>
                      <Text style={styles.td}>{fmtNum(a.totalTargetUnits)}</Text>
                      <Text style={styles.td}>{fmtVal(a.totalTargetValue, currency)}</Text>
                      <Text style={styles.td}>{currency}</Text>
                      <View style={styles.td}><StatusBadge status={a.status || 'active'} /></View>
                      <View style={[styles.td, styles.tdActions]}>
                        {/* View */}
                        <Pressable style={styles.actionBtn} onPress={() => navigation.navigate('TargetAssignmentDetails', { assignmentId: id })}>
                          <Ionicons name="eye-outline" size={15} color={colors.textSecondary} />
                        </Pressable>
                        {manager && (
                          <>
                            {/* Edit */}
                            <Pressable style={styles.actionBtn} onPress={() => navigation.navigate('TargetAssignmentForm', { mode: 'edit', assignmentId: id })}>
                              <Ionicons name="create-outline" size={15} color={colors.primary} />
                            </Pressable>
                            {/* Duplicate */}
                            <Pressable style={styles.actionBtn} onPress={() => navigation.navigate('TargetAssignmentForm', { mode: 'duplicate', assignmentId: id })}>
                              <Ionicons name="copy-outline" size={15} color="#7C3AED" />
                            </Pressable>
                            {/* Toggle */}
                            <Pressable style={styles.actionBtn} onPress={() => handleToggleStatus(a)} disabled={togglingId === id}>
                              {togglingId === id
                                ? <ActivityIndicator size={13} color={colors.textMuted} />
                                : <Ionicons name={a.status === 'active' ? 'pause-circle-outline' : 'play-circle-outline'} size={15} color={a.status === 'active' ? colors.danger : colors.success} />
                              }
                            </Pressable>
                          </>
                        )}
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          </ScrollView>
          <Pagination
            page={pagination.page}
            pages={pagination.pages}
            total={pagination.total}
            onPage={(pg) => { setPage(pg); fetchAssignments(pg); }}
          />
        </View>
      )}
    </AppShell>
  );
}

const shadow = { shadowColor: '#0B2B66', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } };

const styles = StyleSheet.create({
  pageHeader: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    marginBottom: globalHeight('1.2%'), flexWrap: 'wrap', gap: 12,
  },
  pageTitle: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  pageSubtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: 10, alignItems: 'center' },

  filtersRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center',
    marginBottom: globalHeight('1.2%'), zIndex: 20,
  },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 8, backgroundColor: colors.surface,
    minWidth: 220,
  },
  searchInput: { flex: 1, fontSize: 13, color: colors.textPrimary, outlineStyle: 'none' },

  filterBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.surface, maxWidth: 160,
  },
  filterBtnText: { fontSize: 13, color: colors.textPrimary, fontWeight: '600', flex: 1 },
  filterDropdown: {
    position: 'absolute', top: 40, left: 0, minWidth: 160,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 8, ...shadow, zIndex: 100,
  },
  filterOpt: { paddingHorizontal: 12, paddingVertical: 9 },
  filterOptActive: { backgroundColor: colors.primary + '15' },
  filterOptText: { fontSize: 13, color: colors.textPrimary },
  filterOptTextActive: { color: colors.primary, fontWeight: '700' },
  clearBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.backgroundColor },
  clearBtnText: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 40 },
  errorText: { fontSize: 14, color: colors.danger },

  tableCard: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, overflow: 'hidden', ...shadow,
  },
  tableHead: {
    flexDirection: 'row', backgroundColor: colors.backgroundColor,
    paddingHorizontal: 16, paddingVertical: 10, gap: 8,
  },
  th: { flex: 1, fontSize: 11, fontWeight: '800', color: colors.textSecondary, minWidth: 80 },
  tableRow: {
    flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: colors.border, alignItems: 'center', gap: 8,
  },
  td: { flex: 1, fontSize: 13, color: colors.textPrimary, minWidth: 80 },
  tdProduct: { flex: 1, minWidth: 100 },
  tdProductName: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  tdProductNick: { fontSize: 11, color: colors.textMuted, fontWeight: '700', marginTop: 1 },
  tdActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 4 },

  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, alignSelf: 'flex-start' },
  badgeText: { fontSize: 11, fontWeight: '700' },

  actionBtn: { padding: 6, borderRadius: 6 },

  emptyRow: { padding: 32, alignItems: 'center' },
  emptyRowText: { fontSize: 14, color: colors.textMuted },

  pagination: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 12, borderTopWidth: 1, borderTopColor: colors.border,
  },
  paginationInfo: { fontSize: 12, color: colors.textSecondary },
  paginationBtns: { flexDirection: 'row', gap: 4 },
  pageBtn: {
    minWidth: 32, height: 32, borderRadius: 6, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  pageBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  pageBtnDisabled: { opacity: 0.4 },
  pageBtnText: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  pageBtnTextActive: { color: colors.white },

  btnPrimary: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8,
  },
  btnPrimaryText: { color: colors.white, fontSize: 13, fontWeight: '700' },
  btnOutline: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: colors.primary,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8,
  },
  btnOutlineText: { color: colors.primary, fontSize: 13, fontWeight: '700' },
});
