import React, { useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  PieChart, Pie, Cell,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

import AppShell from '../../components/AppShell';
import { colors } from '../../constants/colors';
import { globalHeight, globalWidth } from '../../constants/globalWidth';
import { getTargetOverview, listTargetAssignments } from '../../store/targets/targetAssignmentActions';
import { listTargetPhasing } from '../../store/targets/targetPhasingActions';
import { getLines } from '../../store/lines/linesActions';
import { listProducts } from '../../store/products/productActions';
import { listSalesChannels } from '../../store/salesChannels/salesChannelActions';

const isManager = (role) =>
  ['admin', 'manager', 'senior_manager'].includes(String(role).toLowerCase());

const MONTHS_SHORT       = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const THIS_YEAR          = new Date().getFullYear();
const YEAR_OPTIONS       = [THIS_YEAR - 1, THIS_YEAR, THIS_YEAR + 1];
const CHANNEL_LINE_COLORS = ['#1D4ED8', '#7C3AED', '#16A34A', '#F59E0B', '#06B6D4', '#EF4444'];
const REP_COLORS          = ['#1D4ED8', '#16A34A', '#7C3AED', '#F59E0B', '#06B6D4', '#EF4444', '#EC4899', '#8B5CF6'];

const DATE_RANGE_PRESETS = {
  full: { startMD: '01-01', endMD: '12-31' },
  h1:   { startMD: '01-01', endMD: '06-30' },
  h2:   { startMD: '07-01', endMD: '12-31' },
  q1:   { startMD: '01-01', endMD: '03-31' },
  q2:   { startMD: '04-01', endMD: '06-30' },
  q3:   { startMD: '07-01', endMD: '09-30' },
  q4:   { startMD: '10-01', endMD: '12-31' },
};

const fmtNum = (n) => {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
};
const fmtCurrency = (v, cur = 'USD') => {
  if (v == null) return '—';
  const sym = cur === 'AED' ? 'AED ' : '$';
  return `${sym}${Number(v).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
};
const fmtDate = (d) => d ? d.slice(0, 10) : '—';

const STATUS_COLORS = {
  active:   { bg: '#DCFCE7', text: '#15803D' },
  upcoming: { bg: '#EFF6FF', text: '#1D4ED8' },
  expired:  { bg: '#FEF2F2', text: '#DC2626' },
  inactive: { bg: '#F1F5F9', text: '#64748B' },
};

const RECENT_COLS = [
  { key: 'rep',       label: 'Medical Rep',   width: 120 },
  { key: 'product',   label: 'Product',        width: 100 },
  { key: 'nickname',  label: 'Nickname',       width: 80  },
  { key: 'channel',   label: 'Sales Channel',  width: 110 },
  { key: 'line',      label: 'Line',           width: 100 },
  { key: 'startDate', label: 'Start Date',     width: 90  },
  { key: 'endDate',   label: 'End Date',       width: 90  },
  { key: 'units',     label: 'Target Units',   width: 90  },
  { key: 'value',     label: 'Target Value',   width: 95  },
  { key: 'currency',  label: 'Currency',       width: 72  },
  { key: 'status',    label: 'Status',         width: 85  },
  { key: 'actions',   label: 'Actions',        width: 90  },
];

const shadow = { shadowColor: '#0B2B66', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } };
const PAD    = globalWidth('1.2%');

/* ─── Sub-components ─────────────────────────────── */

function StatusBadge({ status }) {
  const s = STATUS_COLORS[String(status).toLowerCase()] || STATUS_COLORS.inactive;
  return (
    <View style={[styles.badge, { backgroundColor: s.bg }]}>
      <Text style={[styles.badgeText, { color: s.text }]}>
        {String(status).charAt(0).toUpperCase() + String(status).slice(1)}
      </Text>
    </View>
  );
}

function StatCard({ icon, iconColor, iconBg, label, value }) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <View style={styles.statBody}>
        <Text style={styles.statLabel}>{label}</Text>
        <Text style={styles.statValue}>{value ?? '—'}</Text>
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

function BarRow({ label, value, total, color }) {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return (
    <View style={styles.barRow}>
      <Text style={styles.barLabel} numberOfLines={1}>{label}</Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.barValue}>{fmtCurrency(value)}</Text>
    </View>
  );
}

function FilterItem({ icon, label, options, value, onChange, style, zIndex = 1 }) {
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.value === value);
  return (
    <View style={[{ position: 'relative', zIndex: open ? 60 : zIndex }, style]}>
      <Pressable style={styles.filterItem} onPress={() => setOpen(v => !v)}>
        {icon ? <Ionicons name={icon} size={13} color={colors.textSecondary} /> : null}
        <View style={{ flex: 1, minWidth: 50 }}>
          {label ? <Text style={styles.filterItemLabel}>{label}</Text> : null}
          <Text style={styles.filterItemValue} numberOfLines={1}>{selected?.label || 'All'}</Text>
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={11} color={colors.textMuted} />
      </Pressable>
      {open && (
        <View style={styles.filterDropdown}>
          <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
            {options.map(opt => (
              <Pressable
                key={opt.value}
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

/* ─── Main Screen ─────────────────────────────────── */

export default function TargetDashboardScreen({ navigation, userDetails, appMetadata, onSignOut }) {
  const user    = userDetails?.user || userDetails?.data?.user || userDetails || {};
  const token   = userDetails?.token || userDetails?.data?.token || '';
  const role    = user.role || '';
  const manager = isManager(role);

  useEffect(() => {
    if (!manager) navigation.replace('MyTargetDashboard');
  }, [manager]);

  const [overview, setOverview] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [year, setYear]         = useState(String(THIS_YEAR));

  /* Staged filter state (applied only on button click) */
  const [pendingRep,      setPendingRep]      = useState('');
  const [pendingProduct,  setPendingProduct]  = useState('');
  const [pendingChannel,  setPendingChannel]  = useState('');
  const [pendingStatus,   setPendingStatus]   = useState('');
  const [pendingCurrency,  setPendingCurrency]  = useState('USD');
  const [pendingDateRange, setPendingDateRange] = useState('full');
  const [appliedFilters,   setAppliedFilters]   = useState({});

  /* Filter option lists */
  const [repOptions, setRepOptions] = useState([]); // populated from overview's targetByRep
  const [lines,      setLines]      = useState([]);
  const [products,   setProducts]   = useState([]);
  const [channels,   setChannels]   = useState([]);

  /* Recent assignments */
  const [recentList,       setRecentList]       = useState([]);
  const [recentLoading,    setRecentLoading]    = useState(true);
  const [recentPagination, setRecentPagination] = useState({ page: 1, pages: 1, total: 0 });

  /* Default target phasing — monthly % distribution */
  const [defaultPhasing, setDefaultPhasing] = useState(null);


  /* Trend chart currency selector */
  const [trendCurrency, setTrendCurrency] = useState('USD');

  /* Load static filter option lists */
  useEffect(() => {
    getLines(token)
      .then(d => setLines(Array.isArray(d) ? d : []))
      .catch(() => {});
    listProducts(token, { limit: 200, status: 'active' })
      .then(({ products: p }) => setProducts(Array.isArray(p) ? p : []))
      .catch(() => {});
    listSalesChannels(token, { status: 'active' })
      .then(({ channels: c }) => setChannels(Array.isArray(c) ? c : []))
      .catch(() => {});
  }, [token]);

  /* Overview fetch */
  const fetchOverview = useCallback(async () => {
    if (!manager) return;
    setLoading(true);
    setError('');
    try {
      const params = { year };
      if (appliedFilters.rep)      params.userId    = appliedFilters.rep;
      if (appliedFilters.product)  params.productId = appliedFilters.product;
      if (appliedFilters.channel)  params.channelId = appliedFilters.channel;
      if (appliedFilters.status)   params.status    = appliedFilters.status;
      if (appliedFilters.currency) params.currency  = appliedFilters.currency;
      if (appliedFilters.dateRange && appliedFilters.dateRange !== 'full') {
        const p = DATE_RANGE_PRESETS[appliedFilters.dateRange];
        if (p) { params.startDate = `${year}-${p.startMD}`; params.endDate = `${year}-${p.endMD}`; }
      }
      const data = await getTargetOverview(token, params);
      setOverview(data);
      // Capture full rep list only when no rep filter is active
      if (!appliedFilters.rep && Array.isArray(data.targetByRep) && data.targetByRep.length > 0) {
        setRepOptions(data.targetByRep);
      }
    } catch (e) {
      setError(e.message || 'Failed to load overview');
    } finally {
      setLoading(false);
    }
  }, [token, year, manager, appliedFilters]);

  useEffect(() => { fetchOverview(); }, [fetchOverview]);

  /* Recent assignments fetch */
  const fetchRecent = useCallback(async (pg = 1) => {
    setRecentLoading(true);
    try {
      const params = { page: pg, limit: 6, year };
      if (appliedFilters.rep)     params.userId    = appliedFilters.rep;
      if (appliedFilters.product) params.productId = appliedFilters.product;
      if (appliedFilters.channel) params.channelId = appliedFilters.channel;
      if (appliedFilters.status)  params.status    = appliedFilters.status;
      if (appliedFilters.dateRange && appliedFilters.dateRange !== 'full') {
        const p = DATE_RANGE_PRESETS[appliedFilters.dateRange];
        if (p) { params.startDate = `${year}-${p.startMD}`; params.endDate = `${year}-${p.endMD}`; }
      }
      const res = await listTargetAssignments(token, params);
      setRecentList(res.assignments);
      setRecentPagination(res.pagination);
    } catch { /* silent */ }
    finally { setRecentLoading(false); }
  }, [token, year, appliedFilters]);

  useEffect(() => { fetchRecent(1); }, [fetchRecent]);

  /* Fetch the default target-phasing configuration (monthly % distribution) */
  useEffect(() => {
    listTargetPhasing(token, {})
      .then(({ phasings }) => {
        if (!phasings.length) return;
        const def = phasings.find(p => p.isDefault) || phasings[0];
        setDefaultPhasing(def);
      })
      .catch(() => {});
  }, [token]);

  if (!manager) return null;

  /* ── Derived values ── */
  const totalUnits = overview?.totalTargetUnits ?? 0;
  const totalValue = overview?.totalTargetValue ?? 0;
  const active     = overview?.activeAssignmentsCount   ?? 0;
  const inactive   = overview?.inactiveAssignmentsCount ?? 0;
  const upcoming   = overview?.upcomingAssignmentsCount ?? 0;
  const expired    = overview?.expiredAssignmentsCount  ?? 0;

  const byRep     = Array.isArray(overview?.targetByRep)     ? overview.targetByRep     : [];
  const byProduct = Array.isArray(overview?.targetByProduct) ? overview.targetByProduct : [];
  const byChannel = Array.isArray(overview?.targetByChannel) ? overview.targetByChannel : [];

  const maxRepVal  = byRep.reduce((m, r) => Math.max(m, r.totalTargetValue || 0), 0);
  const maxProdVal = byProduct.reduce((m, r) => Math.max(m, r.totalTargetValue || 0), 0);
  const maxChanVal = byChannel.reduce((m, r) => Math.max(m, r.totalTargetValue || 0), 0);

  /* Assignment Status (bars) */
  const statusTotal = active + upcoming + expired + inactive;
  const statusItems = [
    { name: 'Active',   count: active,   color: '#16A34A' },
    { name: 'Upcoming', count: upcoming, color: '#7C3AED' },
    { name: 'Expired',  count: expired,  color: '#DC2626' },
    { name: 'Inactive', count: inactive, color: '#94A3B8' },
  ];

  /* Rep donut */
  const repTotal     = byRep.reduce((s, r) => s + (r.totalTargetValue || 0), 0);
  const repDonutData = byRep.slice(0, 8).map((r, i) => ({
    name:  r.name || '—',
    value: r.totalTargetValue || 0,
    color: REP_COLORS[i % REP_COLORS.length],
  }));

  /* Channel donut */
  const channelDonutData = byChannel.map((c, i) => ({
    name:  c.name || `Channel ${i + 1}`,
    value: c.totalTargetValue || 0,
    color: CHANNEL_LINE_COLORS[i % CHANNEL_LINE_COLORS.length],
  }));
  const channelDonutTotal = byChannel.reduce((s, c) => s + (c.totalTargetValue || 0), 0);

  /* Monthly trend — channel total × phasing monthly percentage.
   * Extracts the 12 monthly percentages from the default phasing object,
   * then: month_value = channel.totalTargetValue × (pct / 100)
   */
  const phasingPcts = (() => {
    if (!defaultPhasing) return null;
    // Shape 1: months array  →  [{ month:1, percentage:8 }, ...]
    if (Array.isArray(defaultPhasing.months) && defaultPhasing.months.length) {
      const arr = new Array(12).fill(0);
      defaultPhasing.months.forEach(m => {
        const idx = ((m.month || m.monthNumber || 1) - 1);
        if (idx >= 0 && idx < 12)
          arr[idx] = m.percentage ?? m.pct ?? m.percent ?? m.value ?? 0;
      });
      return arr;
    }
    // Shape 2: flat 12-element array of percentages
    for (const key of ['monthlyDistribution', 'distribution', 'percentages', 'monthlyValues', 'values']) {
      if (Array.isArray(defaultPhasing[key]) && defaultPhasing[key].length === 12)
        return defaultPhasing[key];
    }
    return null;
  })();

  const channelTrendData = MONTHS_SHORT.map((month, i) => {
    const entry = { month };
    const pct   = phasingPcts ? (phasingPcts[i] ?? 0) : 0;
    byChannel.forEach(ch => {
      entry[ch.name || ''] = pct > 0
        ? Math.round((ch.totalTargetValue || 0) * pct / 100)
        : 0;
    });
    return entry;
  });

  /* Line name lookup — built from the /lines list already fetched */
  const lineMap = {};
  lines.forEach(l => {
    const id = l.lineId || l._id || l.id;
    if (id) lineMap[String(id)] = l.lineName || l.name || id;
  });
  const getLineName = (lineId) => {
    if (!lineId) return '—';
    if (typeof lineId === 'object') return lineId.lineName || lineId.name || lineMap[String(lineId._id || lineId.lineId || '')] || '—';
    return lineMap[String(lineId)] || String(lineId);
  };

  /* Filter option arrays */
  const yearOpts       = YEAR_OPTIONS.map(y => ({ value: String(y), label: String(y) }));
  const repOpts        = [{ value: '', label: 'All' }, ...repOptions.map(r => ({ value: r.id || r.userId || r._id, label: r.name || r.fullName || '—' }))];
  const productOpts    = [{ value: '', label: 'All' }, ...products.map(p => ({ value: p._id || p.productId, label: p.productName || p.name || '—' }))];
  const channelOpts    = [{ value: '', label: 'All' }, ...channels.map(c => ({ value: c._id || c.channelId, label: c.channelName || c.channelKey || '—' }))];
  const lineOpts       = [{ value: '', label: 'All' }, ...lines.map(l => ({ value: l._id || l.lineId, label: l.lineName || l.name || '—' }))];
  const statusOpts     = [{ value: '', label: 'All' }, { value: 'active', label: 'Active' }, { value: 'upcoming', label: 'Upcoming' }, { value: 'expired', label: 'Expired' }, { value: 'inactive', label: 'Inactive' }];
  const currencyOpts   = [{ value: 'USD', label: 'USD' }, { value: 'AED', label: 'AED' }];
  const dateRangeOpts  = [
    { value: 'full', label: `Full Year (${year})` },
    { value: 'h1',   label: `H1: Jan – Jun ${year}` },
    { value: 'h2',   label: `H2: Jul – Dec ${year}` },
    { value: 'q1',   label: `Q1: Jan – Mar ${year}` },
    { value: 'q2',   label: `Q2: Apr – Jun ${year}` },
    { value: 'q3',   label: `Q3: Jul – Sep ${year}` },
    { value: 'q4',   label: `Q4: Oct – Dec ${year}` },
  ];

  const hasActiveFilters = !!(pendingRep || pendingProduct || pendingChannel || pendingStatus || pendingDateRange !== 'full');

  const handleApply = () => setAppliedFilters({ rep: pendingRep, product: pendingProduct, channel: pendingChannel, status: pendingStatus, currency: pendingCurrency, dateRange: pendingDateRange });
  const handleClear = () => {
    setPendingRep(''); setPendingProduct(''); setPendingChannel(''); setPendingStatus(''); setPendingCurrency('USD'); setPendingDateRange('full');
    setAppliedFilters({});
  };

  return (
    <AppShell navigation={navigation} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} activeRoute="TargetDashboard">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* ── Header ── */}
        <View style={styles.pageHeader}>
          <View>
            <Text style={styles.pageTitle}>Target Dashboard</Text>
            <Text style={styles.pageSubtitle}>Overview of all sales rep targets and assignments</Text>
          </View>
          <View style={styles.headerRight}>
            <FilterItem
              icon="calendar-outline"
              options={yearOpts}
              value={year}
              onChange={setYear}
              style={{ minWidth: 90, zIndex: 20 }}
              zIndex={20}
            />
            <Pressable style={styles.btnPrimary} onPress={() => navigation.navigate('TargetAssignments')}>
              <Ionicons name="flag-outline" size={14} color="#fff" />
              <Text style={styles.btnPrimaryText}>Assignments</Text>
            </Pressable>
          </View>
        </View>

        {/* ── Stat Cards ── */}
        <View style={styles.statsRow}>
          <StatCard icon="trending-up-outline"  iconColor="#1D4ED8" iconBg="#EFF6FF" label="Total Target Units"    value={fmtNum(totalUnits)} />
          <StatCard icon="cash-outline"          iconColor="#15803D" iconBg="#F0FDF4" label="Total Target Value"   value={fmtCurrency(totalValue)} />
          <StatCard icon="person-outline"        iconColor="#15803D" iconBg="#DCFCE7" label="Active Assignments"   value={active} />
          <StatCard icon="analytics-outline" iconColor="#F59E0B" iconBg="#FFFBEB" label="YTD Achievement"       value="54.7%" />
          <StatCard icon="bar-chart-outline"  iconColor="#7C3AED" iconBg="#F5F3FF" label="Full Year Achievement" value="78.2%" />
        </View>

        {/* ── Filters Bar ── */}
        <View style={styles.filtersBar}>
          <View style={styles.filtersLeft}>
            <FilterItem icon="person-outline"     label="Medical Rep"   options={repOpts}        value={pendingRep}        onChange={setPendingRep}        zIndex={26} />
            <FilterItem icon="cube-outline"       label="Product"       options={productOpts}    value={pendingProduct}    onChange={setPendingProduct}    zIndex={25} />
            <FilterItem icon="storefront-outline" label="Sales Channel" options={channelOpts}    value={pendingChannel}    onChange={setPendingChannel}    zIndex={24} />
            <FilterItem icon="layers-outline"     label="Line"          options={lineOpts}       value={pendingStatus}     onChange={setPendingStatus}     zIndex={23} />
            <FilterItem icon="ellipse-outline"    label="Status"        options={statusOpts}     value={pendingStatus}     onChange={setPendingStatus}     zIndex={22} />
            <FilterItem icon="calendar-outline"   label="Date Range"    options={dateRangeOpts}  value={pendingDateRange}  onChange={setPendingDateRange}  zIndex={21} />
            <FilterItem icon="cash-outline"       label="Currency"      options={currencyOpts}   value={pendingCurrency}   onChange={setPendingCurrency}   zIndex={20} />
            <Pressable style={styles.btnApply} onPress={handleApply}>
              <Ionicons name="options-outline" size={13} color="#fff" />
              <Text style={styles.btnApplyText}>Apply Filters</Text>
            </Pressable>
            {hasActiveFilters && (
              <Pressable style={styles.btnClear} onPress={handleClear}>
                <Ionicons name="refresh-outline" size={13} color={colors.textSecondary} />
                <Text style={styles.btnClearText}>Clear</Text>
              </Pressable>
            )}
          </View>
          <View style={styles.filtersRight}>
            <Pressable style={styles.btnOutline}>
              <Ionicons name="download-outline" size={13} color={colors.textSecondary} />
              <Text style={styles.btnOutlineText}>Export</Text>
            </Pressable>
            <Pressable style={[styles.btnOutline, styles.btnOutlineAccent]}>
              <Ionicons name="filter-outline" size={13} color={colors.primary} />
              <Text style={[styles.btnOutlineText, { color: colors.primary }]}>More Filters</Text>
              <Ionicons name="chevron-down" size={11} color={colors.primary} />
            </Pressable>
          </View>
        </View>

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
        ) : (
          <>
            {/* ── Main 3-column grid — equal height, scroll inside each card ── */}
            <View style={styles.mainGrid}>

              {/* Left: Target by Rep + Rep distribution donut */}
              <View style={styles.gridLeft}>
                <Card style={{ flex: 1 }}>
                  <CardHeader
                    title="Target by Rep"
                    right={<Pressable onPress={() => navigation.navigate('TargetAssignments')}><Text style={styles.linkText}>View All</Text></Pressable>}
                  />
                  <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} nestedScrollEnabled>
                    {byRep.length === 0 ? <Text style={styles.emptyText}>No rep data available</Text> : (
                      byRep.map((r, i) => (
                        <BarRow key={r.id || i} label={r.name || '—'} value={r.totalTargetValue || 0} total={maxRepVal} color={colors.primary} />
                      ))
                    )}
                  </ScrollView>

                  {/* Rep distribution donut */}
                  {repDonutData.length > 0 && (
                    <>
                      <View style={styles.sectionDivider} />
                      <View style={styles.donutRow}>
                        <View style={{ position: 'relative' }}>
                          <PieChart width={130} height={130}>
                            <Pie
                              data={repDonutData}
                              cx={60} cy={60}
                              innerRadius={38} outerRadius={58}
                              paddingAngle={repDonutData.length > 1 ? 2 : 0}
                              dataKey="value"
                              startAngle={90} endAngle={-270}
                            >
                              {repDonutData.map((e, idx) => <Cell key={idx} fill={e.color} />)}
                            </Pie>
                          </PieChart>
                          <View style={styles.donutCenter}>
                            <Text style={[styles.donutTotal, { fontSize: 12 }]}>{fmtNum(repTotal)}</Text>
                            <Text style={styles.donutTotalLabel}>Total</Text>
                          </View>
                        </View>
                        <View style={styles.donutLegend}>
                          {repDonutData.map(item => (
                            <View key={item.name} style={styles.donutLegendRow}>
                              <View style={[styles.donutDot, { backgroundColor: item.color }]} />
                              <Text style={[styles.donutLegendLabel, { fontSize: 11 }]} numberOfLines={1}>
                                {item.name.split(' ')[0]}
                              </Text>
                              {repTotal > 0 && (
                                <Text style={styles.donutLegendPct}>{((item.value / repTotal) * 100).toFixed(1)}%</Text>
                              )}
                            </View>
                          ))}
                        </View>
                      </View>
                    </>
                  )}
                </Card>
              </View>

              {/* Middle: Target by Product */}
              <View style={styles.gridMiddle}>
                <Card style={{ flex: 1 }}>
                  <CardHeader
                    title="Target by Product"
                    right={<Pressable onPress={() => navigation.navigate('TargetAssignments')}><Text style={styles.linkText}>View All</Text></Pressable>}
                  />
                  <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} nestedScrollEnabled>
                    {byProduct.length === 0 ? <Text style={styles.emptyText}>No product data available</Text> : (
                      <>
                        {byProduct.map((p, i) => (
                          <BarRow key={p.id || i} label={p.name || '—'} value={p.totalTargetValue || 0} total={maxProdVal} color="#16A34A" />
                        ))}
                      </>
                    )}
                  </ScrollView>
                </Card>
              </View>

              {/* Right: Channel (Donut) + Assignment Status (Bars) */}
              <View style={[styles.gridRight, { gap: 14 }]}>

                {/* Channel → Donut */}
                <Card style={{ flex: 1 }}>
                  <CardHeader title="Target by Channel" />
                  {byChannel.length === 0 ? <Text style={styles.emptyText}>No channel data</Text> : (
                    <View style={styles.donutRow}>
                      <View style={{ position: 'relative' }}>
                        <PieChart width={150} height={150}>
                          <Pie
                            data={channelDonutData}
                            cx={70} cy={70}
                            innerRadius={46} outerRadius={68}
                            paddingAngle={channelDonutData.length > 1 ? 2 : 0}
                            dataKey="value"
                            startAngle={90} endAngle={-270}
                          >
                            {channelDonutData.map((entry, idx) => <Cell key={idx} fill={entry.color} />)}
                          </Pie>
                        </PieChart>
                        <View style={styles.donutCenter}>
                          <Text style={[styles.donutTotal, { fontSize: 13 }]}>{fmtNum(channelDonutTotal)}</Text>
                          <Text style={styles.donutTotalLabel}>Total</Text>
                        </View>
                      </View>
                      <View style={styles.donutLegend}>
                        {channelDonutData.map(item => (
                          <View key={item.name} style={styles.donutLegendRow}>
                            <View style={[styles.donutDot, { backgroundColor: item.color }]} />
                            <Text style={styles.donutLegendLabel}>{item.name}</Text>
                            <Text style={styles.donutLegendValue}>{fmtCurrency(item.value)}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  )}
                </Card>

                {/* Assignment Status → Bars */}
                <Card style={{ flex: 1 }}>
                  <CardHeader title="Assignment Status" />
                  {statusItems.map(item => (
                    <View key={item.name} style={styles.statusBarRow}>
                      <View style={styles.statusBarLabelWrap}>
                        <View style={[styles.donutDot, { backgroundColor: item.color }]} />
                        <Text style={styles.statusBarName}>{item.name}</Text>
                      </View>
                      <View style={styles.barTrack}>
                        <View style={[styles.barFill, {
                          width: statusTotal > 0 ? `${(item.count / statusTotal) * 100}%` : '0%',
                          backgroundColor: item.color,
                        }]} />
                      </View>
                      <Text style={styles.statusBarCount}>{item.count}</Text>
                      {statusTotal > 0 && (
                        <Text style={styles.statusBarPct}>({((item.count / statusTotal) * 100).toFixed(1)}%)</Text>
                      )}
                    </View>
                  ))}
                </Card>

              </View>

            </View>

            {/* ── Bottom 2-column grid ── */}
            <View style={styles.bottomGrid}>

              {/* Left: Recent Target Assignments */}
              <Card style={styles.bottomLeft}>
                <CardHeader
                  title="Recent Target Assignments"
                  right={
                    <Pressable style={styles.btnOutlineSm} onPress={() => navigation.navigate('TargetAssignments')}>
                      <Text style={styles.btnOutlineSmText}>View All</Text>
                    </Pressable>
                  }
                />
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View>
                    {/* Table head */}
                    <View style={styles.tblHead}>
                      {RECENT_COLS.map(col => (
                        <Text key={col.key} style={[styles.tblTh, { width: col.width }]}>{col.label}</Text>
                      ))}
                    </View>
                    {/* Table body */}
                    {recentLoading ? (
                      <View style={styles.tblEmpty}><ActivityIndicator size="small" color={colors.primary} /></View>
                    ) : recentList.length === 0 ? (
                      <View style={styles.tblEmpty}><Text style={styles.emptyText}>No assignments found</Text></View>
                    ) : recentList.map((a) => {
                      const id      = a._id || a.id;
                      const product = a.productId || {};
                      const channel = a.channelId || {};
                      const rep     = a.userId || a.repId || {};
                      return (
                        <View key={id} style={styles.tblRow}>
                          <Text style={[styles.tblTd, { width: 120 }]} numberOfLines={1}>{rep.fullName || rep.name || '—'}</Text>
                          <Text style={[styles.tblTd, { width: 100 }]} numberOfLines={1}>{product.productName || product.name || '—'}</Text>
                          <Text style={[styles.tblTd, { width: 80  }]} numberOfLines={1}>{product.productNickname || a.productNickname || '—'}</Text>
                          <Text style={[styles.tblTd, { width: 110 }]} numberOfLines={1}>{channel.channelName || channel.channelKey || '—'}</Text>
                          <Text style={[styles.tblTd, { width: 100 }]} numberOfLines={1}>
                            {getLineName(a.lineId || a.userId?.lineId || a.salesLine)}
                          </Text>
                          <Text style={[styles.tblTd, { width: 90  }]}>{fmtDate(a.startDate)}</Text>
                          <Text style={[styles.tblTd, { width: 90  }]}>{fmtDate(a.endDate)}</Text>
                          <Text style={[styles.tblTd, { width: 90  }]}>{a.totalTargetUnits != null ? Number(a.totalTargetUnits).toLocaleString() : '—'}</Text>
                          <Text style={[styles.tblTd, { width: 95  }]}>{fmtCurrency(a.totalTargetValue, a.currency)}</Text>
                          <Text style={[styles.tblTd, { width: 72  }]}>{a.currency || 'USD'}</Text>
                          <View style={[styles.tblTd, { width: 85  }]}><StatusBadge status={a.status || 'active'} /></View>
                          <View style={[styles.tblTd, styles.tblActions, { width: 90 }]}>
                            <Pressable style={styles.actionBtn} onPress={() => navigation.navigate('TargetAssignmentDetails', { assignmentId: id })}>
                              <Ionicons name="eye-outline" size={14} color={colors.textSecondary} />
                            </Pressable>
                            <Pressable style={styles.actionBtn} onPress={() => navigation.navigate('TargetAssignmentForm', { mode: 'edit', assignmentId: id })}>
                              <Ionicons name="create-outline" size={14} color={colors.primary} />
                            </Pressable>
                            <Pressable style={styles.actionBtn} onPress={() => navigation.navigate('TargetAssignmentForm', { mode: 'duplicate', assignmentId: id })}>
                              <Ionicons name="copy-outline" size={14} color="#7C3AED" />
                            </Pressable>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </ScrollView>
                {/* Footer: row count + pagination */}
                <View style={styles.tblFooter}>
                  <Text style={styles.tblFooterText}>
                    {recentList.length > 0
                      ? `Showing 1 to ${recentList.length} of ${recentPagination.total} results`
                      : 'No results'}
                  </Text>
                  <View style={styles.tblPagination}>
                    <Pressable
                      style={[styles.pageBtn, recentPagination.page <= 1 && styles.pageBtnDisabled]}
                      onPress={() => recentPagination.page > 1 && fetchRecent(recentPagination.page - 1)}
                      disabled={recentPagination.page <= 1}
                    >
                      <Ionicons name="chevron-back" size={13} color={recentPagination.page <= 1 ? colors.textMuted : colors.textPrimary} />
                    </Pressable>
                    <View style={styles.pageCurrent}>
                      <Text style={styles.pageCurrentText}>{recentPagination.page}</Text>
                    </View>
                    <Pressable
                      style={[styles.pageBtn, recentPagination.page >= recentPagination.pages && styles.pageBtnDisabled]}
                      onPress={() => recentPagination.page < recentPagination.pages && fetchRecent(recentPagination.page + 1)}
                      disabled={recentPagination.page >= recentPagination.pages}
                    >
                      <Ionicons name="chevron-forward" size={13} color={recentPagination.page >= recentPagination.pages ? colors.textMuted : colors.textPrimary} />
                    </Pressable>
                  </View>
                </View>
              </Card>

              {/* Right: Monthly Target Trend */}
              <Card style={styles.bottomRight}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>Monthly Target Trend (Value)</Text>
                  <FilterItem
                    icon={null}
                    options={currencyOpts}
                    value={trendCurrency}
                    onChange={setTrendCurrency}
                    style={{ minWidth: 75, zIndex: 10 }}
                    zIndex={10}
                  />
                </View>

                <View style={{ height: 220 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={channelTrendData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                      <XAxis
                        dataKey="month"
                        tick={{ fontSize: 10, fill: '#94A3B8' }}
                        axisLine={false} tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 10, fill: '#94A3B8' }}
                        axisLine={false} tickLine={false}
                        width={48}
                        tickFormatter={v => v >= 1000 ? `$${(v / 1000).toFixed(0)}K` : `$${v}`}
                      />
                      <Tooltip
                        formatter={(v, name) => [fmtCurrency(v), name]}
                        contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: '#E2E8F0' }}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      {byChannel.map((ch, idx) => {
                        const color = CHANNEL_LINE_COLORS[idx % CHANNEL_LINE_COLORS.length];
                        return (
                          <Line
                            key={ch.id || ch._id || idx}
                            type="monotone"
                            dataKey={ch.name || `Channel ${idx + 1}`}
                            stroke={color}
                            strokeWidth={2}
                            dot={{ r: 3, fill: color }}
                            activeDot={{ r: 5 }}
                          />
                        );
                      })}
                    </LineChart>
                  </ResponsiveContainer>
                </View>

                {/* Summary: one pill per channel */}
                <View style={styles.trendSummary}>
                  {byChannel.slice(0, 3).map((ch, idx) => (
                    <View key={ch.id || idx} style={idx > 0 ? { alignItems: 'flex-end' } : {}}>
                      <Text style={[styles.trendLabel, { color: CHANNEL_LINE_COLORS[idx % CHANNEL_LINE_COLORS.length] }]}>
                        {ch.name || '—'}
                      </Text>
                      <Text style={[styles.trendValue, { color: CHANNEL_LINE_COLORS[idx % CHANNEL_LINE_COLORS.length] }]}>
                        {fmtCurrency(ch.totalTargetValue)}
                      </Text>
                    </View>
                  ))}
                </View>
              </Card>

            </View>
          </>
        )}
      </ScrollView>
    </AppShell>
  );
}

/* ─── Styles ──────────────────────────────────────── */

const styles = StyleSheet.create({
  scroll: { padding: PAD, gap: 16, paddingBottom: 48 },

  /* Header */
  pageHeader: {
    flexDirection: 'row', alignItems: 'flex-start',
    justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
  },
  pageTitle:    { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  pageSubtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  headerRight:  { flexDirection: 'row', alignItems: 'center', gap: 10 },

  /* Stat cards */
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard: {
    flex: 1, minWidth: 150, flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, padding: 16, ...shadow,
  },
  statIcon:  { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  statBody:  { flex: 1 },
  statLabel: { fontSize: 11, color: colors.textSecondary, fontWeight: '600', marginBottom: 3 },
  statValue: { fontSize: 22, fontWeight: '800', color: colors.textPrimary },

  /* Filters bar */
  filtersBar: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, padding: 12, ...shadow, zIndex: 20,
  },
  filtersLeft:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center', flex: 1 },
  filtersRight: { flexDirection: 'row', gap: 8, alignItems: 'center' },

  filterItem: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: colors.backgroundColor,
  },
  filterItemLabel: { fontSize: 9, color: colors.textMuted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  filterItemValue: { fontSize: 12, color: colors.textPrimary, fontWeight: '600' },
  filterDropdown: {
    position: 'absolute', top: 42, left: 0, minWidth: 150,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 8, ...shadow, zIndex: 100,
  },
  filterOpt:           { paddingHorizontal: 12, paddingVertical: 9 },
  filterOptActive:     { backgroundColor: colors.primary + '15' },
  filterOptText:       { fontSize: 13, color: colors.textPrimary },
  filterOptTextActive: { color: colors.primary, fontWeight: '700' },

  btnApply: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
  },
  btnApplyText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  btnClear: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderColor: colors.border, paddingHorizontal: 10, paddingVertical: 8,
    borderRadius: 8, backgroundColor: colors.backgroundColor,
  },
  btnClearText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  btnOutline: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
    backgroundColor: colors.surface,
  },
  btnOutlineAccent: { borderColor: colors.primary, backgroundColor: colors.primary + '0E' },
  btnOutlineText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  btnOutlineSm: {
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6,
  },
  btnOutlineSmText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  btnPrimary: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8,
  },
  btnPrimaryText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  /* Shared card */
  card: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, padding: 16, gap: 10, ...shadow,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle:  { fontSize: 14, fontWeight: '800', color: colors.textPrimary },
  linkText:   { fontSize: 12, color: colors.primary, fontWeight: '700' },
  emptyText:  { fontSize: 13, color: colors.textMuted, textAlign: 'center', paddingVertical: 12 },

  /* Bar rows */
  barRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 3 },
  barLabel: { width: 95, fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  barTrack: { flex: 1, height: 6, backgroundColor: colors.border + '90', borderRadius: 3, overflow: 'hidden' },
  barFill:  { height: 6, borderRadius: 3 },
  barValue: { width: 70, fontSize: 12, color: colors.textPrimary, fontWeight: '700', textAlign: 'right' },

  /* 3-column grid — all columns fixed same height, content scrolls inside */
  mainGrid:   { flexDirection: 'row', gap: 14 },
  gridLeft:   { flex: 1.4, height: 460 },
  gridMiddle: { flex: 2,   height: 460 },
  gridRight:  { flex: 1.4, height: 460 },

  sectionDivider: { height: 1, backgroundColor: colors.border, marginVertical: 8 },

  /* Donut chart */
  donutRow:        { flexDirection: 'row', alignItems: 'center', gap: 10 },
  donutCenter:     { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  donutTotal:      { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
  donutTotalLabel: { fontSize: 10, color: colors.textMuted, fontWeight: '600' },
  donutLegend:     { flex: 1, gap: 7 },
  donutLegendRow:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  donutDot:        { width: 8, height: 8, borderRadius: 4 },
  donutLegendLabel:{ flex: 1, fontSize: 12, color: colors.textSecondary },
  donutLegendValue:{ fontSize: 12, fontWeight: '700', color: colors.textPrimary },
  donutLegendPct:  { fontSize: 11, color: colors.textMuted },

  /* Assignment Status bars */
  statusBarRow:       { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5 },
  statusBarLabelWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, width: 72 },
  statusBarName:      { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  statusBarCount:     { fontSize: 12, fontWeight: '800', color: colors.textPrimary, width: 30, textAlign: 'right' },
  statusBarPct:       { fontSize: 11, color: colors.textMuted, width: 48 },

  /* Bottom 2-column grid */
  bottomGrid:  { flexDirection: 'row', gap: 14 },
  bottomLeft:  { flex: 3 },
  bottomRight: { flex: 2 },

  /* Recent assignments table */
  tblHead:    { flexDirection: 'row', backgroundColor: colors.primary + '0C', paddingVertical: 9, paddingHorizontal: 8, borderRadius: 6, marginBottom: 2 },
  tblTh:      { fontSize: 11, fontWeight: '800', color: colors.primary },
  tblRow:     { flexDirection: 'row', paddingVertical: 11, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: colors.border, alignItems: 'center' },
  tblTd:      { fontSize: 12, color: colors.textPrimary },
  tblActions: { flexDirection: 'row', gap: 2 },
  tblEmpty:   { padding: 24, alignItems: 'center' },
  tblFooter:  {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border, marginTop: 4,
  },
  tblFooterText:  { fontSize: 12, color: colors.textSecondary },
  tblPagination:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pageBtn:        { width: 28, height: 28, borderRadius: 6, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
  pageBtnDisabled:{ opacity: 0.4 },
  pageCurrent:    { width: 28, height: 28, borderRadius: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  pageCurrentText:{ fontSize: 12, fontWeight: '700', color: '#fff' },
  actionBtn:      { padding: 5, borderRadius: 5 },

  /* Trend chart */
  trendSummary: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  trendLabel:   { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },
  trendValue:   { fontSize: 16, fontWeight: '800', color: colors.textPrimary, marginTop: 2 },

  /* Status badge */
  badge:     { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, alignSelf: 'flex-start' },
  badgeText: { fontSize: 11, fontWeight: '700' },

  centered:  { padding: 60, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText: { fontSize: 14, color: colors.danger, textAlign: 'center' },
});
