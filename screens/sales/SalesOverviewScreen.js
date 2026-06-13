import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

import AppShell from '../../components/AppShell';
import { colors } from '../../constants/colors';
import { globalHeight, globalWidth } from '../../constants/globalWidth';
import { getSalesOverview, matchSalesOrders, matchSalesTargets, waitForMatchJob, recalculateSharedSales, cleanupSalesDuplicates, applySharedSales, deleteSalesMonth } from '../../store/sales/salesActions';
import { listProducts } from '../../store/products/productActions';
import { listSalesChannels } from '../../store/salesChannels/salesChannelActions';
import { getLines } from '../../store/lines/linesActions';
import { listAreas } from '../../store/areas/areasActions';

const isManager = (role) =>
  ['admin', 'manager', 'senior_manager'].includes(String(role || '').toLowerCase());

const THIS_YEAR  = new Date().getFullYear();
const YEAR_OPTS  = [THIS_YEAR - 1, THIS_YEAR, THIS_YEAR + 1].map((y) => ({ value: String(y), label: String(y) }));
const MONTH_OPTS = [
  { value: '', label: 'All Months' },
  { value: '1',  label: 'January'   }, { value: '2',  label: 'February'  },
  { value: '3',  label: 'March'     }, { value: '4',  label: 'April'     },
  { value: '5',  label: 'May'       }, { value: '6',  label: 'June'      },
  { value: '7',  label: 'July'      }, { value: '8',  label: 'August'    },
  { value: '9',  label: 'September' }, { value: '10', label: 'October'   },
  { value: '11', label: 'November'  }, { value: '12', label: 'December'  },
];

const PIE_COLORS = ['#1D4ED8', '#7C3AED', '#16A34A', '#F59E0B', '#06B6D4', '#EF4444', '#EC4899', '#8B5CF6'];

const shadow = { shadowColor: '#11224A', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 14, elevation: 3 };
const PAD    = globalWidth('1.2%');

