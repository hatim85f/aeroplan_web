import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AppShell from '../../components/AppShell';
import { colors } from '../../constants/colors';
import { globalHeight, globalWidth } from '../../constants/globalWidth';
import {
  listSalesRecords,
  deleteSalesRecord,
  updateSalesRecordStatus,
  matchSalesOrders,
  matchSalesTargets,
  recalculateSharedSales,
  cleanupSalesDuplicates,
  applySharedSales,
} from '../../store/sales/salesActions';
import { listCoverageReps, setSalesAttribution } from '../../store/accountAssignments/accountAssignmentActions';

const isManager = (role) =>
  ['admin', 'manager', 'senior_manager'].includes(String(role || '').toLowerCase());

const THIS_YEAR  = new Date().getFullYear();
const YEAR_OPTS  = [{ value: '', label: 'All Years' }, ...[THIS_YEAR - 1, THIS_YEAR, THIS_YEAR + 1].map((y) => ({ value: String(y), label: String(y) }))];
const MONTH_OPTS = [
  { value: '', label: 'All Months' },
  { value: '1', label: 'Jan' }, { value: '2',  label: 'Feb' }, { value: '3',  label: 'Mar' },
  { value: '4', label: 'Apr' }, { value: '5',  label: 'May' }, { value: '6',  label: 'Jun' },
  { value: '7', label: 'Jul' }, { value: '8',  label: 'Aug' }, { value: '9',  label: 'Sep' },
  { value: '10',label: 'Oct' }, { value: '11', label: 'Nov' }, { value: '12', label: 'Dec' },
];
const STATUS_OPTS = [
  { value: '', label: 'All Status' },
  { value: 'active',    label: 'Active'    },
  { value: 'ignored',   label: 'Ignored'   },
  { value: 'duplicate', label: 'Duplicate' },
  { value: 'error',     label: 'Error'     },
];
const MATCH_STATUS_OPTS = [
  { value: '', label: 'All Match Status' },
  { value: 'matched',           label: 'Matched'           },
  { value: 'partially_matched', label: 'Partially Matched' },
  { value: 'unmatched',         label: 'Unmatched'         },
  { value: 'needs_review',      label: 'Needs Review'      },
  { value: 'ignored',           label: 'Ignored'           },
  { value: 'duplicate',         label: 'Duplicate'         },
  { value: 'error',             label: 'Error'             },
];

const MATCH_STATUS_STYLE = {
  matched:           { bg: '#DCFCE7', text: '#15803D' },
  partially_matched: { bg: '#DBEAFE', text: '#1D4ED8' },
  unmatched:         { bg: '#FEF3C7', text: '#92400E' },
  needs_review:      { bg: '#EFF6FF', text: '#1D4ED8' },
  ignored:           { bg: '#F1F5F9', text: '#64748B' },
  duplicate:         { bg: '#FEE2E2', text: '#DC2626' },
  error:             { bg: '#FEE2E2', text: '#DC2626' },
};
const STATUS_STYLE = {
  active:    { bg: '#DCFCE7', text: '#15803D' },
  ignored:   { bg: '#F1F5F9', text: '#64748B' },
  duplicate: { bg: '#FEF9C3', text: '#854D0E' },
  error:     { bg: '#FEE2E2', text: '#DC2626' },
};

const shadow = { shadowColor: '#0B2B66', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } };
const PAD    = globalWidth('1.2%');

