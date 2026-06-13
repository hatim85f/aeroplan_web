import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AppShell from '../../components/AppShell';
import { colors } from '../../constants/colors';
import { globalWidth } from '../../constants/globalWidth';
import { getForecastMatching } from '../../store/forecasts/forecastActions';
import {
  MONTH_OPTIONS,
  fmtCurrency,
  fmtNumber,
  getMonthLabel,
  matchStatusColors,
  yearOptions,
} from './forecastUtils';

const isManager = (role) =>
  ['admin', 'manager', 'senior_manager'].includes(String(role).toLowerCase());

const THIS_YEAR = new Date().getFullYear();
const THIS_MONTH = new Date().getMonth() + 1;

const shadow = { shadowColor: '#11224A', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 14, elevation: 3 };
const PAD = globalWidth('1.2%');

const STATUS_FILTERS = ['all', 'matched', 'over', 'under', 'missed'];

function StatCard({ icon, label, value, sub, accent }) {
  return (
    <View style={[styles.statCard, { backgroundColor: accent.bg, borderColor: accent.border }]}>
      <View style={[styles.statIcon, { backgroundColor: accent.chip }]}>
        <Ionicons name={icon} size={20} color="#fff" />
      </View>
      <View style={styles.statBody}>
        <Text style={[styles.statLabel, { color: accent.label }]}>{label}</Text>
        <Text style={[styles.statValue, { color: accent.value }]}>{value ?? '—'}</Text>
        {sub ? <Text style={[styles.statSub, { color: accent.label }]}>{sub}</Text> : null}
      </View>
    </View>
  );
}

