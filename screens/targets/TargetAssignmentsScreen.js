import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AppShell from '../../components/AppShell';
import { colors } from '../../constants/colors';
import { globalHeight, globalWidth } from '../../constants/globalWidth';
import {
  listTargetAssignments,
  getTargetOverview,
  updateTargetAssignmentStatus,
  deleteTargetAssignment,
} from '../../store/targets/targetAssignmentActions';
import { listAllMedicalReps } from '../../store/teams/teamsActions';
import { listProducts } from '../../store/products/productActions';
import { listSalesChannels } from '../../store/salesChannels/salesChannelActions';

const isManager = (role) =>
  ['admin', 'manager', 'senior_manager'].includes(String(role).toLowerCase());

const THIS_YEAR = new Date().getFullYear();

const STATUS_STYLE = {
  active:   { bg: '#DCFCE7', text: '#15803D' },
  inactive: { bg: '#F1F5F9', text: '#64748B' },
};

const getAssignmentProductName = (assignment = {}) => {
  const product = assignment.productId || {};
  return product.productName || product.name || assignment.productName || '';
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

  const [sortOrder, setSortOrder] = useState(null); // null | 'asc' | 'desc'
  const sortOrderRef = useRef(null); // mirrors sortOrder, readable synchronously inside callbacks

  const [deletingId, setDeletingId] = useState('');
  const [togglingId, setTogglingId] = useState('');

  const [overview, setOverview] = useState(null);

  /* load overview stats — refetch when year filter changes */
  useEffect(() => {
    getTargetOverview(token, { year: filterYear }).then(setOverview).catch(() => {});
  }, [token, filterYear]);

  /* load filter options — medical reps come from teams, NOT sales team */
  useEffect(() => {
    listAllMedicalReps(token).then((data) => setReps(Array.isArray(data) ? data : [])).catch(() => {});
    listProducts(token, { limit: 200, status: 'active' }).then(({ products: p }) => setProducts(p)).catch(() => {});
    listSalesChannels(token, { status: 'active' }).then(({ channels: c }) => setChannels(c)).catch(() => {});
  }, [token]);

  const fetchAssignments = useCallback(async (pg = 1) => {
    setLoading(true);
    setError('');
    try {
      const so = sortOrderRef.current; // always the latest value, no stale closure
      const isSorting = so !== null;
      const params = isSorting ? { page: 1, limit: 9999 } : { page: pg, limit: 20 };
      if (filterYear)    params.year      = filterYear;
      if (filterRep)     params.userId    = filterRep;
      if (filterProduct) params.productId = filterProduct;
      if (filterChannel) params.channelId = filterChannel;
      if (filterStatus)  params.status    = filterStatus;
      if (search.trim()) params.search    = search.trim();
      const res = await listTargetAssignments(token, params);
      setAssignments(res.assignments);
      setPagination(isSorting
        ? { page: 1, limit: res.assignments.length, total: res.assignments.length, pages: 1 }
        : res.pagination);
    } catch (e) {
      setError(e.message || 'Failed to load assignments');
    } finally {
      setLoading(false);
    }
  }, [token, filterYear, filterRep, filterProduct, filterChannel, filterStatus, search]);
  // sortOrder intentionally omitted — read via sortOrderRef.current to avoid stale closure

  useEffect(() => { setPage(1); fetchAssignments(1); }, [filterYear, filterRep, filterProduct, filterChannel, filterStatus, fetchAssignments]);

  // sortOrder change: update ref first (synchronous), then refetch
  useEffect(() => {
    sortOrderRef.current = sortOrder;
    setPage(1);
    fetchAssignments(1);
  }, [sortOrder]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const t = setTimeout(() => { setPage(1); fetchAssignments(1); }, 350);
    return () => clearTimeout(t);
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

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

  /* Medical rep ID: prefer userId (user account ref), then medicalRepId, then _id */
  const repOpts = [
    { value: '', label: 'All Reps' },
    ...reps.map((r) => ({
      value: r.userId || r.medicalRepId || r._id || r.id || '',
      label: r.fullName || r.name || r.email || r.medicalRepId || r._id || 'Unknown Rep',
    })),
  ];
  const prodOpts  = [{ value: '', label: 'All Products' }, ...products.map((p) => ({ value: p._id || p.productId, label: `${p.productName || p.name}${p.productNickname ? ` (${p.productNickname})` : ''}` }))];
  const chanOpts  = [{ value: '', label: 'All Channels' }, ...channels.map((c) => ({ value: c._id || c.channelId, label: c.channelName || c.channelKey }))];
  const statOpts  = [
    { value: '', label: 'All Status' },
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
  ];
  const yearOpts = [{ value: '', label: 'All Years' }, ...[THIS_YEAR - 1, THIS_YEAR, THIS_YEAR + 1].map((y) => ({ value: String(y), label: String(y) }))];

  /* overview-derived stats */
  const totalValue    = overview?.totalTargetValue ?? null;
  const totalUnits    = overview?.totalTargetUnits ?? null;
  const productCount  = Array.isArray(overview?.targetByProduct) ? overview.targetByProduct.length : null;
  const byChannel     = Array.isArray(overview?.targetByChannel) ? overview.targetByChannel : [];
  const activeCount   = overview?.activeAssignmentsCount ?? null;

  const fmtCompact = (n) => {
    if (n == null) return '—';
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}K`;
    return `$${n}`;
  };
  const fmtDate = (d) => d ? d.slice(0, 10) : '—';
  const fmtNum  = (n) => n != null ? Number(n).toLocaleString() : '—';
  const fmtVal  = (v, cur) => {
    if (v == null) return '—';
    const sym = cur === 'AED' ? 'AED ' : '$';
    return `${sym}${Number(v).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  };

  const sortedAssignments = useMemo(() => {
    if (!sortOrder) return assignments;
    return [...assignments].sort((a, b) => {
      const nameA = getAssignmentProductName(a);
      const nameB = getAssignmentProductName(b);
      return sortOrder === 'asc'
        ? nameA.localeCompare(nameB, undefined, { sensitivity: 'base' })
        : nameB.localeCompare(nameA, undefined, { sensitivity: 'base' });
    });
  }, [assignments, sortOrder]);

  const handleSortAZ  = () => setSortOrder((prev) => prev === 'asc'  ? null : 'asc');
  const handleSortZA  = () => setSortOrder((prev) => prev === 'desc' ? null : 'desc');

  const COL_HEADS = ['Medical Rep', 'Product', 'Channel', 'Start', 'End', 'Units', 'Value', 'Currency', 'Status', 'Actions'];

  return (
    <AppShell navigation={navigation} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} activeRoute="TargetAssignments" scrollable={false}>
      <View style={styles.screen}>

        {/* ── Top section: title + filters (padded) ── */}
        <View style={styles.topSection}>
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

          {/* ── Stats bar ── */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statsScroll} contentContainerStyle={styles.statsRow}>
            <View style={styles.statPill}>
              <Text style={styles.statPillLabel}>Products</Text>
              <Text style={styles.statPillValue}>{productCount ?? '—'}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statPill}>
              <Text style={styles.statPillLabel}>Total Value</Text>
              <Text style={styles.statPillValue}>{fmtCompact(totalValue)}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statPill}>
              <Text style={styles.statPillLabel}>Total Units</Text>
              <Text style={styles.statPillValue}>{totalUnits != null ? Number(totalUnits).toLocaleString() : '—'}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statPill}>
              <Text style={styles.statPillLabel}>Active</Text>
              <Text style={[styles.statPillValue, { color: '#15803D' }]}>{activeCount ?? '—'}</Text>
            </View>
            {byChannel.map((ch, i) => (
              <React.Fragment key={ch.id || i}>
                <View style={styles.statDivider} />
                <View style={styles.statPill}>
                  <Text style={styles.statPillLabel}>{ch.name || 'Channel'}</Text>
                  <Text style={styles.statPillValue}>{fmtCompact(ch.totalTargetValue)}</Text>
                </View>
              </React.Fragment>
            ))}
          </ScrollView>

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
            <Pressable
              style={[styles.sortBtn, sortOrder === 'asc' && styles.sortBtnActive]}
              onPress={handleSortAZ}
            >
              <Ionicons name="arrow-up-outline" size={13} color={sortOrder === 'asc' ? colors.primary : colors.textSecondary} />
              <Text style={[styles.sortBtnText, sortOrder === 'asc' && styles.sortBtnTextActive]}>A → Z</Text>
            </Pressable>
            <Pressable
              style={[styles.sortBtn, sortOrder === 'desc' && styles.sortBtnActive]}
              onPress={handleSortZA}
            >
              <Ionicons name="arrow-down-outline" size={13} color={sortOrder === 'desc' ? colors.primary : colors.textSecondary} />
              <Text style={[styles.sortBtnText, sortOrder === 'desc' && styles.sortBtnTextActive]}>Z → A</Text>
            </Pressable>
          </View>
        </View>

        {/* ── Table: fills remaining height ── */}
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
          <View style={styles.tableContainer}>
            {/* Sticky header */}
            <View style={styles.tableHead}>
              {COL_HEADS.map((h) => (
                <Text key={h} style={[styles.th, h === 'Actions' && styles.thRight]}>{h}</Text>
              ))}
            </View>

            {/* Scrollable rows */}
            <ScrollView
              style={{ flex: 1 }}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ flexGrow: 1 }}
            >
              {sortedAssignments.length === 0 ? (
                <View style={styles.emptyRow}>
                  <Ionicons name="flag-outline" size={28} color={colors.textMuted} />
                  <Text style={styles.emptyRowText}>No target assignments found</Text>
                </View>
              ) : (
                sortedAssignments.map((a) => {
                  const id      = a._id || a.id;
                  const product = a.productId || {};
                  const channel = a.channelId || {};
                  const repUser = a.userId || a.repId || {};
                  const repName = repUser.fullName || repUser.name || repUser.email || a.repName || '—';
                  const pName   = getAssignmentProductName(a) || '—';
                  const pNick   = product.productNickname || a.productNickname || '';
                  const chName  = channel.channelName || channel.channelKey || a.channelName || '—';
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
                        <Pressable style={styles.actionBtn} onPress={() => navigation.navigate('TargetAssignmentDetails', { assignmentId: id })}>
                          <Ionicons name="eye-outline" size={15} color={colors.textSecondary} />
                        </Pressable>
                        {manager && (
                          <>
                            <Pressable style={styles.actionBtn} onPress={() => navigation.navigate('TargetAssignmentForm', { mode: 'edit', assignmentId: id })}>
                              <Ionicons name="create-outline" size={15} color={colors.primary} />
                            </Pressable>
                            <Pressable style={styles.actionBtn} onPress={() => navigation.navigate('TargetAssignmentForm', { mode: 'duplicate', assignmentId: id })}>
                              <Ionicons name="copy-outline" size={15} color="#7C3AED" />
                            </Pressable>
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
            </ScrollView>

            {/* Pagination pinned to bottom — hidden when sort is active (all data loaded) */}
            {!sortOrder && (
              <Pagination
                page={pagination.page}
                pages={pagination.pages}
                total={pagination.total}
                onPage={(pg) => { setPage(pg); fetchAssignments(pg); }}
              />
            )}
          </View>
        )}
      </View>
    </AppShell>
  );
}

const shadow = { shadowColor: '#0B2B66', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } };
const PAD = globalWidth('1.3%');

const styles = StyleSheet.create({
  /* Full-screen container */
  screen: {
    flex: 1,
    flexDirection: 'column',
    overflow: Platform.OS === 'web' ? 'hidden' : undefined,
  },

  /* Padded top area */
  topSection: {
    paddingHorizontal: PAD,
    paddingTop: PAD,
    paddingBottom: globalHeight('0.6%'),
    backgroundColor: colors.backgroundColor,
    zIndex: 30,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pageHeader: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    marginBottom: globalHeight('0.8%'), flexWrap: 'wrap', gap: 12,
  },
  pageTitle: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  pageSubtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: 10, alignItems: 'center' },

  /* Stats bar */
  statsScroll: { marginBottom: globalHeight('0.6%') },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 0, paddingVertical: 4 },
  statPill: { paddingHorizontal: 14, paddingVertical: 2, alignItems: 'center', gap: 1 },
  statPillLabel: { fontSize: 10, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  statPillValue: { fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  statDivider: { width: 1, height: 28, backgroundColor: colors.border, marginHorizontal: 4 },

  filtersRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center', zIndex: 20,
  },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 7, backgroundColor: colors.surface,
    minWidth: 200,
  },
  searchInput: { flex: 1, fontSize: 13, color: colors.textPrimary, outlineStyle: 'none' },

  filterBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 7, backgroundColor: colors.surface, maxWidth: 150,
  },
  filterBtnText: { fontSize: 12, color: colors.textPrimary, fontWeight: '600', flex: 1 },
  filterDropdown: {
    position: 'absolute', top: 38, left: 0, minWidth: 160,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 8, ...shadow, zIndex: 100,
  },
  filterOpt: { paddingHorizontal: 12, paddingVertical: 9 },
  filterOptActive: { backgroundColor: colors.primary + '15' },
  filterOptText: { fontSize: 13, color: colors.textPrimary },
  filterOptTextActive: { color: colors.primary, fontWeight: '700' },
  clearBtn: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, backgroundColor: colors.backgroundColor },
  clearBtnText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },

  /* Table fills remaining */
  tableContainer: {
    flex: 1,
    backgroundColor: colors.surface,
    overflow: Platform.OS === 'web' ? 'hidden' : undefined,
  },
  tableHead: {
    flexDirection: 'row',
    backgroundColor: colors.primary + '0C',
    paddingHorizontal: PAD,
    paddingVertical: 11,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.primary + '30',
  },
  th: { flex: 1, fontSize: 11, fontWeight: '800', color: colors.primary, minWidth: 80 },
  thRight: { textAlign: 'right' },

  tableRow: {
    flexDirection: 'row',
    paddingHorizontal: PAD,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    alignItems: 'center',
  },
  td: { flex: 1, fontSize: 13, color: colors.textPrimary, minWidth: 80 },
  tdProduct: { flex: 1, minWidth: 100 },
  tdProductName: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  tdProductNick: { fontSize: 11, color: colors.textMuted, fontWeight: '700', marginTop: 1 },
  tdActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 2 },

  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, alignSelf: 'flex-start' },
  badgeText: { fontSize: 11, fontWeight: '700' },
  actionBtn: { padding: 7, borderRadius: 6 },

  emptyRow: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 60 },
  emptyRowText: { fontSize: 14, color: colors.textMuted },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 40 },
  errorText: { fontSize: 14, color: colors.danger },

  pagination: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: PAD, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: colors.border,
    backgroundColor: colors.surface,
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

  sortBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 7, backgroundColor: colors.surface,
  },
  sortBtnActive: { borderColor: colors.primary, backgroundColor: colors.primary + '10' },
  sortBtnText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  sortBtnTextActive: { color: colors.primary },
});