const fmtDate = (d) => (d ? String(d).slice(0, 10) : '—');
const fmtNum  = (n) => (n == null ? '—' : Number(n).toLocaleString());
const fmtCur  = (v, cur = 'USD') => {
  if (v == null) return '—';
  const sym = cur === 'AED' ? 'AED ' : '$';
  return `${sym}${Number(v).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
};
const cap = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ') : '—';
const pick = (...vals) => vals.find((v) => v !== undefined && v !== null && v !== '');
const uploadedCurrency = (r) => pick(r.uploadedCurrency, r.currency);
const uploadedSalesValue = (r) => pick(r.uploadedSalesValue, r.salesValue);
const uploadedUnitValue = (r) => pick(r.uploadedUnitValue, r.unitValue);
const calculatedCifUsd = (r) => pick(r.calculatedCifUsd, r.cifValueUsd, r.cifUsd);
const calculatedWholesaleAed = (r) => pick(r.calculatedWholesaleAed, r.wholesaleValueAed, r.wholesaleAed);
const calculatedRetailAed = (r) => pick(r.calculatedRetailAed, r.retailValueAed, r.retailAed);

const COLS = [
  { key: 'salesDate',     label: 'Sales Date',      width: 90  },
  { key: 'invoiceNumber', label: 'Invoice #',        width: 110 },
  { key: 'account',       label: 'Account',          width: 130 },
  { key: 'shipTo',        label: 'Ship-To',          width: 120 },
  { key: 'product',       label: 'Product',          width: 130 },
  { key: 'nickname',      label: 'Nickname',         width: 90  },
  { key: 'channel',       label: 'Channel',          width: 90  },
  { key: 'qty',           label: 'Qty',              width: 60  },
  { key: 'focQty',        label: 'FOC Qty',          width: 60  },
  { key: 'uploadedValue', label: 'Uploaded Val.',    width: 100 },
  { key: 'uploadedCurrency', label: 'Currency',      width: 80  },
  { key: 'uploadedUnitValue', label: 'Unit Value',    width: 90  },
  { key: 'detectedBasis', label: 'Price Basis',       width: 100 },
  { key: 'cifUsd',        label: 'Calc CIF USD',      width: 100 },
  { key: 'wholesaleAed',  label: 'Calc Wholesale AED', width: 130 },
  { key: 'retailAed',     label: 'Calc Retail AED',   width: 120 },
  { key: 'entrySource',   label: 'Entry Source',       width: 90  },
  { key: 'sharedApplied', label: 'Shared Applied',     width: 100 },
  { key: 'areaShares',    label: 'Area Shares',        width: 160 },
  { key: 'matchStatus',   label: 'Match Status',     width: 100 },
  { key: 'status',        label: 'Status',           width: 80  },
  { key: 'actions',       label: 'Actions',          width: 90  },
];

function Badge({ label, styleObj }) {
  return (
    <View style={[styles.badge, { backgroundColor: styleObj?.bg || '#F1F5F9' }]}>
      <Text style={[styles.badgeText, { color: styleObj?.text || '#64748B' }]}>{label}</Text>
    </View>
  );
}

function FilterDropdown({ label, options, value, onChange }) {
  const [open, setOpen] = useState(false);
  const sel = options.find((o) => o.value === value);
  return (
    <View style={{ position: 'relative', zIndex: open ? 30 : 1 }}>
      <Pressable style={styles.filterBtn} onPress={() => setOpen((v) => !v)}>
        <Text style={styles.filterBtnText} numberOfLines={1}>{sel?.label || label}</Text>
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

function Pagination({ page, pages, total, onPage }) {
  if (!pages || pages <= 1) return null;
  return (
    <View style={styles.pagination}>
      <Text style={styles.paginationInfo}>Page {page} of {pages} · {total} records</Text>
      <View style={styles.paginationBtns}>
        <Pressable style={[styles.pageBtn, page <= 1 && styles.pageBtnDisabled]} onPress={() => page > 1 && onPage(page - 1)} disabled={page <= 1}>
          <Ionicons name="chevron-back" size={13} color={page <= 1 ? colors.textMuted : colors.textPrimary} />
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
          <Ionicons name="chevron-forward" size={13} color={page >= pages ? colors.textMuted : colors.textPrimary} />
        </Pressable>
      </View>
    </View>
  );
}

export default function SalesRecordsScreen({ navigation, userDetails, appMetadata, onSignOut }) {
  const user    = userDetails?.user || userDetails?.data?.user || userDetails || {};
  const token   = userDetails?.token || userDetails?.data?.token || '';
  const role    = user.role || '';
  const manager = isManager(role);

  const [records,    setRecords]    = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0, limit: 20 });
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');

  const [search,      setSearch]      = useState('');
  const [filterYear,  setFilterYear]  = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterStatus, setFilterStatus]    = useState('');
  const [filterMatch,  setFilterMatch]     = useState('');
  const [filterArea,   setFilterArea]      = useState('');
  const [filterEntrySource, setFilterEntrySource] = useState('');
  const [filterSharedApplied, setFilterSharedApplied] = useState('');

  const [deleting,   setDeleting]   = useState('');
  const [matching,   setMatching]   = useState(false);
  const [matchResult,setMatchResult]= useState(null);
  const [matchError, setMatchError] = useState('');

  /* Manual rep attribution modal */
  const [attrRecord,  setAttrRecord]  = useState(null);
  const [attrRows,    setAttrRows]    = useState([]);
  const [attrSaving,  setAttrSaving]  = useState(false);
  const [attrError,   setAttrError]   = useState('');
  const [repsList,    setRepsList]    = useState([]);

  const openAttribution = async (record) => {
    setAttrRecord(record);
    setAttrError('');
    setAttrRows(
      Array.isArray(record.repAttributions) && record.repAttributions.length
        ? record.repAttributions.map((entry) => ({
          userId: String(entry.userId), percentage: String(entry.percentage), note: entry.note || '',
        }))
        : [{ userId: '', percentage: '100', note: '' }],
    );
    if (!repsList.length) {
      try {
        const list = await listCoverageReps(token);
        setRepsList(list.map((rep) => ({
          value: String(rep._id),
          label: `${rep.fullName || rep.userName || rep.email || 'Representative'}${rep.isActive === false ? ' (inactive)' : ''}`,
        })));
      } catch { /* rep list optional */ }
    }
  };

  const saveAttribution = async () => {
    const rows = attrRows
      .filter((row) => row.userId && String(row.percentage).trim())
      .map((row) => ({ userId: row.userId, percentage: Number(row.percentage), note: row.note?.trim() || undefined }));

    if (rows.some((row) => !Number.isFinite(row.percentage) || row.percentage <= 0 || row.percentage > 100)) {
      setAttrError('Each percentage must be between 0 and 100.');
      return;
    }
    if (rows.reduce((sum, row) => sum + row.percentage, 0) > 100) {
      setAttrError('Total percentage cannot exceed 100.');
      return;
    }

    try {
      setAttrSaving(true);
      setAttrError('');
      await setSalesAttribution(token, attrRecord._id || attrRecord.id, rows);
      setAttrRecord(null);
      await fetchRecords(pagination.page);
    } catch (err) {
      setAttrError(err.message || 'Failed to save attribution.');
    } finally {
      setAttrSaving(false);
    }
  };
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [recalcResult, setRecalcResult] = useState(null);

  /* Refine / duplicate-cleanup state */
  const [showRefineModal,  setShowRefineModal]  = useState(false);
  const [cleanupStep,      setCleanupStep]      = useState('input'); // 'input' | 'dry-result' | 'result'
  const [cleanupRunning,   setCleanupRunning]   = useState(false);
  const [cleanupResult,    setCleanupResult]    = useState(null);
  const [cleanupError,     setCleanupError]     = useState('');
  const [cleanupYear,      setCleanupYear]      = useState('');
  const [cleanupMonth,     setCleanupMonth]     = useState('');

  /* Refine Sales Divisions state */
  const [showDivisionsModal, setShowDivisionsModal] = useState(false);
  const [divisionsStep,      setDivisionsStep]      = useState('input'); // 'input' | 'result'
  const [divisionsRunning,   setDivisionsRunning]   = useState(false);
  const [divisionsResult,    setDivisionsResult]    = useState(null);
  const [divisionsError,     setDivisionsError]     = useState('');
  const [divisionsYear,      setDivisionsYear]      = useState('');
  const [divisionsMonth,     setDivisionsMonth]     = useState('');

  const fetchRecords = useCallback(async (pg = 1) => {
    setLoading(true);
    setError('');
    try {
      const params = { page: pg, limit: 20 };
      if (search)       params.search      = search;
      if (filterYear)   params.year        = filterYear;
      if (filterMonth)  params.month       = filterMonth;
      if (filterStatus) params.status      = filterStatus;
      if (filterMatch)  params.matchStatus = filterMatch;
      if (filterArea)   params.areaId      = filterArea;
      if (filterEntrySource) params.entrySource = filterEntrySource;
      if (filterSharedApplied) params.sharedSalesApplied = filterSharedApplied;
      const res = await listSalesRecords(token, params);
      setRecords(res.records);
      setPagination(res.pagination);
    } catch (e) {
      setError(e.message || 'Failed to load records');
    } finally {
      setLoading(false);
    }
  }, [token, search, filterYear, filterMonth, filterStatus, filterMatch, filterArea, filterEntrySource, filterSharedApplied]);

  useEffect(() => { fetchRecords(1); }, [fetchRecords]);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this sales record?')) return;
    setDeleting(id);
    try {
      await deleteSalesRecord(token, id);
      setRecords((prev) => prev.filter((r) => (r._id || r.id) !== id));
    } catch (e) {
      alert(e.message || 'Delete failed');
    } finally {
      setDeleting('');
    }
  };

  const handleMatchOrders = async () => {
    setMatching(true); setMatchResult(null); setMatchError('');
    try {
      const res = await matchSalesOrders(token, {});
      setMatchResult({ ...res, type: 'orders' });
      setShowMatchModal(true);
      fetchRecords(1);
    } catch (e) {
      setMatchError(e.message || 'Matching failed');
      setShowMatchModal(true);
    } finally {
      setMatching(false);
    }
  };

  const handleMatchTargets = async () => {
    setMatching(true); setMatchResult(null); setMatchError('');
    try {
      const res = await matchSalesTargets(token, {});
      setMatchResult({ ...res, type: 'targets' });
      setShowMatchModal(true);
      fetchRecords(1);
    } catch (e) {
      setMatchError(e.message || 'Matching failed');
      setShowMatchModal(true);
    } finally {
      setMatching(false);
    }
  };

  const handleRecalculateShared = async () => {
    if (!window.confirm('This will recalculate area shares based on current shared sales rules. Continue?')) return;
    setMatching(true); setMatchResult(null); setMatchError('');
    try {
      const res = await recalculateSharedSales(token, {
        year: filterYear ? Number(filterYear) : undefined,
        month: filterMonth ? Number(filterMonth) : undefined,
        areaId: filterArea || undefined,
      });
      setRecalcResult(res);
      fetchRecords(1);
    } catch (e) {
      setMatchError(e.message || 'Recalculation failed');
      setShowMatchModal(true);
    } finally {
      setMatching(false);
    }
  };

  const handleOpenRefine = () => {
    setCleanupStep('input');
    setCleanupResult(null);
    setCleanupError('');
    setCleanupYear(String(filterYear || THIS_YEAR));
    setCleanupMonth(String(filterMonth || ''));
    setShowRefineModal(true);
  };

  const handleDryRun = async () => {
    if (!cleanupYear || !cleanupMonth) {
      setCleanupError('Please select year and month before refining sales data.');
      return;
    }
    setCleanupRunning(true);
    setCleanupError('');
    try {
      const res = await cleanupSalesDuplicates(token, {
        year: Number(cleanupYear),
        month: Number(cleanupMonth),
        apply: false,
      });
      setCleanupResult(res);
      setCleanupStep('dry-result');
    } catch (e) {
      setCleanupError(e.message || 'Unable to refine sales data. Please try again.');
    } finally {
      setCleanupRunning(false);
    }
  };

  const handleCleanup = async () => {
    if (!cleanupYear || !cleanupMonth) {
      setCleanupError('Please select year and month before refining sales data.');
      return;
    }
    setCleanupRunning(true);
    setCleanupError('');
    try {
      const res = await cleanupSalesDuplicates(token, {
        year: Number(cleanupYear),
        month: Number(cleanupMonth),
      });
      setCleanupResult(res);
      setCleanupStep('result');
      fetchRecords(1);
    } catch (e) {
      setCleanupError(e.message || 'Unable to refine sales data. Please try again.');
    } finally {
      setCleanupRunning(false);
    }
  };

  const handleOpenDivisions = () => {
    setDivisionsStep('input');
    setDivisionsResult(null);
    setDivisionsError('');
    setDivisionsYear(String(filterYear || THIS_YEAR));
    setDivisionsMonth(String(filterMonth || ''));
    setShowDivisionsModal(true);
  };

  const handleApplyDivisions = async () => {
    if (!divisionsYear || !divisionsMonth) {
      setDivisionsError('Please select year and month before refining sales divisions.');
      return;
    }
    setDivisionsRunning(true);
    setDivisionsError('');
    try {
      const res = await applySharedSales(token, {
        year: Number(divisionsYear),
        month: Number(divisionsMonth),
      });
      setDivisionsResult(res);
      setDivisionsStep('result');
      fetchRecords(1);
    } catch (e) {
      setDivisionsError(e.message || 'Unable to refine sales divisions. Please try again.');
    } finally {
      setDivisionsRunning(false);
    }
  };

  return (
    <AppShell navigation={navigation} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} activeRoute="SalesRecords" scrollable={false}>
      <View style={styles.container}>

        {/* ── Header ── */}
        <View style={styles.pageHeader}>
          <View>
            <Text style={styles.pageTitle}>Sales Records</Text>
            <Text style={styles.pageSubtitle}>All uploaded sales transactions</Text>
          </View>
          <View style={styles.headerRight}>
            {manager && (
              <>
                <Pressable
                  style={[styles.btnOutline, matching && { opacity: 0.6 }]}
                  onPress={handleMatchOrders}
                  disabled={matching}
                >
                  {matching ? <ActivityIndicator size={13} color={colors.primary} /> : <Ionicons name="git-compare-outline" size={14} color={colors.primary} />}
                  <Text style={[styles.btnOutlineText, { color: colors.primary }]}>Match Orders</Text>
                </Pressable>
                <Pressable style={styles.btnPrimary} onPress={() => navigation.navigate('SalesUpload')}>
                  <Ionicons name="cloud-upload-outline" size={14} color="#fff" />
                  <Text style={styles.btnPrimaryText}>Upload Sales</Text>
                </Pressable>
                <Pressable style={styles.btnOutline} onPress={handleRecalculateShared}>
                  <Ionicons name="refresh-outline" size={14} color={colors.primary} />
                  <Text style={[styles.btnOutlineText, { color: colors.primary }]}>Recalculate Shared</Text>
                </Pressable>
                <Pressable style={styles.btnOutline} onPress={handleOpenRefine}>
                  <Ionicons name="cut-outline" size={14} color={colors.textSecondary} />
                  <Text style={styles.btnOutlineText}>Refine Sales Data</Text>
                </Pressable>
                <Pressable style={styles.btnOutline} onPress={handleOpenDivisions}>
                  <Ionicons name="git-branch-outline" size={14} color={colors.textSecondary} />
                  <Text style={styles.btnOutlineText}>Refine Sales Divisions</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>

        {recalcResult && (
          <View style={styles.noticeBox}>
            <Text style={styles.noticeText}>Recalculation complete: {JSON.stringify(recalcResult)}</Text>
          </View>
        )}

        {/* ── Toolbar ── */}
        <View style={styles.toolbar}>
          <View style={styles.searchWrap}>
            <Ionicons name="search-outline" size={14} color={colors.textMuted} style={{ marginLeft: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search account, product, invoice…"
              placeholderTextColor={colors.textMuted}
              value={search}
              onChangeText={setSearch}
              returnKeyType="search"
              onSubmitEditing={() => fetchRecords(1)}
            />
          </View>
          <FilterDropdown label="Year"         options={YEAR_OPTS}       value={filterYear}   onChange={(v) => setFilterYear(v)}   />
          <FilterDropdown label="Month"        options={MONTH_OPTS}      value={filterMonth}  onChange={(v) => setFilterMonth(v)}  />
          <FilterDropdown label="Status"       options={STATUS_OPTS}     value={filterStatus} onChange={(v) => setFilterStatus(v)} />
          <FilterDropdown label="Match Status" options={MATCH_STATUS_OPTS} value={filterMatch} onChange={(v) => setFilterMatch(v)} />
          <TextInput style={styles.miniInput} value={filterArea} onChangeText={setFilterArea} placeholder="Area ID" placeholderTextColor={colors.textMuted} />
          <FilterDropdown label="Entry Source" options={[{ value: '', label: 'All Sources' }, { value: 'upload', label: 'Upload' }, { value: 'manual', label: 'Manual' }]} value={filterEntrySource} onChange={setFilterEntrySource} />
          <FilterDropdown label="Shared" options={[{ value: '', label: 'All Shared' }, { value: 'true', label: 'Shared Applied' }, { value: 'false', label: 'Not Shared' }]} value={filterSharedApplied} onChange={setFilterSharedApplied} />
          <Pressable style={styles.btnApply} onPress={() => fetchRecords(1)}>
            <Ionicons name="options-outline" size={13} color="#fff" />
            <Text style={styles.btnApplyText}>Apply</Text>
          </Pressable>
          {(filterYear || filterMonth || filterStatus || filterMatch || search || filterArea || filterEntrySource || filterSharedApplied) && (
            <Pressable style={styles.btnClear} onPress={() => {
              setSearch(''); setFilterYear(''); setFilterMonth(''); setFilterStatus(''); setFilterMatch('');
              setFilterArea(''); setFilterEntrySource(''); setFilterSharedApplied('');
            }}>
              <Ionicons name="refresh-outline" size={13} color={colors.textSecondary} />
            </Pressable>
          )}
        </View>

        {/* ── Table ── */}
        {loading ? (
          <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
        ) : error ? (
          <View style={styles.centered}>
            <Ionicons name="alert-circle-outline" size={32} color={colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.btnOutline} onPress={() => fetchRecords(1)}>
              <Text style={styles.btnOutlineText}>Retry</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
            <ScrollView horizontal showsHorizontalScrollIndicator style={styles.tableScroll}>
              <View>
                {/* Head */}
                <View style={styles.tblHead}>
                  {COLS.map((c) => (
                    <Text key={c.key} style={[styles.tblTh, { width: c.width }]}>{c.label}</Text>
                  ))}
                </View>
                {/* Body */}
                {records.length === 0 ? (
                  <View style={styles.emptyRow}>
                    <Ionicons name="document-outline" size={28} color={colors.textMuted} />
                    <Text style={styles.emptyText}>No records found</Text>
                  </View>
                ) : records.map((r) => {
                  const id          = r._id || r.id;
                  const matchSty    = MATCH_STATUS_STYLE[r.matchStatus] || MATCH_STATUS_STYLE.unmatched;
                  const statusSty   = STATUS_STYLE[r.status]            || STATUS_STYLE.ignored;
                  const productObj  = r.productId  || {};
                  const accountObj  = r.accountId  || {};
                  const channelObj  = r.channelId  || {};
                  const shipToObj   = r.shipToAccountId || {};
                  return (
                    <View key={id} style={styles.tblRow}>
                      <Text style={[styles.tblTd, { width: COLS[0].width }]}>{fmtDate(r.salesDate)}</Text>
                      <Text style={[styles.tblTd, { width: COLS[1].width }]} numberOfLines={1}>{r.invoiceNumber || '—'}</Text>
                      <Text style={[styles.tblTd, { width: COLS[2].width }]} numberOfLines={1}>
                        {accountObj.accountName || accountObj.name || r.accountName || r.uploadedAccountName || '—'}
                      </Text>
                      <Text style={[styles.tblTd, { width: COLS[3].width }]} numberOfLines={1}>
                        {shipToObj.accountName || r.shipToAccountName || '—'}
                      </Text>
                      <Text style={[styles.tblTd, { width: COLS[4].width }]} numberOfLines={1}>
                        {productObj.productName || productObj.name || r.productName || r.uploadedProductName || '—'}
                      </Text>
                      <Text style={[styles.tblTd, { width: COLS[5].width }]} numberOfLines={1}>
                        {productObj.productNickname || r.productNickname || r.uploadedProductNickname || '—'}
                      </Text>
                      <Text style={[styles.tblTd, { width: COLS[6].width }]} numberOfLines={1}>
                        {channelObj.channelName || channelObj.channelKey || r.channelName || '—'}
                      </Text>
                      <Text style={[styles.tblTd, { width: COLS[7].width }]}>{fmtNum(r.quantity)}</Text>
                      <Text style={[styles.tblTd, { width: COLS[8].width }]}>{fmtNum(r.freeQuantity)}</Text>
                      <Text style={[styles.tblTd, { width: COLS[9].width }]}>{fmtCur(uploadedSalesValue(r), uploadedCurrency(r))}</Text>
                      <Text style={[styles.tblTd, { width: COLS[10].width }]}>{uploadedCurrency(r) || '—'}</Text>
                      <Text style={[styles.tblTd, { width: COLS[11].width }]}>{fmtNum(uploadedUnitValue(r))}</Text>
                      <Text style={[styles.tblTd, { width: COLS[12].width }]} numberOfLines={1}>{cap(r.detectedPriceBasis)}</Text>
                      <Text style={[styles.tblTd, { width: COLS[13].width }]}>{fmtCur(calculatedCifUsd(r), 'USD')}</Text>
                      <Text style={[styles.tblTd, { width: COLS[14].width }]}>{fmtCur(calculatedWholesaleAed(r), 'AED')}</Text>
                      <Text style={[styles.tblTd, { width: COLS[15].width }]}>{fmtCur(calculatedRetailAed(r), 'AED')}</Text>
                      <Text style={[styles.tblTd, { width: COLS[16].width }]}>{cap(r.entrySource || 'upload')}</Text>
                      <Text style={[styles.tblTd, { width: COLS[17].width }]}>{r.sharedSalesApplied ? 'Yes' : 'No'}</Text>
                      <Text style={[styles.tblTd, { width: COLS[18].width }]} numberOfLines={1}>
                        {Array.isArray(r.areaShares) && r.areaShares.length
                          ? r.areaShares.map((s) => `${s.areaName || s.area?.areaName || s.areaId?.areaName || 'Area'} ${s.sharePercentage ?? s.share ?? 0}%`).join(', ')
                          : '—'}
                      </Text>
                      <View style={[styles.tblTd, { width: COLS[19].width }]}>
                        <Badge label={cap(r.matchStatus || 'unmatched')} styleObj={matchSty} />
                      </View>
                      <View style={[styles.tblTd, { width: COLS[20].width }]}>
                        <Badge label={cap(r.status || 'active')} styleObj={statusSty} />
                      </View>
                      <View style={[styles.tblTd, styles.tblActions, { width: COLS[21].width }]}>
                        <Pressable style={styles.actionBtn} onPress={() => navigation.navigate('SalesRecordDetail', { salesId: id })}>
                          <Ionicons name="eye-outline" size={14} color={colors.textSecondary} />
                        </Pressable>
                        {manager && (
                          <>
                            <Pressable style={styles.actionBtn} onPress={() => navigation.navigate('SalesRecordDetail', { salesId: id, mode: 'edit' })}>
                              <Ionicons name="create-outline" size={14} color={colors.primary} />
                            </Pressable>
                            <Pressable style={styles.actionBtn} onPress={() => openAttribution(r)}>
                              <Ionicons
                                name="person-add-outline"
                                size={14}
                                color={r.repAttributions?.length ? '#7C3AED' : colors.textSecondary}
                              />
                            </Pressable>
                            <Pressable
                              style={styles.actionBtn}
                              onPress={() => handleDelete(id)}
                              disabled={deleting === id}
                            >
                              {deleting === id
                                ? <ActivityIndicator size={12} color={colors.danger} />
                                : <Ionicons name="trash-outline" size={14} color={colors.danger} />
                              }
                            </Pressable>
                          </>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            </ScrollView>

            <Pagination page={pagination.page} pages={pagination.pages} total={pagination.total} onPage={fetchRecords} />
          </ScrollView>
        )}
      </View>

      {/* Match Result Modal */}
      {showMatchModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Ionicons
                name={matchError ? 'alert-circle' : 'checkmark-circle'}
                size={24}
                color={matchError ? colors.danger : colors.success}
              />
              <Text style={styles.modalTitle}>
                {matchResult ? `${matchResult.type === 'orders' ? 'Orders' : 'Targets'} Matching Complete` : 'Matching Failed'}
              </Text>
            </View>
            {matchError ? (
              <Text style={styles.modalError}>{matchError}</Text>
            ) : matchResult && (
              <View style={styles.modalStats}>
                <Text style={styles.modalStat}>Matched: {matchResult.matched ?? 0}</Text>
                <Text style={styles.modalStat}>Unmatched: {matchResult.unmatched ?? 0}</Text>
                {matchResult.errors != null && <Text style={styles.modalStat}>Errors: {matchResult.errors}</Text>}
              </View>
            )}
            <Pressable style={styles.modalClose} onPress={() => setShowMatchModal(false)}>
              <Text style={styles.modalCloseText}>Close</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Rep attribution modal */}
      {attrRecord && (
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, { maxWidth: 580, gap: 14 }]}>
            <View style={styles.modalHeader}>
              <Ionicons name="person-add-outline" size={24} color={colors.primary} />
              <Text style={styles.modalTitle}>Rep Attribution</Text>
            </View>
            <Text style={styles.modalDesc}>
              {(attrRecord.productNickname || attrRecord.productName || '—')} · {(attrRecord.accountName || attrRecord.shipToAccountName || '—')} · Qty {attrRecord.quantity}
              {'  —  '}Manual attribution overrides account-based credit for this record.
            </Text>

            {attrRows.map((row, idx) => (
              <View key={idx} style={[styles.attrRow, { zIndex: 50 - idx }]}>
                <View style={{ flex: 1.4, zIndex: 50 - idx }}>
                  <FilterDropdown
                    label={repsList.find((o) => o.value === row.userId)?.label || 'Select rep'}
                    options={repsList}
                    value={row.userId}
                    onChange={(v) => setAttrRows((cur) => cur.map((r2, i) => (i === idx ? { ...r2, userId: v } : r2)))}
                  />
                </View>
                <TextInput
                  style={[styles.attrInput, { width: 64 }]}
                  keyboardType="numeric"
                  placeholder="%"
                  placeholderTextColor={colors.textMuted}
                  value={row.percentage}
                  onChangeText={(t) => setAttrRows((cur) => cur.map((r2, i) => (i === idx ? { ...r2, percentage: t } : r2)))}
                />
                <TextInput
                  style={[styles.attrInput, { flex: 1 }]}
                  placeholder="Note (optional)"
                  placeholderTextColor={colors.textMuted}
                  value={row.note}
                  onChangeText={(t) => setAttrRows((cur) => cur.map((r2, i) => (i === idx ? { ...r2, note: t } : r2)))}
                />
                <Pressable style={styles.actionBtn} onPress={() => setAttrRows((cur) => cur.filter((_, i) => i !== idx))}>
                  <Ionicons name="trash-outline" size={14} color={colors.danger} />
                </Pressable>
              </View>
            ))}

            <Pressable
              style={[styles.btnOutline, { alignSelf: 'flex-start' }]}
              onPress={() => setAttrRows((cur) => [...cur, { userId: '', percentage: '', note: '' }])}
            >
              <Ionicons name="add" size={13} color={colors.primary} />
              <Text style={[styles.btnOutlineText, { color: colors.primary }]}>Add Rep</Text>
            </Pressable>

            {attrError ? <Text style={styles.modalError}>{attrError}</Text> : null}

            <View style={styles.modalActions}>
              <Pressable style={styles.btnOutline} onPress={() => setAttrRecord(null)} disabled={attrSaving}>
                <Text style={styles.btnOutlineText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.btnOutline, { backgroundColor: colors.primary, borderColor: colors.primary }, attrSaving && { opacity: 0.6 }]}
                onPress={saveAttribution}
                disabled={attrSaving}
              >
                {attrSaving ? <ActivityIndicator size={12} color="#fff" /> : <Ionicons name="save-outline" size={13} color="#fff" />}
                <Text style={[styles.btnOutlineText, { color: '#fff' }]}>{attrRows.length ? 'Save Attribution' : 'Clear Attribution'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}

      {/* Refine Sales Data modal */}
      {showRefineModal && (
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, { maxWidth: 460, gap: 14 }]}>
            <View style={styles.modalHeader}>
              <Ionicons
                name={cleanupStep === 'result' && !cleanupError ? 'checkmark-circle' : 'cut-outline'}
                size={24}
                color={cleanupStep === 'result' && !cleanupError ? colors.success : colors.primary}
              />
              <Text style={styles.modalTitle}>Refine Sales Data</Text>
            </View>

            {cleanupStep === 'input' && (
              <>
                <Text style={styles.modalDesc}>
                  This will check active sales records for the selected month and deactivate duplicate
                  records. Records will not be permanently deleted.
                </Text>
                <View style={styles.modalFields}>
                  <FilterDropdown label={cleanupYear || 'Year'}   options={YEAR_OPTS}                         value={cleanupYear}  onChange={setCleanupYear}  />
                  <FilterDropdown label={cleanupMonth ? MONTH_OPTS.find((o) => o.value === cleanupMonth)?.label : 'Month'} options={MONTH_OPTS.filter((o) => o.value)} value={cleanupMonth} onChange={setCleanupMonth} />
                </View>
                {cleanupError ? <Text style={styles.modalError}>{cleanupError}</Text> : null}
                <View style={styles.modalActions}>
                  <Pressable style={styles.btnOutline} onPress={() => setShowRefineModal(false)} disabled={cleanupRunning}>
                    <Text style={styles.btnOutlineText}>Cancel</Text>
                  </Pressable>
                  <Pressable style={[styles.btnOutline, cleanupRunning && { opacity: 0.6 }]} onPress={handleDryRun} disabled={cleanupRunning}>
                    {cleanupRunning ? <ActivityIndicator size={12} color={colors.primary} /> : <Ionicons name="eye-outline" size={13} color={colors.primary} />}
                    <Text style={[styles.btnOutlineText, { color: colors.primary }]}>Dry Run</Text>
                  </Pressable>
                  <Pressable style={[styles.btnPrimary, cleanupRunning && { opacity: 0.6 }]} onPress={handleCleanup} disabled={cleanupRunning}>
                    {cleanupRunning ? <ActivityIndicator size={12} color="#fff" /> : <Ionicons name="cut-outline" size={13} color="#fff" />}
                    <Text style={styles.btnPrimaryText}>Refine Sales Data</Text>
                  </Pressable>
                </View>
              </>
            )}

            {cleanupStep === 'dry-result' && (
              <>
                <Text style={styles.modalDesc}>Dry run preview — no changes have been made yet:</Text>
                <View style={styles.modalStats}>
                  <Text style={styles.modalStat}>Checked records: {cleanupResult?.checkedRecords ?? 0}</Text>
                  <Text style={styles.modalStat}>Duplicate groups found: {cleanupResult?.duplicateGroupsFound ?? 0}</Text>
                  <Text style={styles.modalStat}>Would be deactivated: {cleanupResult?.duplicatesDeactivated ?? 0}</Text>
                  <Text style={styles.modalStat}>Would be kept: {cleanupResult?.keptRecords ?? 0}</Text>
                </View>
                {!cleanupResult?.duplicatesDeactivated && (
                  <Text style={styles.modalNone}>No duplicate active records were found.</Text>
                )}
                {cleanupError ? <Text style={styles.modalError}>{cleanupError}</Text> : null}
                <View style={styles.modalActions}>
                  <Pressable style={styles.btnOutline} onPress={() => { setCleanupStep('input'); setCleanupResult(null); setCleanupError(''); }} disabled={cleanupRunning}>
                    <Text style={styles.btnOutlineText}>Back</Text>
                  </Pressable>
                  <Pressable style={styles.btnOutline} onPress={() => setShowRefineModal(false)} disabled={cleanupRunning}>
                    <Text style={styles.btnOutlineText}>Close</Text>
                  </Pressable>
                  {!!cleanupResult?.duplicatesDeactivated && (
                    <Pressable style={[styles.btnPrimary, cleanupRunning && { opacity: 0.6 }]} onPress={handleCleanup} disabled={cleanupRunning}>
                      {cleanupRunning ? <ActivityIndicator size={12} color="#fff" /> : <Ionicons name="cut-outline" size={13} color="#fff" />}
                      <Text style={styles.btnPrimaryText}>Apply Refinement</Text>
                    </Pressable>
                  )}
                </View>
              </>
            )}

            {cleanupStep === 'result' && (
              <>
                <View style={styles.modalStats}>
                  <Text style={styles.modalStat}>Checked records: {cleanupResult?.checkedRecords ?? 0}</Text>
                  <Text style={styles.modalStat}>Duplicate groups found: {cleanupResult?.duplicateGroupsFound ?? 0}</Text>
                  <Text style={styles.modalStat}>Duplicates deactivated: {cleanupResult?.duplicatesDeactivated ?? 0}</Text>
                  <Text style={styles.modalStat}>Records kept: {cleanupResult?.keptRecords ?? 0}</Text>
                </View>
                {!cleanupResult?.duplicatesDeactivated && (
                  <Text style={styles.modalNone}>No duplicate active records were found.</Text>
                )}
                {cleanupError ? <Text style={styles.modalError}>{cleanupError}</Text> : null}
                <Pressable style={[styles.modalClose, { alignSelf: 'flex-end' }]} onPress={() => setShowRefineModal(false)}>
                  <Text style={styles.modalCloseText}>Done</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      )}

      {/* Refine Sales Divisions modal */}
      {showDivisionsModal && (
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, { maxWidth: 460, gap: 14 }]}>
            <View style={styles.modalHeader}>
              <Ionicons
                name={divisionsStep === 'result' && !divisionsError ? 'checkmark-circle' : 'git-branch-outline'}
                size={24}
                color={divisionsStep === 'result' && !divisionsError ? colors.success : colors.primary}
              />
              <Text style={styles.modalTitle}>Refine Sales Divisions</Text>
            </View>

            {divisionsStep === 'input' && (
              <>
                <Text style={styles.modalDesc}>
                  This will apply shared sales rules to records in the selected month, distributing sales across the correct areas and divisions.
                </Text>
                <View style={styles.modalFields}>
                  <FilterDropdown label={divisionsYear || 'Year'}   options={YEAR_OPTS}                         value={divisionsYear}  onChange={setDivisionsYear}  />
                  <FilterDropdown label={divisionsMonth ? MONTH_OPTS.find((o) => o.value === divisionsMonth)?.label : 'Month'} options={MONTH_OPTS.filter((o) => o.value)} value={divisionsMonth} onChange={setDivisionsMonth} />
                </View>
                {divisionsError ? <Text style={styles.modalError}>{divisionsError}</Text> : null}
                <View style={styles.modalActions}>
                  <Pressable style={styles.btnOutline} onPress={() => setShowDivisionsModal(false)} disabled={divisionsRunning}>
                    <Text style={styles.btnOutlineText}>Cancel</Text>
                  </Pressable>
                  <Pressable style={[styles.btnPrimary, divisionsRunning && { opacity: 0.6 }]} onPress={handleApplyDivisions} disabled={divisionsRunning}>
                    {divisionsRunning ? <ActivityIndicator size={12} color="#fff" /> : <Ionicons name="git-branch-outline" size={13} color="#fff" />}
                    <Text style={styles.btnPrimaryText}>Refine Sales Divisions</Text>
                  </Pressable>
                </View>
              </>
            )}

            {divisionsStep === 'result' && (
              <>
                <View style={styles.modalStats}>
                  <Text style={styles.modalStat}>Matched: {divisionsResult?.matchedCount ?? 0}</Text>
                  <Text style={styles.modalStat}>Updated: {divisionsResult?.updatedCount ?? 0}</Text>
                  {divisionsResult?.warnings?.length > 0 && (
                    <View style={{ gap: 3 }}>
                      <Text style={[styles.modalStat, { color: colors.warning }]}>
                        Warnings ({divisionsResult.warnings.length}):
                      </Text>
                      {divisionsResult.warnings.map((w, i) => (
                        <Text key={i} style={{ fontSize: 12, color: colors.textSecondary }}>{w}</Text>
                      ))}
                    </View>
                  )}
                </View>
                {divisionsError ? <Text style={styles.modalError}>{divisionsError}</Text> : null}
                <Pressable style={[styles.modalClose, { alignSelf: 'flex-end' }]} onPress={() => setShowDivisionsModal(false)}>
                  <Text style={styles.modalCloseText}>Done</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      )}
    </AppShell>
  );
}

/* ─── Styles ─────────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  container: { flex: 1, padding: PAD, gap: 10, minHeight: 0 },

  pageHeader: {
    flexDirection: 'row', alignItems: 'flex-start',
    justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
  },
  pageTitle:    { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  pageSubtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  headerRight:  { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  noticeBox: { padding: 10, borderRadius: 8, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE' },
  noticeText: { fontSize: 12, color: '#1D4ED8', fontWeight: '600' },

  toolbar: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center',
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, padding: 10, ...shadow, zIndex: 20,
  },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    backgroundColor: colors.backgroundColor, flex: 1, minWidth: 180,
  },
  searchInput: {
    flex: 1, height: 34, paddingHorizontal: 8, fontSize: 13,
    color: colors.textPrimary, outlineStyle: 'none',
  },
  miniInput: {
    height: 34, minWidth: 100, borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    paddingHorizontal: 10, fontSize: 12, color: colors.textPrimary, backgroundColor: colors.backgroundColor,
  },

  filterBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 7, backgroundColor: colors.backgroundColor,
    minWidth: 100,
  },
  filterBtnText: { flex: 1, fontSize: 12, color: colors.textPrimary, fontWeight: '600' },
  filterDropdown: {
    position: 'absolute', top: 38, left: 0, minWidth: 160,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 8, ...shadow, zIndex: 100,
  },
  filterOpt:           { paddingHorizontal: 12, paddingVertical: 9 },
  filterOptActive:     { backgroundColor: colors.primary + '15' },
  filterOptText:       { fontSize: 13, color: colors.textPrimary },
  filterOptTextActive: { color: colors.primary, fontWeight: '700' },

  btnApply: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
  },
  btnApplyText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  btnClear: {
    width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.backgroundColor,
  },
  btnPrimary: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8,
  },
  btnPrimaryText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  btnOutline: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
    backgroundColor: colors.surface,
  },
  btnOutlineText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },

  tableScroll: { flex: 1 },
  tblHead: {
    flexDirection: 'row', backgroundColor: colors.primary + '0C',
    paddingVertical: 9, paddingHorizontal: 8, borderRadius: 6, marginBottom: 2,
  },
  tblTh: { fontSize: 11, fontWeight: '800', color: colors.primary },
  tblRow: {
    flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 8,
    borderBottomWidth: 1, borderBottomColor: colors.border, alignItems: 'center',
  },
  tblTd:      { fontSize: 12, color: colors.textPrimary, paddingRight: 4 },
  tblActions: { flexDirection: 'row', gap: 2 },
  actionBtn:  { padding: 5, borderRadius: 5 },

  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, alignSelf: 'flex-start' },
  badgeText: { fontSize: 10, fontWeight: '700' },

  emptyRow: { padding: 48, alignItems: 'center', gap: 8 },
  emptyText: { fontSize: 14, color: colors.textMuted },

  pagination: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, paddingHorizontal: 8, borderTopWidth: 1, borderTopColor: colors.border,
  },
  paginationInfo: { fontSize: 12, color: colors.textSecondary },
  paginationBtns: { flexDirection: 'row', gap: 4 },
  pageBtn: {
    width: 30, height: 30, borderRadius: 6, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  pageBtnActive:    { backgroundColor: colors.primary, borderColor: colors.primary },
  pageBtnDisabled:  { opacity: 0.4 },
  pageBtnText:      { fontSize: 12, color: colors.textPrimary, fontWeight: '600' },
  pageBtnTextActive:{ color: '#fff', fontWeight: '700' },

  centered:  { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText: { fontSize: 14, color: colors.danger, textAlign: 'center' },

  modalOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', zIndex: 999,
  },
  modal: {
    backgroundColor: colors.surface, borderRadius: 14, padding: 24, gap: 14,
    minWidth: 280, maxWidth: 400, ...shadow,
  },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  modalTitle:  { fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  attrRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  attrInput: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 8, fontSize: 12,
    color: colors.textPrimary, backgroundColor: colors.backgroundColor,
  },
  modalError:  { fontSize: 13, color: colors.danger },
  modalStats:  { gap: 4 },
  modalStat:   { fontSize: 14, color: colors.textPrimary, fontWeight: '600' },
  modalClose: {
    alignSelf: 'flex-end', backgroundColor: colors.primary,
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8,
  },
  modalCloseText: { fontSize: 13, color: '#fff', fontWeight: '700' },
  modalDesc:    { fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
  modalFields:  { flexDirection: 'row', gap: 10, flexWrap: 'wrap', zIndex: 10 },
  modalNone:    { fontSize: 13, color: colors.success, fontWeight: '600' },
  modalActions: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' },
});