function FilterItem({ icon, label, options, value, onChange, style, zIndex = 1 }) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  return (
    <View style={[{ position: 'relative', zIndex: open ? 60 : zIndex }, style]}>
      <Pressable style={styles.filterItem} onPress={() => setOpen((v) => !v)}>
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
            {options.map((opt) => (
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

function MatchBadge({ status }) {
  const s = matchStatusColors(status);
  return (
    <View style={[styles.badge, { backgroundColor: s.bg }]}>
      <Text style={[styles.badgeText, { color: s.text }]}>{s.label}</Text>
    </View>
  );
}

function PctText({ value }) {
  const color = value >= 98 ? '#15803D' : value >= 70 ? '#1D4ED8' : value > 0 ? '#B45309' : colors.textMuted;
  return <Text style={[styles.pctText, { color }]}>{fmtNumber(value)}%</Text>;
}

export default function ForecastMatchingScreen({ navigation, userDetails, appMetadata, onSignOut }) {
  const user = userDetails?.user || userDetails?.data?.user || userDetails || {};
  const token = userDetails?.token || userDetails?.data?.token || '';
  const manager = isManager(user.role || '');

  const [year, setYear] = useState(String(THIS_YEAR));
  const [month, setMonth] = useState(String(THIS_MONTH));
  const [repFilter, setRepFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [view, setView] = useState('products'); // 'products' | 'accounts'
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchMatching = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      setError('');
      const result = await getForecastMatching(token, { year, month });
      setData(result?.data || null);
    } catch (err) {
      setData(null);
      setError(err.message || 'Failed to load forecast matching.');
    } finally {
      setLoading(false);
    }
  }, [month, token, year]);

  useEffect(() => { fetchMatching(); }, [fetchMatching]);

  const reps = useMemo(() => data?.reps || [], [data]);

  const repOptions = useMemo(() => ([
    { label: 'All Reps', value: '' },
    ...reps.map((rep) => ({ label: rep.userName || 'Representative', value: String(rep.userId) })),
  ]), [reps]);

  const selectedRep = useMemo(
    () => (repFilter ? reps.find((rep) => String(rep.userId) === repFilter) || null : null),
    [repFilter, reps],
  );

  const summary = selectedRep ? selectedRep.summary : data?.summary || null;
  const products = selectedRep ? selectedRep.products : data?.products || [];
  const accounts = useMemo(() => {
    const source = selectedRep
      ? selectedRep.accounts.map((row) => ({ ...row, userName: selectedRep.userName }))
      : reps.flatMap((rep) => rep.accounts.map((row) => ({ ...row, userName: rep.userName })));
    if (statusFilter === 'all') return source;
    return source.filter((row) => row.matchStatus === statusFilter);
  }, [reps, selectedRep, statusFilter]);

  const statusCounts = summary?.accountStatusCounts || { matched: 0, over: 0, under: 0, missed: 0 };
  const showRepColumn = manager && !selectedRep;

  return (
    <AppShell navigation={navigation} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} activeRoute="ForecastMatching" scrollable={false}>
      <View style={styles.page}>

        {/* ── Header ── */}
        <View style={styles.pageHeader}>
          <View>
            <Text style={styles.pageTitle}>Forecast vs Sales</Text>
            <Text style={styles.pageSubtitle}>How forecasts materialized in actual sales — {getMonthLabel(month)} {year}</Text>
          </View>
          <View style={styles.headerRight}>
            <FilterItem icon="calendar-outline" label="Year" options={yearOptions(THIS_YEAR)} value={year} onChange={setYear} style={{ minWidth: 90 }} zIndex={31} />
            <FilterItem icon="calendar-outline" label="Month" options={MONTH_OPTIONS} value={month} onChange={setMonth} style={{ minWidth: 110 }} zIndex={30} />
            {manager ? (
              <FilterItem icon="person-outline" label="Medical Rep" options={repOptions} value={repFilter} onChange={setRepFilter} style={{ minWidth: 140 }} zIndex={29} />
            ) : null}
          </View>
        </View>

        {/* ── Stat Cards ── */}
        <View style={styles.statsRow}>
          <StatCard icon="flag-outline" accent={colors.accents.blue} label="Forecasted Value" value={fmtCurrency(summary?.forecastValue)} sub={`${fmtNumber(summary?.forecastUnits)} units`} />
          <StatCard icon="cash-outline" accent={colors.accents.teal} label="Actual Sales Value" value={fmtCurrency(summary?.salesValue)} sub={`${fmtNumber(summary?.salesUnits)} units`} />
          <StatCard icon="speedometer-outline" accent={colors.accents.rose} label="Value Match" value={`${fmtNumber(summary?.valueAchievementPercentage)}%`} />
          <StatCard icon="cube-outline" accent={colors.accents.amber} label="Units Match" value={`${fmtNumber(summary?.unitsAchievementPercentage)}%`} />
        </View>

        {loading ? (
          <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
        ) : error ? (
          <View style={styles.centered}>
            <Ionicons name="alert-circle-outline" size={32} color={colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.btnOutline} onPress={fetchMatching}>
              <Text style={styles.btnOutlineText}>Retry</Text>
            </Pressable>
          </View>
        ) : (
          <View style={[styles.card, styles.cardFill]}>
            {/* Card header: view toggle + status chips */}
            <View style={styles.cardHeader}>
              <View style={styles.segment}>
                {[{ key: 'products', label: 'By Product' }, { key: 'accounts', label: 'By Account' }].map((option) => {
                  const active = view === option.key;
                  return (
                    <Pressable key={option.key} style={[styles.segmentBtn, active && styles.segmentBtnActive]} onPress={() => setView(option.key)}>
                      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{option.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              {view === 'accounts' ? (
                <View style={styles.statusBar}>
                  {STATUS_FILTERS.map((status) => {
                    const active = statusFilter === status;
                    const theme = status === 'all'
                      ? { bg: colors.primary + '15', text: colors.primary, label: 'All' }
                      : matchStatusColors(status);
                    const count = status === 'all'
                      ? statusCounts.matched + statusCounts.over + statusCounts.under + statusCounts.missed
                      : statusCounts[status] || 0;
                    return (
                      <Pressable
                        key={status}
                        style={[styles.statusChip, { backgroundColor: theme.bg }, active && styles.statusChipActive]}
                        onPress={() => setStatusFilter(status)}
                      >
                        <Text style={[styles.statusChipText, { color: theme.text }]}>{theme.label} ({count})</Text>
                      </Pressable>
                    );
                  })}
                </View>
              ) : (
                <Text style={styles.cardMeta}>{products.length} product{products.length === 1 ? '' : 's'}</Text>
              )}
            </View>

            {view === 'products' ? (
              <>
                {/* Products: pinned head */}
                <View style={styles.tblHead}>
                  <Text style={[styles.tblTh, styles.colName]}>PRODUCT</Text>
                  <Text style={[styles.tblThNum, styles.colNum]}>FORECAST UNITS</Text>
                  <Text style={[styles.tblThNum, styles.colNum]}>SALES UNITS</Text>
                  <Text style={[styles.tblThNum, styles.colPct]}>UNITS %</Text>
                  <Text style={[styles.tblThNum, styles.colNum]}>FORECAST VALUE</Text>
                  <Text style={[styles.tblThNum, styles.colNum]}>SALES VALUE</Text>
                  <Text style={[styles.tblThNum, styles.colPct]}>VALUE %</Text>
                  <Text style={[styles.tblTh, styles.colStatus]}>STATUS</Text>
                </View>
                <ScrollView style={styles.rowsScroll} showsVerticalScrollIndicator nestedScrollEnabled>
                  {!products.length ? (
                    <View style={styles.tblEmpty}><Text style={styles.emptyText}>No forecast found for this month.</Text></View>
                  ) : products.map((product, index) => (
                    <View key={String(product.productId)} style={[styles.tblRow, index % 2 === 1 && styles.tblRowAlt]}>
                      <Text style={[styles.tblTd, styles.tblTdStrong, styles.colName]} numberOfLines={1}>{product.productNickname || product.productName}</Text>
                      <Text style={[styles.tblTdNum, styles.colNum]}>{fmtNumber(product.forecastUnits)}</Text>
                      <Text style={[styles.tblTdNum, styles.colNum]}>{fmtNumber(product.salesUnits)}</Text>
                      <View style={[styles.colPct, styles.cellRight]}><PctText value={product.unitsAchievementPercentage} /></View>
                      <Text style={[styles.tblTdNum, styles.colNum]}>{fmtCurrency(product.forecastValue)}</Text>
                      <Text style={[styles.tblTdNum, styles.colNum]}>{fmtCurrency(product.salesValue)}</Text>
                      <View style={[styles.colPct, styles.cellRight]}><PctText value={product.valueAchievementPercentage} /></View>
                      <View style={styles.colStatus}><MatchBadge status={product.matchStatus} /></View>
                    </View>
                  ))}
                </ScrollView>
              </>
            ) : (
              <>
                {/* Accounts: pinned head */}
                <View style={styles.tblHead}>
                  <Text style={[styles.tblTh, styles.colName]}>ACCOUNT</Text>
                  {showRepColumn ? <Text style={[styles.tblTh, styles.colRep]}>REP</Text> : null}
                  <Text style={[styles.tblTh, styles.colProduct]}>PRODUCT</Text>
                  <Text style={[styles.tblTh, styles.colChannel]}>CHANNEL</Text>
                  <Text style={[styles.tblTh, styles.colType]}>TYPE</Text>
                  <Text style={[styles.tblThNum, styles.colNum]}>FORECAST</Text>
                  <Text style={[styles.tblThNum, styles.colNum]}>ACTUAL SALES</Text>
                  <Text style={[styles.tblThNum, styles.colPct]}>ACHV %</Text>
                  <Text style={[styles.tblTh, styles.colStatus]}>STATUS</Text>
                </View>
                <ScrollView style={styles.rowsScroll} showsVerticalScrollIndicator nestedScrollEnabled>
                  {!accounts.length ? (
                    <View style={styles.tblEmpty}><Text style={styles.emptyText}>No forecast added yet.</Text></View>
                  ) : accounts.map((row, index) => (
                    <View key={String(row.accountForecastId || `${row.accountId}-${row.productId}-${row.channelId}`)} style={[styles.tblRow, index % 2 === 1 && styles.tblRowAlt]}>
                      <Text style={[styles.tblTd, styles.tblTdStrong, styles.colName]} numberOfLines={1}>{row.accountName}</Text>
                      {showRepColumn ? <Text style={[styles.tblTd, styles.colRep]} numberOfLines={1}>{row.userName}</Text> : null}
                      <Text style={[styles.tblTd, styles.colProduct]} numberOfLines={1}>{row.productNickname || row.productName}</Text>
                      <Text style={[styles.tblTd, styles.colChannel]} numberOfLines={1}>{row.channelName}</Text>
                      <Text style={[styles.tblTd, styles.colType]}>{row.inputType === 'value' ? 'Value' : 'Units'}</Text>
                      <Text style={[styles.tblTdNum, styles.colNum]}>
                        {row.inputType === 'value' ? fmtCurrency(row.forecastValue) : `${fmtNumber(row.forecastQuantity)} u`}
                      </Text>
                      <Text style={[styles.tblTdNum, styles.colNum]}>
                        {row.inputType === 'value' ? fmtCurrency(row.salesValue) : `${fmtNumber(row.salesQuantity)} u`}
                      </Text>
                      <View style={[styles.colPct, styles.cellRight]}><PctText value={row.achievementPercentage} /></View>
                      <View style={styles.colStatus}><MatchBadge status={row.matchStatus} /></View>
                    </View>
                  ))}
                </ScrollView>
              </>
            )}
          </View>
        )}
      </View>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, minHeight: 0, padding: PAD, gap: 14 },

  pageHeader: {
    flexDirection: 'row', alignItems: 'flex-start',
    justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, zIndex: 30,
  },
  pageTitle: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  pageSubtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard: {
    flex: 1, minWidth: 150, flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 14, padding: 16, ...shadow,
  },
  statIcon: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  statBody: { flex: 1 },
  statLabel: { fontSize: 11, color: colors.textSecondary, fontWeight: '600', marginBottom: 3 },
  statValue: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  statSub: { fontSize: 11, color: colors.textMuted, marginTop: 2 },

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
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border,
    borderRadius: 8, zIndex: 1000, elevation: 20,
    shadowColor: '#0B2B66', shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 6 },
  },
  filterOpt: { paddingHorizontal: 12, paddingVertical: 9 },
  filterOptActive: { backgroundColor: colors.primary + '15' },
  filterOptText: { fontSize: 13, color: colors.textPrimary },
  filterOptTextActive: { color: colors.primary, fontWeight: '700' },

  card: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 14, padding: 16, gap: 10, ...shadow,
  },
  cardFill: { flex: 1, minHeight: 0 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 },
  cardMeta: { fontSize: 12, color: colors.textMuted },
  emptyText: { fontSize: 13, color: colors.textMuted, textAlign: 'center', paddingVertical: 12 },

  segment: {
    flexDirection: 'row', borderWidth: 1, borderColor: colors.border,
    borderRadius: 8, overflow: 'hidden', backgroundColor: colors.backgroundColor,
  },
  segmentBtn: { paddingHorizontal: 16, paddingVertical: 8 },
  segmentBtnActive: { backgroundColor: colors.primary },
  segmentText: { fontSize: 12, fontWeight: '700', color: colors.textPrimary },
  segmentTextActive: { color: '#fff' },

  statusBar: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  statusChip: {
    paddingHorizontal: 11, paddingVertical: 6, borderRadius: 16,
    borderWidth: 1, borderColor: 'transparent',
  },
  statusChipActive: { borderColor: colors.textPrimary + '50' },
  statusChipText: { fontSize: 11, fontWeight: '700' },

  /* Flexible columns */
  colName: { flex: 2, minWidth: 150 },
  colRep: { flex: 1.2, minWidth: 100 },
  colProduct: { flex: 1.5, minWidth: 110 },
  colChannel: { flex: 1, minWidth: 80 },
  colType: { flex: 0.7, minWidth: 55 },
  colNum: { flex: 1.1, minWidth: 95 },
  colPct: { flex: 0.8, minWidth: 70 },
  colStatus: { flex: 1.1, minWidth: 105, alignItems: 'flex-start' },
  cellRight: { alignItems: 'flex-end' },

  tblHead: {
    flexDirection: 'row', backgroundColor: colors.primary + '0C',
    paddingVertical: 9, paddingHorizontal: 14, borderRadius: 6, gap: 20, alignItems: 'center',
  },
  tblTh: { fontSize: 11, fontWeight: '800', color: colors.primary },
  tblThNum: { fontSize: 11, fontWeight: '800', color: colors.primary, textAlign: 'right' },
  rowsScroll: { flex: 1, minHeight: 0 },
  tblRow: {
    flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 14, gap: 20,
    borderBottomWidth: 1, borderBottomColor: colors.border, alignItems: 'center',
  },
  tblRowAlt: { backgroundColor: colors.backgroundColor + '70' },
  tblTd: { fontSize: 12, color: colors.textPrimary },
  tblTdNum: { fontSize: 12, color: colors.textPrimary, textAlign: 'right' },
  tblTdStrong: { fontWeight: '700' },
  tblEmpty: { padding: 24, alignItems: 'center' },
  pctText: { fontSize: 12, fontWeight: '800' },

  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, alignSelf: 'flex-start' },
  badgeText: { fontSize: 11, fontWeight: '700' },

  btnOutline: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
    backgroundColor: colors.surface,
  },
  btnOutlineText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },

  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText: { fontSize: 14, color: colors.danger, textAlign: 'center' },
});
