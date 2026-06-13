import React, { useState, useEffect, useMemo } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AppShell from '../../components/AppShell';
import { colors } from '../../constants/colors';
import { globalWidth } from '../../constants/globalWidth';
import * as XLSX from 'xlsx';
import { getSalesChannelItems } from '../../store/sales/salesActions';
import { listSalesChannels } from '../../store/salesChannels/salesChannelActions';
import { listProducts } from '../../store/products/productActions';
import { getAccounts } from '../../store/accounts/accountActions';

const THIS_YEAR  = new Date().getFullYear();
const THIS_MONTH = String(new Date().getMonth() + 1);

const YEAR_OPTS = [THIS_YEAR - 1, THIS_YEAR, THIS_YEAR + 1].map((y) => ({
  value: String(y), label: String(y),
}));
const MONTH_OPTS = [
  { value: '', label: 'All Months' },
  { value: '1', label: 'January' }, { value: '2', label: 'February' },
  { value: '3', label: 'March' }, { value: '4', label: 'April' },
  { value: '5', label: 'May' }, { value: '6', label: 'June' },
  { value: '7', label: 'July' }, { value: '8', label: 'August' },
  { value: '9', label: 'September' }, { value: '10', label: 'October' },
  { value: '11', label: 'November' }, { value: '12', label: 'December' },
];

