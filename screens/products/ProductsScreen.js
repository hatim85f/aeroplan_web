import React, { useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AppShell from '../../components/AppShell';
import { colors } from '../../constants/colors';
import { globalHeight, globalWidth } from '../../constants/globalWidth';
import { listProducts, updateProductStatus, deleteProduct } from '../../store/products/productActions';
import { getLines } from '../../store/lines/linesActions';

const isManager = (role) =>
  ['admin', 'manager', 'senior_manager'].includes(String(role).toLowerCase());

const LINE_PILL_COLORS = [
  { bg: '#EDE9FE', text: '#5B21B6' },
  { bg: '#DBEAFE', text: '#1D4ED8' },
  { bg: '#FEF3C7', text: '#92400E' },
  { bg: '#D1FAE5', text: '#065F46' },
  { bg: '#FCE7F3', text: '#9D174D' },
  { bg: '#FFF3E0', text: '#E65100' },
];
const lineColor = (lineId) => LINE_PILL_COLORS[(lineId || '').charCodeAt(0) % LINE_PILL_COLORS.length];

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

function FocBadge({ value }) {
  if (value == null || value === '') return <Text style={styles.cellMuted}>—</Text>;
  return (
    <View style={styles.focBadge}>
      <Text style={styles.focBadgeText}>{value}%</Text>
    </View>
  );
}

function LineDropdown({ lines, value, onChange }) {
  const [open, setOpen] = useState(false);
  const selected = lines.find((l) => (l.lineId || l._id) === value);
  return (
    <View style={{ zIndex: 20 }}>
      <Pressable style={styles.filterBtn} onPress={() => setOpen((v) => !v)}>
        <Text style={styles.filterBtnText} numberOfLines={1}>
          {selected ? (selected.lineName || selected.name || selected.lineId) : 'All Lines'}
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={12} color={colors.textSecondary} />
      </Pressable>
      {open && (
        <View style={styles.filterDropdown}>
          <Pressable style={[styles.filterOpt, !value && styles.filterOptActive]} onPress={() => { onChange(''); setOpen(false); }}>
            <Text style={[styles.filterOptText, !value && styles.filterOptTextActive]}>All Lines</Text>
          </Pressable>
          {lines.map((l) => {
            const id = l.lineId || l._id;
            const label = l.lineName || l.name || id;
            return (
              <Pressable key={id} style={[styles.filterOpt, value === id && styles.filterOptActive]} onPress={() => { onChange(id); setOpen(false); }}>
                <Text style={[styles.filterOptText, value === id && styles.filterOptTextActive]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

function StatusDropdown({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const opts = [{ key: '', label: 'All Status' }, { key: 'active', label: 'Active' }, { key: 'inactive', label: 'Inactive' }];
  const sel = opts.find((o) => o.key === value);
  return (
    <View style={{ zIndex: 10 }}>
      <Pressable style={styles.filterBtn} onPress={() => setOpen((v) => !v)}>
        <Text style={styles.filterBtnText}>{sel?.label || 'All Status'}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={12} color={colors.textSecondary} />
      </Pressable>
      {open && (
        <View style={styles.filterDropdown}>
          {opts.map((o) => (
            <Pressable key={o.key} style={[styles.filterOpt, value === o.key && styles.filterOptActive]} onPress={() => { onChange(o.key); setOpen(false); }}>
              <Text style={[styles.filterOptText, value === o.key && styles.filterOptTextActive]}>{o.label}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

/* ─── Row actions menu ──────────────────────────────────────────────────── */
function RowMenu({ productId, isActive, onToggleStatus, onDelete, onClose }) {
  return (
    <View style={styles.rowMenu}>
      <Pressable style={styles.rowMenuItem} onPress={() => { onToggleStatus(productId, isActive); onClose(); }}>
        <Ionicons name={isActive ? 'pause-circle-outline' : 'play-circle-outline'} size={14} color={isActive ? colors.danger : colors.success} />
        <Text style={[styles.rowMenuText, { color: isActive ? colors.danger : colors.success }]}>
          {isActive ? 'Deactivate' : 'Activate'}
        </Text>
      </Pressable>
      <View style={styles.rowMenuDivider} />
      <Pressable style={styles.rowMenuItem} onPress={() => { onDelete(productId); onClose(); }}>
        <Ionicons name="trash-outline" size={14} color={colors.danger} />
        <Text style={[styles.rowMenuText, { color: colors.danger }]}>Delete</Text>
      </Pressable>
    </View>
  );
}

/* ─── Main ──────────────────────────────────────────────────────────────── */
export default function ProductsScreen({ navigation, userDetails, appMetadata, onSignOut }) {
  const user = userDetails?.user || userDetails?.data?.user || userDetails || {};
  const token = userDetails?.token || userDetails?.data?.token || '';
  const role = user.role || '';
  const managerRole = isManager(role);

  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [lineFilter, setLineFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState(managerRole ? '' : 'active');
  const [page, setPage] = useState(1);
  const [lines, setLines] = useState([]);
  const [openMenuId, setOpenMenuId] = useState(null);

  useEffect(() => {
    getLines(token).then((res) => {
      const list = Array.isArray(res) ? res : res?.lines || res?.data || [];
      setLines(list);
    }).catch(() => {});
  }, [token]);

  const fetchProducts = useCallback(async (pg = 1) => {
    setLoading(true);
    setError('');
    try {
      const params = {
        page: pg, limit: 20,
        ...(search ? { search } : {}),
        ...(lineFilter ? { lineId: lineFilter } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
      };
      const res = await listProducts(token, params);
      const list = Array.isArray(res.products) ? res.products : [];
      list.sort((a, b) =>
        (a.productName || a.name || '').localeCompare(b.productName || b.name || '', undefined, { sensitivity: 'base' })
      );
      setProducts(list);
      setPagination(res.pagination || { page: pg, limit: 20, total: 0, pages: 1 });
    } catch (e) {
      setError(e.message || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [token, search, lineFilter, statusFilter]);

  useEffect(() => {
    const t = setTimeout(() => { setPage(1); fetchProducts(1); }, 300);
    return () => clearTimeout(t);
  }, [search, lineFilter, statusFilter]);

  useEffect(() => { fetchProducts(page); }, [page]);

  const handleToggleStatus = async (id, currentlyActive) => {
    try {
      await updateProductStatus(token, id, { status: currentlyActive ? 'inactive' : 'active', isActive: !currentlyActive });
      fetchProducts(page);
    } catch (e) { alert(e.message || 'Failed to update status'); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this product? This action cannot be undone.')) return;
    try {
      await deleteProduct(token, id);
      fetchProducts(page);
    } catch (e) { alert(e.message || 'Failed to delete product'); }
  };

  const totalPages = pagination.pages || Math.ceil((pagination.total || 0) / 20) || 1;
  const activeCount = products.filter((p) => p.isActive !== false && p.status !== 'inactive').length;
  const inactiveCount = products.length - activeCount;
  const uniqueLines = [...new Set(products.map((p) => p.lineId || p.line?.lineId).filter(Boolean))].length;
  const avgFoc = (() => {
    const focs = products.flatMap((p) => ['direct', 'upp', 'institutional'].map((ch) => p.defaultFoc?.[ch]?.percentage).filter((v) => v != null && v !== ''));
    if (!focs.length) return null;
    return (focs.reduce((a, b) => a + Number(b), 0) / focs.length).toFixed(1);
  })();

  const handlePageChange = (p) => {
    if (p < 1 || p > totalPages) return;
    setPage(p);
  };

  const clearFilters = () => {
    setSearch('');
    setLineFilter('');
    setStatusFilter(managerRole ? '' : 'active');
  };

  return (
    <AppShell navigation={navigation} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} activeRoute="Products">
      {/* Header */}
      <View style={styles.pageHeader}>
        <View>
          <Text style={styles.pageTitle}>Products</Text>
          <Text style={styles.pageSubtitle}>Manage and track all your products and pricing</Text>
        </View>
        {managerRole && (
          <View style={styles.headerActions}>
            <Pressable
              style={styles.btnOutline}
              onPress={() => navigation.navigate('ProductBulkImport')}
            >
              <Ionicons name="cloud-upload-outline" size={15} color={colors.primary} />
              <Text style={styles.btnOutlineText}>Bulk Import</Text>
            </Pressable>
            <Pressable
              style={styles.btnPrimary}
              onPress={() => navigation.navigate('ProductForm', { mode: 'create' })}
            >
              <Ionicons name="add" size={16} color={colors.white} />
              <Text style={styles.btnPrimaryText}>Add Product</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <StatCard icon="cube-outline" iconColor="#0F6FFF" iconBg="#E8F0FF" label="Total Products" value={pagination.total || products.length} sub="" />
        <StatCard icon="checkmark-circle-outline" iconColor="#18C287" iconBg="#E7F8EF" label="Active Products" value={activeCount} sub={products.length ? `${Math.round(activeCount / Math.max(products.length, 1) * 100)}% of total` : ''} />
        {managerRole && <StatCard icon="close-circle-outline" iconColor="#EF4444" iconBg="#FEF2F2" label="Inactive Products" value={inactiveCount} sub={products.length ? `${Math.round(inactiveCount / Math.max(products.length, 1) * 100)}% of total` : ''} />}
        <StatCard icon="layers-outline" iconColor="#8B5CF6" iconBg="#F5F0FF" label="Total Lines" value={uniqueLines} sub="Product lines" />
        <StatCard icon="trending-up-outline" iconColor="#F97316" iconBg="#FFF3E0" label="Avg. FOC" value={avgFoc != null ? `${avgFoc}%` : '—'} sub="Across all products" />
      </View>

      {/* Table card */}
      <View style={styles.tableCard}>
        {/* Toolbar */}
        <View style={styles.toolbar}>
          <View style={styles.searchWrap}>
            <Ionicons name="search" size={14} color={colors.textSecondary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search products by name, nickname, or description..."
              placeholderTextColor={colors.textSecondary}
              value={search}
              onChangeText={setSearch}
            />
            {search ? <Pressable onPress={() => setSearch('')}><Ionicons name="close-circle" size={15} color={colors.textMuted} /></Pressable> : null}
          </View>
          <LineDropdown lines={lines} value={lineFilter} onChange={setLineFilter} />
          {managerRole && <StatusDropdown value={statusFilter} onChange={setStatusFilter} />}
          {(search || lineFilter || statusFilter) ? (
            <Pressable style={styles.clearBtn} onPress={clearFilters}>
              <Ionicons name="refresh-outline" size={13} color={colors.textSecondary} />
              <Text style={styles.clearBtnText}>Clear</Text>
            </Pressable>
          ) : null}
        </View>

        {/* Table head */}
        <View style={styles.tableHead}>
          <Text style={[styles.th, { flex: 2.8 }]}>Product</Text>
          <Text style={[styles.th, { flex: 1.2 }]}>Nickname</Text>
          <Text style={[styles.th, { flex: 1.2 }]}>Line</Text>
          {managerRole && <Text style={[styles.th, { flex: 0.9 }]}>Status</Text>}
          <Text style={[styles.th, { flex: 3 }]}>Channel Summary</Text>
          <Text style={[styles.th, { flex: 0.9 }]}>Default FOC</Text>
          <Text style={[styles.th, { flex: 1.2 }]}>Actions</Text>
        </View>

        {loading ? (
          <View style={styles.centered}><ActivityIndicator size="small" color={colors.primary} /><Text style={styles.loadingText}>Loading products...</Text></View>
        ) : error ? (
          <View style={styles.centered}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.retryBtn} onPress={() => fetchProducts(page)}><Text style={styles.retryText}>Retry</Text></Pressable>
          </View>
        ) : products.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="cube-outline" size={36} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No products found</Text>
            <Text style={styles.emptyText}>Try adjusting your search or filters.</Text>
          </View>
        ) : (
          products.map((product, idx) => {
            const id = product._id || product.id;
            const name = product.productName || product.name || '—';
            const nickname = product.productNickname || product.nickname || '—';
            const lineId = product.lineId || product.line?.lineId || '—';
            const lineName = product.lineName || product.line?.lineName || product.line?.name || lineId;
            const active = product.isActive !== false && product.status !== 'inactive';
            const lc = lineColor(lineId);
            const focPct = product.defaultFoc?.direct?.percentage ?? product.defaultFoc?.upp?.percentage ?? null;
            const direct = product.prices?.direct;
            const upp = product.prices?.upp;
            const inst = product.prices?.institutional;
            const menuOpen = openMenuId === id;

            return (
              <Pressable
                key={id || idx}
                style={[styles.tableRow, idx % 2 === 1 && styles.tableRowAlt]}
                onPress={() => navigation.navigate('ProductDetail', { productId: id })}
              >
                {/* Product */}
                <View style={[styles.td, { flex: 2.8 }]}>
                  <View style={styles.productCell}>
                    {product.imageUrl ? (
                      <Image source={{ uri: product.imageUrl }} style={styles.productThumb} resizeMode="cover" />
                    ) : (
                      <View style={styles.productThumbPlaceholder}>
                        <Ionicons name="cube-outline" size={18} color={colors.textMuted} />
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cellPrimary} numberOfLines={1}>{name}</Text>
                      <Text style={styles.cellSub} numberOfLines={1}>{product.description || ''}</Text>
                    </View>
                  </View>
                </View>

                {/* Nickname */}
                <View style={[styles.td, { flex: 1.2 }]}>
                  <Text style={styles.cellMono} numberOfLines={1}>{nickname}</Text>
                </View>

                {/* Line */}
                <View style={[styles.td, { flex: 1.2 }]}>
                  <View style={[styles.linePill, { backgroundColor: lc.bg }]}>
                    <Text style={[styles.linePillText, { color: lc.text }]} numberOfLines={1}>{lineName}</Text>
                  </View>
                </View>

                {/* Status (manager only) */}
                {managerRole && (
                  <View style={[styles.td, { flex: 0.9 }]}>
                    <View style={styles.statusRow}>
                      <View style={[styles.statusDot, { backgroundColor: active ? colors.success : colors.danger }]} />
                      <Text style={[styles.statusText, { color: active ? colors.success : colors.danger }]}>{active ? 'Active' : 'Inactive'}</Text>
                    </View>
                  </View>
                )}

                {/* Channel Summary */}
                <View style={[styles.td, { flex: 3 }]}>
                  <View style={styles.channelSummary}>
                    {[
                      { label: 'Direct', data: direct },
                      { label: 'UPP', data: upp },
                      { label: 'Inst.', data: inst },
                    ].map(({ label, data }) => (
                      <View key={label} style={styles.channelCol}>
                        <Text style={styles.channelLabel}>{label}</Text>
                        <Text style={styles.channelPrice}>
                          {data?.cifUsd != null ? `$${Number(data.cifUsd).toFixed(2)}` : '—'}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>

                {/* Default FOC */}
                <View style={[styles.td, { flex: 0.9 }]}>
                  <FocBadge value={focPct} />
                </View>

                {/* Actions */}
                <View style={[styles.td, { flex: 1.2, flexDirection: 'row', gap: 4, alignItems: 'center' }]}>
                  <Pressable style={styles.actionIcon} onPress={(e) => { e.stopPropagation(); navigation.navigate('ProductDetail', { productId: id }); }}>
                    <Ionicons name="eye-outline" size={15} color={colors.textSecondary} />
                  </Pressable>
                  {managerRole && (
                    <>
                      <Pressable style={styles.actionIcon} onPress={(e) => { e.stopPropagation(); navigation.navigate('ProductForm', { mode: 'edit', productId: id }); }}>
                        <Ionicons name="pencil-outline" size={15} color={colors.primary} />
                      </Pressable>
                      <View>
                        <Pressable style={styles.actionIcon} onPress={(e) => { e.stopPropagation(); setOpenMenuId(menuOpen ? null : id); }}>
                          <Ionicons name="ellipsis-vertical" size={15} color={colors.textSecondary} />
                        </Pressable>
                        {menuOpen && (
                          <RowMenu
                            productId={id}
                            isActive={active}
                            onToggleStatus={handleToggleStatus}
                            onDelete={handleDelete}
                            onClose={() => setOpenMenuId(null)}
                          />
                        )}
                      </View>
                    </>
                  )}
                </View>
              </Pressable>
            );
          })
        )}

        {/* Pagination */}
        {!loading && products.length > 0 && (
          <View style={styles.pagination}>
            <Text style={styles.paginationInfo}>
              Showing {((page - 1) * 20) + 1}–{Math.min(page * 20, pagination.total || products.length)} of {pagination.total || products.length} products
            </Text>
            <View style={styles.pageButtons}>
              <Pressable style={[styles.pageBtn, page <= 1 && styles.pageBtnDisabled]} onPress={() => handlePageChange(page - 1)} disabled={page <= 1}>
                <Ionicons name="chevron-back" size={14} color={page <= 1 ? colors.textMuted : colors.textPrimary} />
              </Pressable>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => Math.max(1, Math.min(page - 2, totalPages - 4)) + i)
                .filter((p) => p >= 1 && p <= totalPages)
                .map((p) => (
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

const shadow = { shadowColor: '#0B2B66', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } };

const styles = StyleSheet.create({
  pageHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: globalHeight('1.5%'), flexWrap: 'wrap', gap: 10 },
  pageTitle: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  pageSubtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 3 },

  statsRow: { flexDirection: 'row', gap: 12, marginBottom: globalHeight('1.5%'), flexWrap: 'wrap' },
  statCard: { flex: 1, minWidth: 150, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.surface, padding: 14, ...shadow },
  statIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  statBody: { flex: 1 },
  statLabel: { fontSize: 11, color: colors.textSecondary, marginBottom: 2 },
  statValue: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  statSub: { fontSize: 11, color: colors.textMuted, marginTop: 1 },

  tableCard: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.surface, overflow: 'hidden', ...shadow },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border, flexWrap: 'wrap' },
  searchWrap: { flex: 1, minWidth: 220, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, height: 36 },
  searchInput: { flex: 1, fontSize: 13, color: colors.textPrimary, outlineStyle: 'none' },

  filterBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, height: 36, minWidth: 110, backgroundColor: colors.surface },
  filterBtnText: { flex: 1, fontSize: 12, color: colors.textPrimary },
  filterDropdown: { position: 'absolute', top: 38, left: 0, right: 0, minWidth: 140, borderWidth: 1, borderColor: colors.border, borderRadius: 8, backgroundColor: colors.surface, zIndex: 100, ...shadow },
  filterOpt: { paddingHorizontal: 12, paddingVertical: 9 },
  filterOptActive: { backgroundColor: colors.primary + '12' },
  filterOptText: { fontSize: 13, color: colors.textPrimary },
  filterOptTextActive: { color: colors.primary, fontWeight: '700' },
  clearBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  clearBtnText: { fontSize: 12, color: colors.textSecondary },

  tableHead: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.backgroundColor, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  th: { fontSize: 11, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase' },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  tableRowAlt: { backgroundColor: colors.backgroundColor + '55' },
  td: { justifyContent: 'center', paddingRight: 8 },

  productCell: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  productThumb: { width: 40, height: 40, borderRadius: 6, backgroundColor: colors.backgroundColor, flexShrink: 0 },
  productThumbPlaceholder: { width: 40, height: 40, borderRadius: 6, backgroundColor: colors.backgroundColor, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },

  cellPrimary: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  cellSub: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  cellMono: { fontSize: 12, color: colors.textSecondary, fontFamily: 'monospace' },
  cellMuted: { fontSize: 12, color: colors.textMuted },

  linePill: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  linePillText: { fontSize: 11, fontWeight: '700' },

  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: '600' },

  channelSummary: { flexDirection: 'row', gap: 12 },
  channelCol: { alignItems: 'flex-start' },
  channelLabel: { fontSize: 10, fontWeight: '700', color: colors.textMuted, marginBottom: 2 },
  channelPrice: { fontSize: 12, fontWeight: '700', color: colors.textPrimary },

  focBadge: { alignSelf: 'flex-start', backgroundColor: '#E7F8EF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  focBadgeText: { fontSize: 11, fontWeight: '700', color: colors.success },

  actionIcon: { width: 28, height: 28, borderRadius: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.backgroundColor },

  rowMenu: { position: 'absolute', right: 0, top: 30, width: 150, borderWidth: 1, borderColor: colors.border, borderRadius: 8, backgroundColor: colors.surface, zIndex: 200, ...shadow },
  rowMenuItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10 },
  rowMenuText: { fontSize: 13, fontWeight: '600' },
  rowMenuDivider: { height: 1, backgroundColor: colors.border },

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

  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  btnPrimary: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 9, borderRadius: 8 },
  btnPrimaryText: { color: colors.white, fontSize: 13, fontWeight: '700' },
  btnOutline: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.primary, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8 },
  btnOutlineText: { color: colors.primary, fontSize: 13, fontWeight: '700' },
});