const fmtNum = (n) => {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
};
const fmtFullNum = (n) => (n == null ? '—' : Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 }));
const fmtCurrency = (v, cur = 'USD') => {
  if (v == null) return '—';
  const sym = cur === 'AED' ? 'AED ' : '$';
  return `${sym}${Number(v).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
};
const pick = (...vals) => vals.find((v) => v !== undefined && v !== null && v !== '');
const normalizeUploadedByCurrency = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => ({
      currency: item.currency || item._id || item.code || '—',
      value: pick(item.total, item.value, item.amount, item.uploadedSalesValue, item.salesValue, 0),
    }));
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).map(([currency, amount]) => ({
      currency,
      value: typeof amount === 'object'
        ? pick(amount.total, amount.value, amount.amount, amount.uploadedSalesValue, 0)
        : amount,
    }));
  }
  return [];
};
const fmtPct = (num, den) => {
  if (!den || den === 0) return '0%';
  return `${Math.round((num / den) * 100)}%`;
};

/* ── Sub-components ──────────────────────────────────────────────────── */

function FilterDropdown({ label, options, value, onChange, zIndex = 1 }) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  return (
    <View style={[{ position: 'relative', zIndex: open ? 60 : zIndex }]}>
      <Pressable style={styles.filterBtn} onPress={() => setOpen((v) => !v)}>
        {label ? <Text style={styles.filterBtnLabel}>{label}</Text> : null}
        <Text style={styles.filterBtnValue} numberOfLines={1}>{selected?.label || 'All'}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={11} color={colors.textMuted} />
      </Pressable>
      {open && (
        <View style={styles.filterDropdown}>
          <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
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

function StatCard({ icon, iconColor, iconBg, label, value, sub, small, accent }) {
  return (
    <View style={[styles.statCard, accent && { backgroundColor: accent.bg, borderColor: accent.border }]}>
      <View style={[styles.statIcon, { backgroundColor: accent ? accent.chip : iconBg }]}>
        <Ionicons name={icon} size={18} color={accent ? '#fff' : iconColor} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.statLabel, accent && { color: accent.label }]}>{label}</Text>
        <Text style={[styles.statValue, small && { fontSize: 18 }, accent && { color: accent.value }]}>{value ?? '—'}</Text>
        {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
      </View>
    </View>
  );
}

function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}
function CardHeader({ title, right }) {
  return (
    <View style={styles.cardHeader}>
      <Text style={styles.cardTitle}>{title}</Text>
      {right || null}
    </View>
  );
}

/* ── Merge multiple single-channel overview responses into one ── */
function mergeOverviews(overviews) {
  if (!overviews?.length) return null;
  if (overviews.length === 1) return overviews[0];

  const sum = { totalQuantity: 0, totalFocQuantity: 0, totalFreeQuantity: 0,
    totalCifUsd: 0, totalCalculatedCifUsd: 0,
    totalCalculatedWholesaleAed: 0, totalWholesaleAed: 0,
    totalCalculatedRetailAed: 0, totalRetailAed: 0,
    totalRecords: 0, recordsCount: 0 };

  overviews.forEach((ov) => {
    if (!ov) return;
    sum.totalQuantity               += ov.totalQuantity               ?? 0;
    sum.totalFocQuantity            += ov.totalFocQuantity            ?? 0;
    sum.totalFreeQuantity           += ov.totalFreeQuantity           ?? 0;
    sum.totalCifUsd                 += ov.totalCifUsd                 ?? 0;
    sum.totalCalculatedCifUsd       += ov.totalCalculatedCifUsd       ?? 0;
    sum.totalCalculatedWholesaleAed += ov.totalCalculatedWholesaleAed ?? 0;
    sum.totalWholesaleAed           += ov.totalWholesaleAed           ?? 0;
    sum.totalCalculatedRetailAed    += ov.totalCalculatedRetailAed    ?? 0;
    sum.totalRetailAed              += ov.totalRetailAed              ?? 0;
    sum.totalRecords                += ov.totalRecords                ?? 0;
    sum.recordsCount                += ov.recordsCount                ?? 0;
  });

  // Merge byProduct arrays — sum same product names
  const prodMap = {};
  overviews.forEach((ov) => {
    (ov?.byProduct || ov?.salesByProduct || []).forEach((p) => {
      const k = p.name || p._id;
      if (!prodMap[k]) prodMap[k] = { ...p, quantity: 0, totalQuantity: 0, focQuantity: 0, freeQuantity: 0, totalCalculatedCifUsd: 0, totalCalculatedWholesaleAed: 0 };
      prodMap[k].quantity               += p.quantity               ?? 0;
      prodMap[k].totalQuantity          += p.totalQuantity          ?? 0;
      prodMap[k].focQuantity            += p.focQuantity            ?? 0;
      prodMap[k].freeQuantity           += p.freeQuantity           ?? 0;
      prodMap[k].totalCalculatedCifUsd  += p.totalCalculatedCifUsd  ?? 0;
      prodMap[k].totalCalculatedWholesaleAed += p.totalCalculatedWholesaleAed ?? 0;
    });
  });
  sum.byProduct = Object.values(prodMap).sort((a, b) => (b.quantity || b.totalQuantity || 0) - (a.quantity || a.totalQuantity || 0));

  // Merge byAccount arrays
  const accMap = {};
  overviews.forEach((ov) => {
    (ov?.byAccount || ov?.salesByAccount || []).forEach((a) => {
      const k = a.shipToAccountName || a.name || a._id;
      if (!accMap[k]) accMap[k] = { ...a, quantity: 0, totalQuantity: 0 };
      accMap[k].quantity      += a.quantity      ?? 0;
      accMap[k].totalQuantity += a.totalQuantity ?? 0;
    });
  });
  sum.byAccount = Object.values(accMap).sort((a, b) => (b.quantity || b.totalQuantity || 0) - (a.quantity || a.totalQuantity || 0));

  // byChannel — concatenate (each entry is already a single channel)
  sum.byChannel = overviews.flatMap((ov) => ov?.byChannel || ov?.salesByChannel || []);

  // Uploaded sales by currency
  const curMap = {};
  overviews.forEach((ov) => {
    (ov?.uploadedSalesByCurrency || []).forEach((c) => {
      const k = c.currency || c._id;
      if (!curMap[k]) curMap[k] = { ...c, totalValue: 0 };
      curMap[k].totalValue += c.totalValue ?? 0;
    });
  });
  sum.uploadedSalesByCurrency = Object.values(curMap);

  return sum;
}

/* ── Main screen ─────────────────────────────────────────────────────── */

export default function SalesOverviewScreen({ navigation, userDetails, appMetadata, onSignOut }) {
  const user    = userDetails?.user || userDetails?.data?.user || userDetails || {};
  const token   = userDetails?.token || userDetails?.data?.token || '';
  const role    = user.role || '';
  const manager = isManager(role);

  const [overview,  setOverview]  = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');

  /* Staged filters */
  const [pendingYear,     setPendingYear]     = useState(String(THIS_YEAR));
  const [pendingMonth,    setPendingMonth]    = useState('');
  const [pendingProduct,  setPendingProduct]  = useState('');
  const [pendingLine,     setPendingLine]     = useState('');
  const [pendingArea,     setPendingArea]     = useState('');
  const [pendingChannels, setPendingChannels] = useState([]); // filled after channels load
  const [appliedFilters,  setAppliedFilters]  = useState({ year: String(THIS_YEAR) });

  /* Filter option lists */
  const [products,  setProducts]  = useState([]);
  const [channels,  setChannels]  = useState([]);
  const [lines,     setLines]     = useState([]);
  const [areas,     setAreas]     = useState([]);

  /* Refine dropdown */
  const [showRefineMenu, setShowRefineMenu] = useState(false);

  /* Matching state */
  const [matching,      setMatching]      = useState(false);
  const [matchResult,   setMatchResult]   = useState(null);
  const [matchError,    setMatchError]    = useState('');
  const [targetsMatching, setTargetsMatching] = useState(false);
  const [targetsResult,   setTargetsResult]   = useState(null);
  const [targetsError,    setTargetsError]    = useState('');
  const [recalcResult,  setRecalcResult]  = useState(null);

  /* Refine / duplicate-cleanup state */
  const [showRefineModal,  setShowRefineModal]  = useState(false);
  const [cleanupStep,      setCleanupStep]      = useState('input');
  const [cleanupRunning,   setCleanupRunning]   = useState(false);
  const [cleanupResult,    setCleanupResult]    = useState(null);
  const [cleanupError,     setCleanupError]     = useState('');
  const [cleanupYear,      setCleanupYear]      = useState('');
  const [cleanupMonth,     setCleanupMonth]     = useState('');

  /* Refine Sales Divisions state */
  const [showDivisionsModal, setShowDivisionsModal] = useState(false);
  const [divisionsStep,      setDivisionsStep]      = useState('input');
  const [divisionsRunning,   setDivisionsRunning]   = useState(false);
  const [divisionsResult,    setDivisionsResult]    = useState(null);
  const [divisionsError,     setDivisionsError]     = useState('');
  const [divisionsYear,      setDivisionsYear]      = useState('');
  const [divisionsMonth,     setDivisionsMonth]     = useState('');

  /* Delete month state */
  const [showDeleteModal,  setShowDeleteModal]  = useState(false);
  const [deleteStep,       setDeleteStep]       = useState('confirm'); // 'confirm' | 'result'
  const [deleteRunning,    setDeleteRunning]    = useState(false);
  const [deleteResult,     setDeleteResult]     = useState(null);
  const [deleteError,      setDeleteError]      = useState('');
  const [deleteYear,       setDeleteYear]       = useState('');
  const [deleteMonth,      setDeleteMonth]      = useState('');

  /* Load filter options */
  useEffect(() => {
    listProducts(token, { limit: 300, status: 'active' })
      .then(({ products: p }) => setProducts(Array.isArray(p) ? p : []))
      .catch(() => {});
    listSalesChannels(token, { status: 'active' })
      .then(({ channels: c }) => {
        const ch = Array.isArray(c) ? c : [];
        setChannels(ch);
        setPendingChannels(ch.map((x) => x._id || x.channelId).filter(Boolean));
      })
      .catch(() => {});
    getLines(token)
      .then((d) => setLines(Array.isArray(d) ? d : []))
      .catch(() => {});
    listAreas(token, { status: 'active' })
      .then((d) => setAreas(Array.isArray(d?.areas) ? d.areas : []))
      .catch(() => {});
  }, [token]);

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const base = {};
      if (appliedFilters.year)    base.year      = appliedFilters.year;
      if (appliedFilters.month)   base.month     = appliedFilters.month;
      if (appliedFilters.product) base.productId = appliedFilters.product;
      if (appliedFilters.line)    base.lineId    = appliedFilters.line;
      if (appliedFilters.area)    base.areaId    = appliedFilters.area;

      const selectedChs = appliedFilters.channels || []; // [] means all

      let data;
      if (selectedChs.length === 0) {
        data = await getSalesOverview(token, base);
      } else if (selectedChs.length === 1) {
        data = await getSalesOverview(token, { ...base, channelId: selectedChs[0] });
      } else {
        // Multiple channels selected — parallel calls then merge
        const results = await Promise.all(
          selectedChs.map((chId) =>
            getSalesOverview(token, { ...base, channelId: chId }).catch(() => null)
          )
        );
        data = mergeOverviews(results.filter(Boolean));
      }

      setOverview(data);
    } catch (e) {
      setError(e.message || 'Failed to load sales overview');
    } finally {
      setLoading(false);
    }
  }, [token, appliedFilters]);

  useEffect(() => { fetchOverview(); }, [fetchOverview]);

  const toggleChannel = (id) => {
    setPendingChannels((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const handleApply = () => {
    setShowRefineMenu(false);
    const allIds = channels.map((c) => c._id || c.channelId).filter(Boolean);
    const isAll  = pendingChannels.length === 0 || pendingChannels.length === allIds.length;
    setAppliedFilters({
      year:     pendingYear,
      month:    pendingMonth,
      product:  pendingProduct,
      channels: isAll ? [] : [...pendingChannels], // [] = all; array of IDs = filtered
      line:     pendingLine,
      area:     pendingArea,
    });
  };

  const handleClear = () => {
    setPendingYear(String(THIS_YEAR));
    setPendingMonth('');
    setPendingProduct('');
    setPendingLine('');
    setPendingArea('');
    setPendingChannels(channels.map((c) => c._id || c.channelId).filter(Boolean));
    setAppliedFilters({ year: String(THIS_YEAR) });
  };

  const handleRunTargetsMatching = async () => {
    setTargetsMatching(true); setTargetsResult(null); setTargetsError('');
    try {
      // year/month are required by the batch matching endpoints.
      const now = new Date();
      const start = await matchSalesTargets(token, {
        year: Number(appliedFilters?.year) || now.getFullYear(),
        month: Number(appliedFilters?.month) || now.getMonth() + 1,
      });
      const res = start?.started ? await waitForMatchJob(token, 'targets') : start;
      setTargetsResult(res);
    } catch (e) {
      setTargetsError(e.message || 'Targets matching failed');
    } finally {
      setTargetsMatching(false);
    }
  };

  const handleRunMatching = async () => {
    setMatching(true); setMatchResult(null); setMatchError('');
    try {
      // year/month are required by the batch matching endpoints.
      const now = new Date();
      const start = await matchSalesOrders(token, {
        year: Number(appliedFilters?.year) || now.getFullYear(),
        month: Number(appliedFilters?.month) || now.getMonth() + 1,
      });
      const res = start?.started ? await waitForMatchJob(token, 'orders') : start;
      setMatchResult(res);
    } catch (e) {
      setMatchError(e.message || 'Matching failed');
    } finally {
      setMatching(false);
    }
  };

  const handleRecalculateShared = async () => {
    if (!window.confirm('This will recalculate area shares based on current shared sales rules. Continue?')) return;
    const res = await recalculateSharedSales(token, {
      year:   appliedFilters.year  ? Number(appliedFilters.year)  : undefined,
      month:  appliedFilters.month ? Number(appliedFilters.month) : undefined,
      areaId: appliedFilters.area  || undefined,
    });
    setRecalcResult(res);
    fetchOverview();
  };

  const handleOpenRefine = () => {
    setCleanupStep('input');
    setCleanupResult(null);
    setCleanupError('');
    setCleanupYear(String(appliedFilters.year || THIS_YEAR));
    setCleanupMonth(String(appliedFilters.month || ''));
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
        year: Number(cleanupYear), month: Number(cleanupMonth), apply: false,
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
        year: Number(cleanupYear), month: Number(cleanupMonth),
      });
      setCleanupResult(res);
      setCleanupStep('result');
      fetchOverview();
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
    setDivisionsYear(String(appliedFilters.year || THIS_YEAR));
    setDivisionsMonth(String(appliedFilters.month || ''));
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
        year: Number(divisionsYear), month: Number(divisionsMonth),
      });
      setDivisionsResult(res);
      setDivisionsStep('result');
      fetchOverview();
    } catch (e) {
      setDivisionsError(e.message || 'Unable to refine sales divisions. Please try again.');
    } finally {
      setDivisionsRunning(false);
    }
  };

  const handleOpenDelete = () => {
    setDeleteStep('confirm');
    setDeleteResult(null);
    setDeleteError('');
    setDeleteYear(String(appliedFilters.year || THIS_YEAR));
    setDeleteMonth(String(appliedFilters.month || ''));
    setShowDeleteModal(true);
  };

  const handleDeleteMonth = async () => {
    if (!deleteYear || !deleteMonth) {
      setDeleteError('Please select both year and month before deleting.');
      return;
    }
    setDeleteRunning(true);
    setDeleteError('');
    try {
      const res = await deleteSalesMonth(token, {
        year: Number(deleteYear),
        month: Number(deleteMonth),
      });
      setDeleteResult(res);
      setDeleteStep('result');
      fetchOverview();
    } catch (e) {
      setDeleteError(e.message || 'Failed to delete sales data. Please try again.');
    } finally {
      setDeleteRunning(false);
    }
  };

  /* Derived values */
  const totalQty         = overview?.totalQuantity                                      ?? 0;
  const totalFocQty      = pick(overview?.totalFocQuantity, overview?.totalFreeQuantity) ?? 0;
  const cifUsd           = pick(overview?.totalCalculatedCifUsd, overview?.totalCifUsd)  ?? 0;
  const wholesaleAed     = pick(overview?.totalCalculatedWholesaleAed, overview?.totalWholesaleAed) ?? 0;
  const retailAed        = pick(overview?.totalCalculatedRetailAed, overview?.totalRetailAed) ?? 0;
  const totalRecords     = pick(overview?.totalRecords, overview?.recordsCount)          ?? 0;
  const matchedCount     = overview?.matchedOrdersCount                                  ?? 0;
  const unmatchedCount   = pick(overview?.unmatchedCount, overview?.unmatchedSalesRecordsCount) ?? 0;
  const needsReviewCount = overview?.needsReviewCount                                    ?? 0;
  const sharedQty        = overview?.totalSharedQuantity                                 ?? 0;
  const sharedFocQty     = overview?.totalSharedFreeQuantity                             ?? 0;
  const sharedCifUsd     = overview?.totalSharedCalculatedCifUsd                        ?? 0;
  const sharedWholesale  = overview?.totalSharedCalculatedWholesaleAed                  ?? 0;
  const sharedRetail     = overview?.totalSharedCalculatedRetailAed                     ?? 0;
  const areaShare        = overview?.areaShare;

  const byProduct  = Array.isArray(overview?.byProduct)  ? overview.byProduct.slice(0, 8)
    : Array.isArray(overview?.salesByProduct)  ? overview.salesByProduct.slice(0, 8)  : [];
  const byAccount  = Array.isArray(overview?.byAccount)  ? overview.byAccount.slice(0, 20)
    : Array.isArray(overview?.salesByAccount)  ? overview.salesByAccount.slice(0, 20)  : [];
  const byChannel  = Array.isArray(overview?.byChannel)  ? overview.byChannel
    : Array.isArray(overview?.salesByChannel)  ? overview.salesByChannel               : [];
  const uploadedSalesByCurrency = normalizeUploadedByCurrency(overview?.uploadedSalesByCurrency);

  const isEmptyData = !loading && !error && (
    overview === null ||
    (totalRecords === 0 && totalQty === 0 && cifUsd === 0 && wholesaleAed === 0 && retailAed === 0)
  );

  const groupQuantity = (item) => pick(item?.quantity, item?.value, item?.totalQuantity, 0);
  const groupValue    = (item) => pick(
    item?.value, item?.totalCalculatedCifUsd,
    item?.totalCalculatedWholesaleAed, item?.totalCalculatedRetailAed, 0,
  );

  const productDonut = byProduct.map((p, i) => ({
    name: p.name || `Product ${i + 1}`, value: groupQuantity(p), color: PIE_COLORS[i % PIE_COLORS.length],
  }));
  const channelDonut = byChannel.map((c, i) => ({
    name: c.name || `Channel ${i + 1}`, value: groupQuantity(c), color: PIE_COLORS[i % PIE_COLORS.length],
  }));
  const productDonutTotal = productDonut.reduce((s, d) => s + d.value, 0);
  const channelDonutTotal = channelDonut.reduce((s, d) => s + d.value, 0);

  const productOpts = [{ value: '', label: 'All Products' }, ...products.map((p) => ({ value: p._id || p.productId, label: p.productName || p.name || '—' }))];
  const lineOpts    = [{ value: '', label: 'All Lines' },    ...lines.map((l)    => ({ value: l._id || l.lineId,    label: l.lineName    || l.name    || '—' }))];
  const areaOpts    = [{ value: '', label: 'All Areas' },    ...areas.map((a)    => ({ value: a._id || a.id,        label: a.areaName    || a.name    || '—' }))];

  const allChannelIds   = channels.map((c) => c._id || c.channelId).filter(Boolean);
  const hasChannelFilter = pendingChannels.length > 0 && pendingChannels.length < allChannelIds.length;
  const hasActive        = !!(pendingMonth || pendingProduct || pendingLine || pendingArea || hasChannelFilter);

  return (
    <AppShell navigation={navigation} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} activeRoute="SalesOverview">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* ── Page header ── */}
        <View style={styles.pageHeader}>
          <View>
            <Text style={styles.pageTitle}>Sales Overview</Text>
            <Text style={styles.pageSubtitle}>Upload, track and analyse your actual sales data</Text>
          </View>
          <View style={styles.headerRight}>
            {manager && (
              <Pressable style={styles.btnPrimary} onPress={() => navigation.navigate('SalesUpload')}>
                <Ionicons name="cloud-upload-outline" size={14} color="#fff" />
                <Text style={styles.btnPrimaryText}>Upload Sales</Text>
              </Pressable>
            )}
            <Pressable style={styles.btnOutline}>
              <Ionicons name="download-outline" size={14} color={colors.textSecondary} />
              <Text style={styles.btnOutlineText}>Export</Text>
            </Pressable>
          </View>
        </View>

        {/* ── Filter bar ── */}
        <View style={styles.filtersBar}>
          <FilterDropdown label="Year"    options={YEAR_OPTS}   value={pendingYear}    onChange={setPendingYear}    zIndex={26} />
          <FilterDropdown label="Month"   options={MONTH_OPTS}  value={pendingMonth}   onChange={setPendingMonth}   zIndex={25} />
          <FilterDropdown label="Product" options={productOpts} value={pendingProduct} onChange={setPendingProduct} zIndex={24} />
          <FilterDropdown label="Line"    options={lineOpts}    value={pendingLine}    onChange={setPendingLine}    zIndex={22} />
          <FilterDropdown label="Area"    options={areaOpts}    value={pendingArea}    onChange={setPendingArea}    zIndex={21} />

          <View style={{ flex: 1 }} />

          {hasActive && (
            <Pressable style={styles.btnClear} onPress={handleClear}>
              <Ionicons name="refresh-outline" size={13} color={colors.textSecondary} />
              <Text style={styles.btnClearText}>Clear</Text>
            </Pressable>
          )}

          <Pressable style={styles.btnApply} onPress={handleApply}>
            <Ionicons name="options-outline" size={13} color="#fff" />
            <Text style={styles.btnApplyText}>Apply</Text>
          </Pressable>

          {manager && (
            <View style={{ position: 'relative', zIndex: 30 }}>
              <Pressable
                style={[styles.btnOutline, showRefineMenu && styles.btnOutlineActive]}
                onPress={() => setShowRefineMenu((v) => !v)}
              >
                <Ionicons name="apps-outline" size={13} color={showRefineMenu ? colors.primary : colors.textSecondary} />
                <Text style={[styles.btnOutlineText, showRefineMenu && { color: colors.primary }]}>Refine</Text>
              </Pressable>
              {showRefineMenu && (
                <View style={styles.refineMenu}>
                  <Pressable style={styles.refineMenuItem} onPress={() => { setShowRefineMenu(false); handleOpenRefine(); }}>
                    <Ionicons name="cut-outline" size={14} color={colors.textSecondary} />
                    <Text style={styles.refineMenuText}>Refine Sales Data</Text>
                  </Pressable>
                  <View style={styles.refineMenuDivider} />
                  <Pressable style={styles.refineMenuItem} onPress={() => { setShowRefineMenu(false); handleOpenDivisions(); }}>
                    <Ionicons name="git-branch-outline" size={14} color={colors.textSecondary} />
                    <Text style={styles.refineMenuText}>Refine Sales Divisions</Text>
                  </Pressable>
                  <View style={styles.refineMenuDivider} />
                  <Pressable style={styles.refineMenuItem} onPress={() => { setShowRefineMenu(false); handleOpenDelete(); }}>
                    <Ionicons name="trash-outline" size={14} color={colors.danger} />
                    <Text style={[styles.refineMenuText, { color: colors.danger }]}>Delete Month Sales</Text>
                  </Pressable>
                </View>
              )}
            </View>
          )}
        </View>

        {/* ── Channel toggle row ── */}
        {channels.length > 0 && (
          <View style={styles.channelRow}>
            <Text style={styles.channelLabel}>CHANNEL</Text>
            {channels.map((ch) => {
              const id       = ch._id || ch.channelId;
              const name     = ch.channelName || ch.channelKey || '—';
              const selected = pendingChannels.includes(id);
              return (
                <Pressable
                  key={id}
                  style={[styles.channelPill, selected && styles.channelPillActive]}
                  onPress={() => toggleChannel(id)}
                >
                  {selected && <Ionicons name="checkmark" size={11} color={colors.primary} />}
                  <Text style={[styles.channelPillText, selected && styles.channelPillTextActive]}>{name}</Text>
                </Pressable>
              );
            })}
          </View>
        )}

        {loading ? (
          <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
        ) : error ? (
          <View style={styles.centered}>
            <Ionicons name="alert-circle-outline" size={32} color={colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.btnOutline} onPress={fetchOverview}>
              <Text style={styles.btnOutlineText}>Retry</Text>
            </Pressable>
          </View>
        ) : isEmptyData ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyStateIcon}>
              <Ionicons name="bar-chart-outline" size={36} color={colors.textMuted} />
            </View>
            <Text style={styles.emptyStateTitle}>No sales data for this period</Text>
            <Text style={styles.emptyStateMsg}>
              There are no sales records matching the selected filters.{'\n'}
              Try adjusting the year or month, or upload sales data to get started.
            </Text>
            <View style={styles.emptyStateActions}>
              {manager && (
                <Pressable style={styles.btnPrimary} onPress={() => navigation.navigate('SalesUpload')}>
                  <Ionicons name="cloud-upload-outline" size={14} color="#fff" />
                  <Text style={styles.btnPrimaryText}>Upload Sales Data</Text>
                </Pressable>
              )}
              {(appliedFilters.month || appliedFilters.product || (appliedFilters.channels?.length > 0) || appliedFilters.line) && (
                <Pressable style={styles.btnOutline} onPress={handleClear}>
                  <Ionicons name="refresh-outline" size={14} color={colors.textSecondary} />
                  <Text style={styles.btnOutlineText}>Clear Filters</Text>
                </Pressable>
              )}
            </View>
          </View>
        ) : (
          <>
            {/* ── Stats Row 1 — key values ── */}
            <View style={styles.statsRow}>
              <StatCard icon="cube-outline"      accent={colors.accents.blue}  label="Total Quantity (Units)"      value={fmtFullNum(totalQty)} />
              <StatCard icon="gift-outline"       accent={colors.accents.teal}  label="FOC Quantity (Units)"        value={fmtFullNum(totalFocQty)} />
              <StatCard icon="globe-outline"      accent={colors.accents.rose}  label="Calculated CIF Value (USD)"  value={fmtCurrency(cifUsd)} small />
              <StatCard icon="storefront-outline" accent={colors.accents.amber} label="Calc. Wholesale (AED)"       value={fmtCurrency(wholesaleAed, 'AED')} small />
              <StatCard icon="pricetag-outline"   accent={colors.accents.blue}  label="Calc. Retail (AED)"          value={fmtCurrency(retailAed, 'AED')} small />
            </View>

            {/* ── Uploaded sales wide cards ── */}
            {uploadedSalesByCurrency.length > 0 && (
              <View style={styles.uploadedRow}>
                {uploadedSalesByCurrency.map((item) => (
                  <View key={item.currency} style={styles.uploadedCard}>
                    <View style={[styles.uploadedIcon, { backgroundColor: '#FFFBEB' }]}>
                      <Ionicons name="receipt-outline" size={22} color="#F59E0B" />
                    </View>
                    <View>
                      <Text style={styles.uploadedLabel}>Uploaded Sales ({item.currency})</Text>
                      <Text style={styles.uploadedValue}>{fmtCurrency(item.value, item.currency)}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Area shared stats (only when area filter is active) */}
            {appliedFilters.area ? (
              <View style={styles.statsRow}>
                <StatCard icon="git-network-outline" iconColor="#8B5CF6" iconBg="#F5F3FF" label="Shared Quantity" value={fmtNum(sharedQty)} sub={`FOC ${fmtNum(sharedFocQty)}`} />
                <StatCard icon="globe-outline" iconColor="#06B6D4" iconBg="#ECFEFF" label="Shared CIF USD" value={fmtCurrency(sharedCifUsd)} small />
                <StatCard icon="storefront-outline" iconColor="#16A34A" iconBg="#F0FDF4" label="Shared Wholesale AED" value={fmtCurrency(sharedWholesale, 'AED')} small />
                <StatCard icon="pricetag-outline" iconColor="#EF4444" iconBg="#FEF2F2" label="Shared Retail AED" value={fmtCurrency(sharedRetail, 'AED')} small />
                <StatCard icon="pie-chart-outline" iconColor="#8B5CF6" iconBg="#F5F3FF" label="Shared Sales %" value={areaShare != null ? `${Number(areaShare).toFixed(1)}%` : '—'} small />
              </View>
            ) : null}

            {recalcResult && (
              <View style={styles.noticeBox}>
                <Text style={styles.noticeText}>Recalculation complete: {JSON.stringify(recalcResult)}</Text>
              </View>
            )}

            {/* ── Stats Row 2 — records/matching ── */}
            <View style={styles.statsRow}>
              <StatCard icon="list-outline"             accent={colors.accents.blue}  label="Total Records"   value={fmtNum(totalRecords)} />
              <StatCard icon="checkmark-circle-outline" accent={colors.accents.teal}  label="Matched Orders"  value={fmtNum(matchedCount)}      sub={fmtPct(matchedCount, totalRecords)} />
              <StatCard icon="alert-circle-outline"     accent={colors.accents.amber} label="Unmatched Sales" value={fmtNum(unmatchedCount)}     sub={fmtPct(unmatchedCount, totalRecords)} />
              <StatCard icon="eye-outline"              accent={colors.accents.rose}  label="Needs Review"    value={fmtNum(needsReviewCount)}   sub={fmtPct(needsReviewCount, totalRecords)} />
            </View>

            {/* ── Chart grid ── */}
            <View style={styles.gridRow}>

              {/* Sales by Product */}
              <Card style={styles.gridCol}>
                <CardHeader title="Sales by Product · Top 8" />
                {byProduct.length === 0 ? (
                  <View style={styles.emptyBox}>
                    <Ionicons name="cube-outline" size={28} color={colors.textMuted} />
                    <Text style={styles.emptyText}>No product data</Text>
                  </View>
                ) : (
                  <>
                    <View style={styles.donutRow}>
                      <View style={{ position: 'relative' }}>
                        <PieChart width={130} height={130}>
                          <Pie data={productDonut} cx={60} cy={60} innerRadius={38} outerRadius={58}
                            dataKey="value" paddingAngle={productDonut.length > 1 ? 2 : 0} startAngle={90} endAngle={-270}>
                            {productDonut.map((e, i) => <Cell key={i} fill={e.color} />)}
                          </Pie>
                        </PieChart>
                        <View style={styles.donutCenter}>
                          <Text style={styles.donutTotal}>{fmtNum(productDonutTotal)}</Text>
                          <Text style={styles.donutTotalLbl}>Units</Text>
                        </View>
                      </View>
                      <View style={styles.donutLegend}>
                        {productDonut.map((item) => (
                          <View key={item.name} style={styles.donutLegendRow}>
                            <View style={[styles.donutDot, { backgroundColor: item.color }]} />
                            <Text style={styles.donutLegendLabel} numberOfLines={1}>{item.name}</Text>
                            {productDonutTotal > 0 && (
                              <Text style={styles.donutLegendPct}>{((item.value / productDonutTotal) * 100).toFixed(1)}%</Text>
                            )}
                          </View>
                        ))}
                      </View>
                    </View>
                    <View style={styles.miniTableHead}>
                      <Text style={[styles.miniTh, { flex: 2 }]}>PRODUCT</Text>
                      <Text style={styles.miniTh}>QTY</Text>
                      <Text style={styles.miniTh}>VALUE</Text>
                    </View>
                    {byProduct.map((p, i) => (
                      <View key={i} style={styles.miniTableRow}>
                        <Text style={[styles.miniTd, { flex: 2 }]} numberOfLines={1}>{p.name || '—'}</Text>
                        <Text style={styles.miniTd}>{fmtNum(groupQuantity(p))}</Text>
                        <Text style={styles.miniTd}>{fmtCurrency(groupValue(p))}</Text>
                      </View>
                    ))}
                  </>
                )}
              </Card>

              {/* Sales by Account */}
              <Card style={styles.gridCol}>
                <CardHeader title="Sales by Account · Top 8" />
                {byAccount.length === 0 ? (
                  <View style={styles.emptyBox}>
                    <Ionicons name="business-outline" size={28} color={colors.textMuted} />
                    <Text style={styles.emptyText}>No account data</Text>
                  </View>
                ) : (
                  <View style={{ height: 540 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={byAccount.map((a) => ({
                          name:     (a.shipToAccountName || a.name || '—').substring(0, 14),
                          value:    a.value ?? 0,
                          currency: a.currency || 'AED',
                        }))}
                        layout="vertical"
                        margin={{ top: 0, right: 30, left: 4, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#F1F5F9" />
                        <XAxis type="number" tick={{ fontSize: 10, fill: '#94A3B8' }} axisLine={false} tickLine={false} tickFormatter={(v) => fmtNum(v)} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#64748B' }} axisLine={false} tickLine={false} width={90} />
                        <Tooltip formatter={(v, _name, props) => [`${fmtNum(v)} ${props.payload.currency}`, 'Value']} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                        <Bar dataKey="value" fill={colors.primary} radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </View>
                )}
              </Card>

              {/* Sales by Channel */}
              <Card style={styles.gridCol}>
                <CardHeader
                  title="Sales by Channel"
                  right={
                    <Pressable
                      style={styles.viewBreakdownBtn}
                      onPress={() => navigation.navigate('SalesChannelBreakdown', { filters: appliedFilters })}
                    >
                      <Text style={styles.viewBreakdownText}>Full Breakdown</Text>
                      <Ionicons name="arrow-forward-outline" size={12} color={colors.primary} />
                    </Pressable>
                  }
                />
                {byChannel.length === 0 ? (
                  <View style={styles.emptyBox}>
                    <Ionicons name="radio-button-on-outline" size={28} color={colors.textMuted} />
                    <Text style={styles.emptyText}>No channel data</Text>
                  </View>
                ) : (
                  <View style={styles.donutRow}>
                    <View style={{ position: 'relative' }}>
                      <PieChart width={150} height={150}>
                        <Pie data={channelDonut} cx={70} cy={70} innerRadius={46} outerRadius={68}
                          dataKey="value" paddingAngle={channelDonut.length > 1 ? 2 : 0} startAngle={90} endAngle={-270}>
                          {channelDonut.map((e, i) => <Cell key={i} fill={e.color} />)}
                        </Pie>
                      </PieChart>
                      <View style={styles.donutCenter}>
                        <Text style={[styles.donutTotal, { fontSize: 13 }]}>{fmtNum(channelDonutTotal)}</Text>
                        <Text style={styles.donutTotalLbl}>Total</Text>
                      </View>
                    </View>
                    <View style={styles.donutLegend}>
                      {channelDonut.map((item) => (
                        <View key={item.name} style={styles.donutLegendRow}>
                          <View style={[styles.donutDot, { backgroundColor: item.color }]} />
                          <Text style={styles.donutLegendLabel}>{item.name}</Text>
                          <Text style={styles.donutLegendPct}>
                            {channelDonutTotal > 0 ? `${((item.value / channelDonutTotal) * 100).toFixed(1)}%` : '—'}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </Card>

            </View>

            {/* ── What's Next ── */}
            <Card>
              <CardHeader title="What's Next? — Upcoming Integrations" />
              <View style={styles.nextRow}>

                <View style={styles.nextCard}>
                  <View style={styles.nextCardTop}>
                    <View style={[styles.nextIcon, { backgroundColor: '#EFF6FF' }]}>
                      <Ionicons name="git-compare-outline" size={20} color="#1D4ED8" />
                    </View>
                    <View style={[styles.nextBadge, { backgroundColor: '#DCFCE7' }]}>
                      <Text style={[styles.nextBadgeText, { color: '#15803D' }]}>Ready</Text>
                    </View>
                  </View>
                  <Text style={styles.nextTitle}>Orders Matching</Text>
                  <Text style={styles.nextDesc}>Match sales records to approved orders for validation</Text>
                  {manager && (
                    <Pressable
                      style={[styles.nextBtn, matching && { opacity: 0.6 }]}
                      onPress={handleRunMatching}
                      disabled={matching}
                    >
                      {matching
                        ? <ActivityIndicator size={12} color="#fff" />
                        : <Ionicons name="play-outline" size={12} color="#fff" />}
                      <Text style={styles.nextBtnText}>{matching ? 'Running…' : 'Run Matching'}</Text>
                    </Pressable>
                  )}
                  {matchResult && (
                    <Text style={styles.matchResultOk}>
                      Done: {matchResult.matchedCount ?? matchResult.matched ?? 0} matched, {matchResult.needsReviewCount ?? matchResult.unmatched ?? 0} need review
                    </Text>
                  )}
                  {matchError ? <Text style={styles.matchResultErr}>{matchError}</Text> : null}
                </View>

                <View style={styles.nextCard}>
                  <View style={styles.nextCardTop}>
                    <View style={[styles.nextIcon, { backgroundColor: '#F5F3FF' }]}>
                      <Ionicons name="flag-outline" size={20} color="#7C3AED" />
                    </View>
                    <View style={[styles.nextBadge, { backgroundColor: '#DCFCE7' }]}>
                      <Text style={[styles.nextBadgeText, { color: '#15803D' }]}>Ready</Text>
                    </View>
                  </View>
                  <Text style={styles.nextTitle}>Targets Matching</Text>
                  <Text style={styles.nextDesc}>Compare actual sales performance vs assigned targets</Text>
                  {manager && (
                    <Pressable
                      style={[styles.nextBtn, targetsMatching && { opacity: 0.6 }]}
                      onPress={handleRunTargetsMatching}
                      disabled={targetsMatching}
                    >
                      {targetsMatching
                        ? <ActivityIndicator size={12} color="#fff" />
                        : <Ionicons name="play-outline" size={12} color="#fff" />}
                      <Text style={styles.nextBtnText}>{targetsMatching ? 'Running…' : 'Run Matching'}</Text>
                    </Pressable>
                  )}
                  {targetsResult && (
                    <Text style={styles.matchResultOk}>
                      Done: {targetsResult.matchedCount ?? targetsResult.matched ?? 0} matched, {targetsResult.needsReviewCount ?? targetsResult.unmatched ?? 0} need review
                    </Text>
                  )}
                  {targetsError ? <Text style={styles.matchResultErr}>{targetsError}</Text> : null}
                </View>

                <View style={styles.nextCard}>
                  <View style={styles.nextCardTop}>
                    <View style={[styles.nextIcon, { backgroundColor: '#ECFEFF' }]}>
                      <Ionicons name="trending-up-outline" size={20} color="#06B6D4" />
                    </View>
                    <View style={[styles.nextBadge, { backgroundColor: '#DCFCE7' }]}>
                      <Text style={[styles.nextBadgeText, { color: '#15803D' }]}>Ready</Text>
                    </View>
                  </View>
                  <Text style={styles.nextTitle}>Forecast Matching</Text>
                  <Text style={styles.nextDesc}>Compare actual sales against demand forecasts</Text>
                  <Pressable
                    style={styles.nextBtn}
                    onPress={() => navigation.navigate('ForecastMatching')}
                  >
                    <Ionicons name="open-outline" size={12} color="#fff" />
                    <Text style={styles.nextBtnText}>Open Report</Text>
                  </Pressable>
                </View>

                <View style={[styles.nextCard, styles.nextCardMuted]}>
                  <View style={styles.nextCardTop}>
                    <View style={[styles.nextIcon, { backgroundColor: '#FFF7ED' }]}>
                      <Ionicons name="sparkles-outline" size={20} color="#F59E0B" />
                    </View>
                    <View style={[styles.nextBadge, { backgroundColor: '#FEF3C7' }]}>
                      <Text style={[styles.nextBadgeText, { color: '#92400E' }]}>Coming Soon</Text>
                    </View>
                  </View>
                  <Text style={styles.nextTitle}>AI Analysis</Text>
                  <Text style={styles.nextDesc}>AI-powered insights, anomaly detection & recommendations</Text>
                </View>

              </View>
            </Card>
          </>
        )}
      </ScrollView>

      {/* ── Refine Sales Data modal ── */}
      {showRefineModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
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
                  <FilterDropdown label="Year"  options={YEAR_OPTS}                         value={cleanupYear}  onChange={setCleanupYear}  zIndex={12} />
                  <FilterDropdown label="Month" options={MONTH_OPTS.filter((o) => o.value)} value={cleanupMonth} onChange={setCleanupMonth} zIndex={11} />
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
                <Pressable style={[styles.btnPrimary, { alignSelf: 'flex-end' }]} onPress={() => setShowRefineModal(false)}>
                  <Text style={styles.btnPrimaryText}>Done</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      )}

      {/* ── Refine Sales Divisions modal ── */}
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
                  This will apply shared sales rules to records in the selected month, distributing
                  sales across the correct areas and divisions.
                </Text>
                <View style={styles.modalFields}>
                  <FilterDropdown label="Year"  options={YEAR_OPTS}                         value={divisionsYear}  onChange={setDivisionsYear}  zIndex={12} />
                  <FilterDropdown label="Month" options={MONTH_OPTS.filter((o) => o.value)} value={divisionsMonth} onChange={setDivisionsMonth} zIndex={11} />
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
                <Pressable style={[styles.btnPrimary, { alignSelf: 'flex-end' }]} onPress={() => setShowDivisionsModal(false)}>
                  <Text style={styles.btnPrimaryText}>Done</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      )}
      {/* ── Delete Month Sales modal ── */}
      {showDeleteModal && (
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Ionicons
                name={deleteStep === 'result' && !deleteError ? 'checkmark-circle' : 'trash-outline'}
                size={24}
                color={deleteStep === 'result' && !deleteError ? colors.success : colors.danger}
              />
              <Text style={[styles.modalTitle, deleteStep !== 'result' && { color: colors.danger }]}>
                Delete Month Sales
              </Text>
            </View>

            {deleteStep === 'confirm' && (
              <>
                <View style={styles.deleteBanner}>
                  <Ionicons name="warning-outline" size={16} color="#92400E" />
                  <Text style={styles.deleteBannerText}>
                    This will permanently delete all sales records for the selected month. This action cannot be undone.
                  </Text>
                </View>
                <View style={styles.modalFields}>
                  <FilterDropdown label="Year"  options={YEAR_OPTS}                         value={deleteYear}  onChange={setDeleteYear}  zIndex={12} />
                  <FilterDropdown label="Month" options={MONTH_OPTS.filter((o) => o.value)} value={deleteMonth} onChange={setDeleteMonth} zIndex={11} />
                </View>
                {deleteError ? <Text style={styles.modalError}>{deleteError}</Text> : null}
                <View style={styles.modalActions}>
                  <Pressable style={styles.btnOutline} onPress={() => setShowDeleteModal(false)} disabled={deleteRunning}>
                    <Text style={styles.btnOutlineText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.btnDanger, deleteRunning && { opacity: 0.6 }]}
                    onPress={handleDeleteMonth}
                    disabled={deleteRunning}
                  >
                    {deleteRunning
                      ? <ActivityIndicator size={12} color="#fff" />
                      : <Ionicons name="trash-outline" size={13} color="#fff" />}
                    <Text style={styles.btnDangerText}>
                      {deleteRunning ? 'Deleting…' : 'Delete Sales'}
                    </Text>
                  </Pressable>
                </View>
              </>
            )}

            {deleteStep === 'result' && (
              <>
                <View style={styles.modalStats}>
                  {deleteResult?.deletedCount != null && (
                    <Text style={styles.modalStat}>Records deleted: {deleteResult.deletedCount}</Text>
                  )}
                  {deleteResult?.message && (
                    <Text style={styles.modalStat}>{deleteResult.message}</Text>
                  )}
                </View>
                {deleteError ? <Text style={styles.modalError}>{deleteError}</Text> : null}
                <Pressable style={[styles.btnPrimary, { alignSelf: 'flex-end' }]} onPress={() => setShowDeleteModal(false)}>
                  <Text style={styles.btnPrimaryText}>Done</Text>
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
  scroll: { padding: PAD, gap: 14, paddingBottom: 48 },

  /* Page header */
  pageHeader: {
    flexDirection: 'row', alignItems: 'flex-start',
    justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
  },
  pageTitle:    { fontSize: 22, fontWeight: '800', color: colors.textPrimary },
  pageSubtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  headerRight:  { flexDirection: 'row', alignItems: 'center', gap: 10 },

  /* Filter bar */
  filtersBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    ...shadow,
    zIndex: 20,
  },

  /* Filter dropdown control */
  filterBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: colors.backgroundColor,
  },
  filterBtnLabel: { fontSize: 9, color: colors.textMuted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  filterBtnValue: { fontSize: 12, color: colors.textPrimary, fontWeight: '600', maxWidth: 90 },
  filterDropdown: {
    position: 'absolute', top: 38, left: 0, minWidth: 150,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 8, ...shadow, zIndex: 100,
  },
  filterOpt:           { paddingHorizontal: 12, paddingVertical: 9 },
  filterOptActive:     { backgroundColor: colors.primary + '15' },
  filterOptText:       { fontSize: 13, color: colors.textPrimary },
  filterOptTextActive: { color: colors.primary, fontWeight: '700' },

  /* Refine dropdown menu */
  refineMenu: {
    position: 'absolute', top: '100%', right: 0, marginTop: 6,
    backgroundColor: colors.surface, borderRadius: 10,
    borderWidth: 1, borderColor: colors.border, ...shadow,
    minWidth: 210, zIndex: 200, overflow: 'hidden',
  },
  refineMenuItem: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 13,
  },
  refineMenuText:    { fontSize: 13, color: colors.textPrimary, fontWeight: '500' },
  refineMenuDivider: { height: 1, backgroundColor: colors.border },

  /* Channel toggle row */
  channelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    ...shadow,
  },
  channelLabel: {
    fontSize: 10, fontWeight: '700', color: colors.textMuted,
    letterSpacing: 0.8, textTransform: 'uppercase', marginRight: 4,
  },
  channelPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 11, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.backgroundColor,
  },
  channelPillActive: {
    borderColor: colors.primary + '50',
    backgroundColor: colors.primary + '0E',
  },
  channelPillText:       { fontSize: 12, color: colors.textSecondary, fontWeight: '500' },
  channelPillTextActive: { color: colors.primary, fontWeight: '700' },

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
  btnClearText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
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
  btnOutlineActive: { borderColor: colors.primary + '60', backgroundColor: colors.primary + '08' },
  btnOutlineText:   { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  btnDanger: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.danger, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8,
  },
  btnDangerText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  deleteBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#FCD34D',
    borderRadius: 8, padding: 12,
  },
  deleteBannerText: { flex: 1, fontSize: 13, color: '#92400E', lineHeight: 18 },

  /* Stat cards */
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard: {
    flex: 1, minWidth: 150, flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 14, padding: 14, ...shadow,
  },
  statIcon:  { width: 42, height: 42, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  statLabel: { fontSize: 11, color: colors.textSecondary, fontWeight: '600', marginBottom: 3 },
  statValue: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  statSub:   { fontSize: 11, color: colors.textMuted, marginTop: 2 },

  /* Uploaded sales cards */
  uploadedRow: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  uploadedCard: {
    flex: 1, minWidth: 200,
    flexDirection: 'row', alignItems: 'center', gap: 16,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 14, padding: 16, ...shadow,
  },
  uploadedIcon: { width: 50, height: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  uploadedLabel: { fontSize: 12, color: colors.textSecondary, fontWeight: '600', marginBottom: 4 },
  uploadedValue: { fontSize: 22, fontWeight: '800', color: colors.textPrimary },

  noticeBox:  { padding: 10, borderRadius: 8, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE' },
  noticeText: { fontSize: 12, color: '#1D4ED8', fontWeight: '600' },

  /* Cards */
  card: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 14, padding: 16, gap: 12, ...shadow,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle:  { fontSize: 14, fontWeight: '800', color: colors.textPrimary },

  /* Chart grid */
  gridRow: { flexDirection: 'row', gap: 14, flexWrap: 'wrap' },
  gridCol:  { flex: 1, minWidth: 260 },

  emptyBox:  { alignItems: 'center', paddingVertical: 24, gap: 8 },
  emptyText: { fontSize: 13, color: colors.textMuted },

  /* Donut charts */
  donutRow:        { flexDirection: 'row', alignItems: 'center', gap: 10 },
  donutCenter:     { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  donutTotal:      { fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  donutTotalLbl:   { fontSize: 10, color: colors.textMuted, fontWeight: '600' },
  donutLegend:     { flex: 1, gap: 6 },
  donutLegendRow:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  donutDot:        { width: 8, height: 8, borderRadius: 4 },
  donutLegendLabel:{ flex: 1, fontSize: 11, color: colors.textSecondary },
  donutLegendPct:  { fontSize: 11, color: colors.textMuted },

  /* Mini table */
  miniTableHead: { flexDirection: 'row', backgroundColor: colors.primary + '0C', paddingVertical: 6, paddingHorizontal: 4, borderRadius: 4 },
  miniTh:        { flex: 1, fontSize: 10, fontWeight: '800', color: colors.primary, letterSpacing: 0.3 },
  miniTableRow:  { flexDirection: 'row', paddingVertical: 6, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: colors.border },
  miniTd:        { flex: 1, fontSize: 11, color: colors.textPrimary },

  /* What's Next */
  nextRow:      { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  nextCard: {
    flex: 1, minWidth: 180,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, padding: 14, gap: 8, ...shadow,
  },
  nextCardMuted: { backgroundColor: colors.backgroundColor },
  nextCardTop:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nextIcon:      { width: 38, height: 38, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  nextBadge:     { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  nextBadgeText: { fontSize: 10, fontWeight: '700' },
  nextTitle:     { fontSize: 13, fontWeight: '800', color: colors.textPrimary },
  nextDesc:      { fontSize: 12, color: colors.textSecondary, lineHeight: 17 },
  nextBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start',
    backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 7,
  },
  nextBtnText:    { fontSize: 12, color: '#fff', fontWeight: '700' },
  matchResultOk:  { fontSize: 12, color: colors.success, fontWeight: '600' },
  matchResultErr: { fontSize: 12, color: colors.danger, fontWeight: '600' },

  /* Modals */
  modalOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', zIndex: 999,
  },
  modal: {
    backgroundColor: colors.surface, borderRadius: 14, padding: 20,
    gap: 14, minWidth: 300, maxWidth: 460, width: '90%', ...shadow,
    borderWidth: 1, borderColor: colors.border,
  },
  modalHeader:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  modalTitle:   { fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  modalDesc:    { fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
  modalFields:  { flexDirection: 'row', gap: 10, flexWrap: 'wrap', zIndex: 10 },
  modalStats:   { gap: 6 },
  modalStat:    { fontSize: 14, color: colors.textPrimary, fontWeight: '600' },
  modalNone:    { fontSize: 13, color: colors.success, fontWeight: '600' },
  modalError:   { fontSize: 13, color: colors.danger },
  modalActions: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' },

  /* Misc */
  centered:  { padding: 60, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText: { fontSize: 14, color: colors.danger, textAlign: 'center' },

  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 64, paddingHorizontal: 32, gap: 14 },
  emptyStateIcon: {
    width: 72, height: 72, borderRadius: 18,
    backgroundColor: colors.backgroundColor, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  emptyStateTitle:   { fontSize: 16, fontWeight: '800', color: colors.textPrimary, textAlign: 'center' },
  emptyStateMsg:     { fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 20, maxWidth: 420 },
  emptyStateActions: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginTop: 4 },

  viewBreakdownBtn:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  viewBreakdownText: { fontSize: 12, color: colors.primary, fontWeight: '600' },
});