const fmtQty = (n) => {
  if (n == null) return '—';
  const num = Number(n);
  return num % 1 === 0 ? num.toLocaleString('en-US') : num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const fmtFixed2 = (n) => {
  if (n == null) return '—';
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const fmtCurrency = (v, cur = 'USD') => {
  if (v == null) return '—';
  const sym = cur === 'AED' ? 'AED ' : '$';
  return `${sym}${Number(v).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
};

const shadow = { shadowColor: '#11224A', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 14, elevation: 3 };

/* ── FilterDropdown ── */
function FilterDropdown({ label, options, value, onChange, zIndex = 1 }) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  return (
    <View style={{ position: 'relative', zIndex: open ? 60 : zIndex }}>
      <Pressable style={styles.filterBtn} onPress={() => setOpen((v) => !v)}>
        {label ? <Text style={styles.filterBtnLabel}>{label}</Text> : null}
        <Text style={styles.filterBtnValue} numberOfLines={1}>{selected?.label || 'All'}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={11} color={colors.textMuted} />
      </Pressable>
      {open && (
        <View style={styles.filterDropdown}>
          <ScrollView style={{ maxHeight: 220 }} nestedScrollEnabled>
            {options.map((opt) => (
              <Pressable
                key={String(opt.value)}
                style={[styles.filterOpt, opt.value === value && styles.filterOptActive]}
                onPress={() => { onChange(opt.value); setOpen(false); }}
              >
                <Text style={[styles.filterOptText, opt.value === value && styles.filterOptTextActive]}>
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

/* ── SearchableDropdown — for accounts list ── */
function SearchableDropdown({ label, options, value, onChange, zIndex = 1, placeholder = 'Search…' }) {
  const [open,   setOpen]   = useState(false);
  const [search, setSearch] = useState('');
  const selected = options.find((o) => o.value === value);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => String(o.label).toLowerCase().includes(q));
  }, [options, search]);
  const handleSelect = (opt) => { onChange(opt.value); setOpen(false); setSearch(''); };
  return (
    <View style={{ position: 'relative', zIndex: open ? 65 : zIndex }}>
      <Pressable style={styles.filterBtn} onPress={() => setOpen((v) => !v)}>
        {label ? <Text style={styles.filterBtnLabel}>{label}</Text> : null}
        <Text style={[styles.filterBtnValue, !value && { color: colors.textMuted }]} numberOfLines={1}>
          {selected?.label || 'All Accounts'}
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={11} color={colors.textMuted} />
      </Pressable>
      {open && (
        <View style={[styles.filterDropdown, { minWidth: 240 }]}>
          <View style={styles.searchInputWrap}>
            <Ionicons name="search-outline" size={13} color={colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder={placeholder}
              placeholderTextColor={colors.textMuted}
              value={search}
              onChangeText={setSearch}
              autoFocus
            />
          </View>
          <Text style={styles.searchCount}>{filtered.length} result{filtered.length !== 1 ? 's' : ''}</Text>
          <ScrollView style={{ maxHeight: 220 }} nestedScrollEnabled>
            {filtered.map((opt) => (
              <Pressable
                key={String(opt.value)}
                style={[styles.filterOpt, opt.value === value && styles.filterOptActive]}
                onPress={() => handleSelect(opt)}
              >
                <Text style={[styles.filterOptText, opt.value === value && styles.filterOptTextActive]} numberOfLines={1}>
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

/* ── Main screen ── */
export default function SalesTableScreen({ navigation, userDetails, appMetadata, onSignOut }) {
  const token = userDetails?.token || userDetails?.data?.token || '';

  /* Pending filter state */
  const [pendingYear,    setPendingYear]    = useState(String(THIS_YEAR));
  // Default to "All Months" so the full year's sales load, not just the current month.
  const [pendingMonth,   setPendingMonth]   = useState('');
  const [pendingChannel, setPendingChannel] = useState('');
  const [pendingAccount, setPendingAccount] = useState('');
  const [pendingProduct, setPendingProduct] = useState('');

  /* appliedParams drives the fetch — null = not yet loaded */
  const [appliedParams, setAppliedParams] = useState(null);

  /* Filter option lists */
  const [channels, setChannels] = useState([]);
  const [products, setProducts] = useState([]);
  const [accounts, setAccounts] = useState([]);

  /* Data */
  const [rows,       setRows]       = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');
  const [hoveredRow, setHoveredRow] = useState(null);

  /* Load filter option lists once */
  useEffect(() => {
    listSalesChannels(token, { status: 'active' })
      .then(({ channels: c }) => setChannels(Array.isArray(c) ? c : []))
      .catch(() => {});

    listProducts(token, { limit: 300, status: 'active' })
      .then(({ products: p }) => setProducts(Array.isArray(p) ? p : []))
      .catch(() => {});

    (async () => {
      try {
        const PAGE_SIZE = 200;
        const first = await getAccounts(token, { limit: PAGE_SIZE, page: 1 });
        const totalPages = first.pagination?.pages || 1;
        let all = Array.isArray(first.accounts) ? first.accounts : [];
        if (totalPages > 1) {
          const rest = await Promise.all(
            Array.from({ length: totalPages - 1 }, (_, i) =>
              getAccounts(token, { limit: PAGE_SIZE, page: i + 2 })
            )
          );
          rest.forEach(({ accounts: a }) => { if (Array.isArray(a)) all = [...all, ...a]; });
        }
        setAccounts(all);
      } catch { /* ignore */ }
    })();
  }, [token]);

  /* Fetch when appliedParams changes */
  useEffect(() => {
    if (!appliedParams) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      setRows([]);
      try {
        const params = {};
        if (appliedParams.year)    params.year      = appliedParams.year;
        if (appliedParams.month)   params.month     = appliedParams.month;
        if (appliedParams.channel) params.channelId = appliedParams.channel;
        if (appliedParams.account) params.accountId = appliedParams.account;
        if (appliedParams.product) params.productId = appliedParams.product;

        const data = await getSalesChannelItems(token, params);
        if (cancelled) return;
        const sorted = Array.isArray(data)
          ? [...data].sort((a, b) => String(a.itemName || '').localeCompare(String(b.itemName || '')))
          : [];
        setRows(sorted);
      } catch (e) {
        if (!cancelled) setError(e.message || 'Failed to load sales data');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [appliedParams, token]);

  const handleApply = () => {
    setAppliedParams({
      year:    pendingYear,
      month:   pendingMonth,
      channel: pendingChannel,
      account: pendingAccount,
      product: pendingProduct,
    });
  };

  const handleClear = () => {
    setPendingYear(String(THIS_YEAR));
    setPendingMonth('');
    setPendingChannel('');
    setPendingAccount('');
    setPendingProduct('');
    setAppliedParams(null);
    setRows([]);
    setError('');
  };

  const handleExport = () => {
    if (!rows.length) return;
    const header = ['Sales Channel', 'Item Name', 'CIF', 'QTY', 'CIF (USD)', 'Value (AED)'];
    const data = rows.map((r) => [
      r.channelName  || '',
      r.itemName     || '',
      r.target_CIF   != null ? Number(r.target_CIF).toFixed(2) : '',
      r.qty          != null ? Number(r.qty)   : '',
      r.cif          != null ? Number(r.cif)   : '',
      r.value        != null ? Number(r.value) : '',
    ]);
    const totals = [
      'TOTAL',
      `${rows.length} items`,
      Number(rows.reduce((s, r) => s + (r.target_CIF ?? 0), 0)).toFixed(2),
      rows.reduce((s, r) => s + (r.qty   ?? 0), 0),
      rows.reduce((s, r) => s + (r.cif   ?? 0), 0),
      rows.reduce((s, r) => s + (r.value ?? 0), 0),
    ];
    const ws = XLSX.utils.aoa_to_sheet([header, ...data, totals]);
    // Column widths
    ws['!cols'] = [{ wch: 18 }, { wch: 32 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 16 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sales Table');
    const parts = ['sales-table', appliedParams?.year, appliedParams?.month].filter(Boolean);
    XLSX.writeFile(wb, `${parts.join('-')}.xlsx`);
  };

  /* Derived option lists */
  const channelOpts = [
    { value: '', label: 'All Channels' },
    ...channels.map((c) => ({ value: c._id || c.channelId || '', label: c.channelName || c.channelKey || '—' })),
  ];
  const productOpts = [
    { value: '', label: 'All Products' },
    ...products.map((p) => ({ value: p._id || p.productId || '', label: p.productName || p.name || '—' })),
  ];
  const accountOpts = [
    { value: '', label: 'All Accounts' },
    ...accounts.map((a) => ({ value: a._id || a.id || '', label: a.accountName || a.name || '—' })),
  ];

  const hasFilters = !!(pendingMonth || pendingChannel || pendingAccount || pendingProduct);

  return (
    <AppShell navigation={navigation} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} activeRoute="SalesTable">
      <View style={styles.container}>

        {/* Page header */}
        <View style={styles.pageHeader}>
          <View>
            <Text style={styles.pageTitle}>Sales Table</Text>
            <Text style={styles.pageSubtitle}>Sales breakdown by channel and item</Text>
          </View>
          {rows.length > 0 && (
            <Pressable style={styles.btnExport} onPress={handleExport}>
              <Ionicons name="download-outline" size={14} color="#fff" />
              <Text style={styles.btnExportText}>Export Excel</Text>
            </Pressable>
          )}
        </View>

        {/* Filter bar */}
        <View style={styles.filtersBar}>
          <FilterDropdown label="Year"    options={YEAR_OPTS}   value={pendingYear}    onChange={setPendingYear}    zIndex={26} />
          <FilterDropdown label="Month"   options={MONTH_OPTS}  value={pendingMonth}   onChange={setPendingMonth}   zIndex={25} />
          <FilterDropdown label="Channel" options={channelOpts} value={pendingChannel} onChange={setPendingChannel} zIndex={24} />
          <FilterDropdown label="Product" options={productOpts} value={pendingProduct} onChange={setPendingProduct} zIndex={23} />
          <SearchableDropdown label="Account" options={accountOpts} value={pendingAccount} onChange={setPendingAccount} zIndex={22} />
          <View style={{ flex: 1 }} />
          {hasFilters && (
            <Pressable style={styles.btnClear} onPress={handleClear}>
              <Ionicons name="refresh-outline" size={13} color={colors.textSecondary} />
              <Text style={styles.btnClearText}>Clear</Text>
            </Pressable>
          )}
          <Pressable style={styles.btnApply} onPress={handleApply}>
            <Ionicons name="options-outline" size={13} color="#fff" />
            <Text style={styles.btnApplyText}>Apply</Text>
          </Pressable>
        </View>

        {/* Body */}
        {!appliedParams && !loading ? (
          <View style={styles.promptState}>
            <View style={styles.promptIcon}>
              <Ionicons name="grid-outline" size={36} color={colors.textMuted} />
            </View>
            <Text style={styles.promptTitle}>Select filters and tap Apply</Text>
            <Text style={styles.promptMsg}>
              Choose a year and any optional filters, then tap Apply to load the sales table.
            </Text>
          </View>
        ) : loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading sales data…</Text>
          </View>
        ) : error ? (
          <View style={styles.centered}>
            <Ionicons name="alert-circle-outline" size={32} color={colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.btnOutline} onPress={handleApply}>
              <Text style={styles.btnOutlineText}>Retry</Text>
            </Pressable>
          </View>
        ) : rows.length === 0 ? (
          <View style={styles.centered}>
            <Ionicons name="grid-outline" size={32} color={colors.textMuted} />
            <Text style={styles.emptyText}>No sales data for the selected filters</Text>
          </View>
        ) : (() => {
          const totalTargetCif = rows.reduce((s, r) => s + (r.target_CIF ?? 0), 0);
          const totalQty       = rows.reduce((s, r) => s + (r.qty       ?? 0), 0);
          const totalCif       = rows.reduce((s, r) => s + (r.cif       ?? 0), 0);
          const totalValue     = rows.reduce((s, r) => s + (r.value     ?? 0), 0);
          return (
            <View style={styles.tableCard}>
              {/* Pinned header */}
              <View style={styles.tableHead}>
                <Text style={[styles.th,    styles.colChannel]}>SALES CHANNEL</Text>
                <Text style={[styles.th,    styles.colItem]}>ITEM NAME</Text>
                <Text style={[styles.thNum, styles.colNum]}>CIF</Text>
                <Text style={[styles.thNum, styles.colNum]}>QTY</Text>
                <Text style={[styles.thNum, styles.colNum]}>CIF (USD)</Text>
                <Text style={[styles.thNum, styles.colNum]}>VALUE (AED)</Text>
              </View>
              {/* Scrollable rows */}
              <ScrollView style={{ flex: 1, minHeight: 0 }} showsVerticalScrollIndicator>
                {rows.map((row, i) => (
                  <Pressable
                    key={i}
                    style={[
                      styles.tableRow,
                      i % 2 === 1 && styles.tableRowAlt,
                      hoveredRow === i && styles.tableRowHovered,
                    ]}
                    onHoverIn={() => setHoveredRow(i)}
                    onHoverOut={() => setHoveredRow(null)}
                    onPress={() => navigation.navigate('ProductSalesRecords', {
                      accountId: appliedParams?.account || '',
                      channelId: row.channelId,
                      channelName: row.channelName,
                      itemName: row.itemName,
                      month: appliedParams?.month || '',
                      productId: row.productId,
                      year: appliedParams?.year || '',
                    })}
                  >
                    <Text style={[styles.td,    styles.colChannel]} numberOfLines={1}>{row.channelName || '—'}</Text>
                    <Text style={[styles.td,    styles.colItem]}    numberOfLines={1}>{row.itemName    || '—'}</Text>
                    <Text style={[styles.tdNum, styles.colNum]}>{fmtFixed2(row.target_CIF)}</Text>
                    <Text style={[styles.tdNum, styles.colNum]}>{fmtQty(row.qty)}</Text>
                    <Text style={[styles.tdNum, styles.colNum]}>{fmtCurrency(row.cif)}</Text>
                    <Text style={[styles.tdNum, styles.colNum]}>{fmtCurrency(row.value, 'AED')}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              {/* Pinned totals row */}
              <View style={styles.totalsRow}>
                <Text style={[styles.totalLabel, styles.colChannel]}>TOTAL</Text>
                <Text style={[styles.totalLabel, styles.colItem]}>{rows.length} item{rows.length !== 1 ? 's' : ''}</Text>
                <Text style={[styles.totalNum,   styles.colNum]}>{fmtFixed2(totalTargetCif)}</Text>
                <Text style={[styles.totalNum,   styles.colNum]}>{fmtQty(totalQty)}</Text>
                <Text style={[styles.totalNum,   styles.colNum]}>{fmtCurrency(totalCif)}</Text>
                <Text style={[styles.totalNum,   styles.colNum]}>{fmtCurrency(totalValue, 'AED')}</Text>
              </View>
            </View>
          );
        })()}
      </View>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: globalWidth('1.2%'), gap: 14 },

  pageHeader:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pageTitle:     { fontSize: 22, fontWeight: '800', color: colors.textPrimary },
  pageSubtitle:  { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  btnExport: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#16A34A', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8,
  },
  btnExportText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  /* Filter bar */
  filtersBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap',
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, ...shadow, zIndex: 20,
  },
  filterBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6, backgroundColor: colors.backgroundColor,
  },
  filterBtnLabel: { fontSize: 9, color: colors.textMuted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  filterBtnValue: { fontSize: 12, color: colors.textPrimary, fontWeight: '600', maxWidth: 120 },
  filterDropdown: {
    position: 'absolute', top: 38, left: 0, minWidth: 160,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 8, ...shadow, zIndex: 100,
  },
  filterOpt:           { paddingHorizontal: 12, paddingVertical: 9 },
  filterOptActive:     { backgroundColor: colors.primary + '15' },
  filterOptText:       { fontSize: 13, color: colors.textPrimary },
  filterOptTextActive: { color: colors.primary, fontWeight: '700' },

  /* Searchable dropdown extras */
  searchInputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  searchInput: { flex: 1, fontSize: 13, color: colors.textPrimary, outlineStyle: 'none' },
  searchCount: { fontSize: 10, color: colors.textMuted, paddingHorizontal: 12, paddingVertical: 4 },

  /* Buttons */
  btnApply: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8,
  },
  btnApplyText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  btnClear: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderColor: colors.border, paddingHorizontal: 10, paddingVertical: 8,
    borderRadius: 8, backgroundColor: colors.backgroundColor,
  },
  btnClearText:   { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  btnOutline: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 8, backgroundColor: colors.surface,
  },
  btnOutlineText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },

  /* States */
  promptState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, paddingVertical: 64 },
  promptIcon:  {
    width: 72, height: 72, borderRadius: 18,
    backgroundColor: colors.backgroundColor, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  promptTitle: { fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  promptMsg:   { fontSize: 13, color: colors.textSecondary, textAlign: 'center', maxWidth: 380, lineHeight: 20 },
  centered:    { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 64 },
  loadingText: { fontSize: 13, color: colors.textSecondary },
  errorText:   { fontSize: 14, color: colors.danger, textAlign: 'center' },
  emptyText:   { fontSize: 14, color: colors.textMuted, textAlign: 'center' },

  /* Table card — fills all remaining height */
  tableCard: {
    flex: 1, minHeight: 0,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, overflow: 'hidden', ...shadow,
  },
  tableHead: {
    flexDirection: 'row',
    backgroundColor: colors.primary + '0C',
    paddingVertical: 10, paddingHorizontal: 14,
    borderBottomWidth: 2, borderBottomColor: colors.primary + '25',
    zIndex: 2,
    boxShadow: '0 2px 6px rgba(11,43,102,0.08)',
  },
  th:          { fontSize: 10, fontWeight: '800', color: colors.primary, letterSpacing: 0.5, textTransform: 'uppercase' },
  thNum:       { fontSize: 10, fontWeight: '800', color: colors.primary, letterSpacing: 0.5, textTransform: 'uppercase', textAlign: 'right' },
  tableRow:        { flexDirection: 'row', paddingVertical: 11, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  tableRowAlt:     { backgroundColor: colors.backgroundColor },
  tableRowHovered: { backgroundColor: colors.primary + '0D', boxShadow: '0 2px 10px rgba(29,78,216,0.10)', zIndex: 1 },
  td:          { fontSize: 13, color: colors.textPrimary },
  tdNum:       { fontSize: 13, color: colors.textPrimary, textAlign: 'right' },

  /* Totals pinned at the bottom */
  totalsRow: {
    flexDirection: 'row',
    paddingVertical: 11, paddingHorizontal: 14,
    backgroundColor: colors.primary + '0A',
    borderTopWidth: 2, borderTopColor: colors.primary + '30',
  },
  totalLabel: { fontSize: 12, fontWeight: '800', color: colors.primary },
  totalNum:   { fontSize: 12, fontWeight: '800', color: colors.primary, textAlign: 'right' },

  /* Flex columns — fill full width (colItem reduced 10% vs colChannel/colNum baseline) */
  colChannel: { flex: 20, paddingRight: 12 },
  colItem:    { flex: 27, paddingRight: 12 },
  colNum:     { flex: 20, paddingRight: 12 },
});
