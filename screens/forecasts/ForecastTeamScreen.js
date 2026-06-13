import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AppShell from '../../components/AppShell';
import { colors } from '../../constants/colors';
import { globalWidth } from '../../constants/globalWidth';
import { getForecastById, getTeamForecasts, updateForecastStatus } from '../../store/forecasts/forecastActions';
import {
  MONTH_OPTIONS,
  coverageState,
  fmtCurrency,
  fmtNumber,
  forecastStatusColors,
  getCoverage,
  getCurrency,
  getForecastItems,
  getForecastStatus,
  getForecastUserId,
  getForecastUserName,
  getMonthLabel,
  getPortfolioSummary,
  getTeamForecastId,
  getTeamForecastList,
  summarizeByChannel,
  summarizeByProduct,
  yearOptions,
} from './forecastUtils';

const isManager = (role) =>
  ['admin', 'manager', 'senior_manager'].includes(String(role).toLowerCase());

const THIS_YEAR = new Date().getFullYear();
const THIS_MONTH = new Date().getMonth() + 1;

const shadow = { shadowColor: '#11224A', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 14, elevation: 3 };
const PAD = globalWidth('1.2%');

const TEAM_COLS = [
  { key: 'rep', label: 'Rep Name', width: 180 },
  { key: 'target', label: 'Target Value', width: 120 },
  { key: 'forecast', label: 'Forecast Value', width: 120 },
  { key: 'deficit', label: 'Deficit Value', width: 120 },
  { key: 'coverage', label: 'Coverage %', width: 160 },
  { key: 'status', label: 'Forecast Status', width: 110 },
  { key: 'actions', label: 'Actions', width: 110 },
];

function StatCard({ icon, label, value, accent }) {
  return (
    <View style={[styles.statCard, { backgroundColor: accent.bg, borderColor: accent.border }]}>
      <View style={[styles.statIcon, { backgroundColor: accent.chip }]}>
        <Ionicons name={icon} size={20} color="#fff" />
      </View>
      <View style={styles.statBody}>
        <Text style={[styles.statLabel, { color: accent.label }]}>{label}</Text>
        <Text style={[styles.statValue, { color: accent.value }]}>{value ?? '—'}</Text>
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

function AnalysisRow({ name, targetValue, forecastValue, coverage, currency }) {
  const state = coverageState(coverage);
  return (
    <View style={styles.analysisRow}>
      <View style={styles.analysisTop}>
        <Text style={styles.analysisName} numberOfLines={1}>{name}</Text>
        <Text style={styles.analysisValues}>
          {fmtCurrency(forecastValue, currency)} <Text style={styles.analysisOf}>of {fmtCurrency(targetValue, currency)}</Text>
        </Text>
        <View style={[styles.badge, { backgroundColor: state.bg }]}>
          <Text style={[styles.badgeText, { color: state.text }]}>{fmtNumber(coverage)}%</Text>
        </View>
      </View>
      <View style={styles.analysisTrack}>
        <View style={[styles.analysisFill, { backgroundColor: state.bar, width: `${Math.min(coverage, 100)}%` }]} />
      </View>
    </View>
  );
}

function AnalysisCard({ title, icon, rows, currency, emptyLabel }) {
  return (
    <View style={[styles.card, { flex: 1, minWidth: 320 }]}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleRow}>
          <Ionicons name={icon} size={15} color={colors.primary} />
          <Text style={styles.cardTitle}>{title}</Text>
        </View>
        <Text style={styles.cardMeta}>{rows.length || ''}</Text>
      </View>
      {rows.length ? (
        <ScrollView style={{ maxHeight: 280 }} nestedScrollEnabled showsVerticalScrollIndicator={false}>
          {rows.map((row) => (
            <AnalysisRow key={row.name} {...row} currency={currency} />
          ))}
        </ScrollView>
      ) : (
        <Text style={styles.emptyText}>{emptyLabel}</Text>
      )}
    </View>
  );
}

function CoverageBadge({ coverage }) {
  const state = coverageState(coverage);
  return (
    <View style={styles.coverageCell}>
      <View style={[styles.badge, { backgroundColor: state.bg }]}>
        <Text style={[styles.badgeText, { color: state.text }]}>{fmtNumber(coverage)}%</Text>
      </View>
      <View style={styles.coverageTrack}>
        <View style={[styles.coverageFill, { backgroundColor: state.bar, width: `${Math.min(coverage, 100)}%` }]} />
      </View>
    </View>
  );
}

function StatusBadge({ status }) {
  const s = forecastStatusColors(status);
  return (
    <View style={[styles.badge, { backgroundColor: s.bg }]}>
      <Text style={[styles.badgeText, { color: s.text }]}>
        {String(status).charAt(0).toUpperCase() + String(status).slice(1)}
      </Text>
    </View>
  );
}

export default function ForecastTeamScreen({ navigation, userDetails, appMetadata, onSignOut }) {
  const user = userDetails?.user || userDetails?.data?.user || userDetails || {};
  const token = userDetails?.token || userDetails?.data?.token || '';
  const manager = isManager(user.role || '');

  useEffect(() => {
    if (!manager) navigation.replace('MyForecast');
  }, [manager, navigation]);

  const [year, setYear] = useState(String(THIS_YEAR));
  const [month, setMonth] = useState(String(THIS_MONTH));
  const [repFilter, setRepFilter] = useState('');
  const [teamData, setTeamData] = useState(null);
  const [forecasts, setForecasts] = useState([]);
  const [detailsById, setDetailsById] = useState({});
  const [repOptions, setRepOptions] = useState([{ label: 'All Reps', value: '' }]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingId, setSavingId] = useState('');

  const fetchForecasts = useCallback(async () => {
    if (!token || !manager) return;
    try {
      setLoading(true);
      setError('');
      const params = { year, month };
      if (repFilter) params.userId = repFilter;
      const result = await getTeamForecasts(token, params);
      const data = result?.data || null;
      const list = getTeamForecastList(result);
      setTeamData(data);
      setForecasts(list);
      setDetailsById({});
      if (!repFilter) {
        setRepOptions([
          { label: 'All Reps', value: '' },
          ...list.map((entry) => ({
            label: getForecastUserName(entry),
            value: String(getForecastUserId(entry)),
          })).filter((option) => option.value),
        ]);
      }
    } catch (err) {
      setTeamData(null);
      setForecasts([]);
      setError(err.message || 'Failed to load team forecasts.');
    } finally {
      setLoading(false);
    }
  }, [manager, month, repFilter, token, year]);

  useEffect(() => { fetchForecasts(); }, [fetchForecasts]);

  // Prefetch full forecasts (channel-level data) for the channel analysis card.
  useEffect(() => {
    if (!token || !forecasts.length) return;
    const missing = forecasts
      .map((entry) => getTeamForecastId(entry))
      .filter((id) => id && !detailsById[id]);
    if (!missing.length) return;

    Promise.all(
      missing.map((id) =>
        getForecastById(token, id)
          .then((result) => [id, result?.data || result])
          .catch(() => null),
      ),
    ).then((entries) => {
      const loaded = entries.filter(Boolean);
      if (!loaded.length) return;
      setDetailsById((current) => ({ ...current, ...Object.fromEntries(loaded) }));
    });
  }, [detailsById, forecasts, token]);

  const channelAnalysis = useMemo(
    () => summarizeByChannel(Object.values(detailsById).flatMap((detail) => getForecastItems(detail))),
    [detailsById],
  );

  const productAnalysis = useMemo(
    () => summarizeByProduct(forecasts.flatMap((entry) => getForecastItems(entry))),
    [forecasts],
  );

  const totals = useMemo(() => {
    if (teamData?.totalMonthlyTargetValue !== undefined) {
      return {
        targetValue: Number(teamData.totalMonthlyTargetValue) || 0,
        forecastValue: Number(teamData.totalForecastValue) || 0,
        deficitValue: Number(teamData.totalDeficitValue) || 0,
        coverage: Number(teamData.totalCoveragePercentage) || 0,
      };
    }
    const sums = forecasts.reduce(
      (acc, entry) => {
        const summary = getPortfolioSummary(entry, []);
        acc.targetValue += summary.targetValue;
        acc.forecastValue += summary.forecastValue;
        return acc;
      },
      { targetValue: 0, forecastValue: 0 },
    );
    return {
      ...sums,
      deficitValue: Math.max(sums.targetValue - sums.forecastValue, 0),
      coverage: sums.targetValue > 0 ? (sums.forecastValue / sums.targetValue) * 100 : 0,
    };
  }, [forecasts, teamData]);

  const currency = getCurrency(forecasts[0] || {});
  const totalsState = coverageState(totals.coverage);

  const changeStatus = async (entry, status) => {
    const repName = getForecastUserName(entry);
    const message = status === 'reviewed'
      ? `Accept ${repName}'s forecast for ${getMonthLabel(month)} ${year}?`
      : `Reject ${repName}'s forecast and send it back to draft?`;
    if (!window.confirm(message)) return;
    try {
      setSavingId(getTeamForecastId(entry));
      await updateForecastStatus(token, getTeamForecastId(entry), { status });
      await fetchForecasts();
    } catch (err) {
      window.alert(err.message || 'Status update failed.');
    } finally {
      setSavingId('');
    }
  };

  return (
    <AppShell navigation={navigation} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} activeRoute="ForecastTeam">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* ── Header ── */}
        <View style={styles.pageHeader}>
          <View>
            <Text style={styles.pageTitle}>Forecast Dashboard</Text>
            <Text style={styles.pageSubtitle}>Team forecast vs monthly targets — {getMonthLabel(month)} {year}</Text>
          </View>
          <View style={styles.headerRight}>
            <FilterItem icon="calendar-outline" label="Year" options={yearOptions(THIS_YEAR)} value={year} onChange={setYear} style={{ minWidth: 90 }} zIndex={31} />
            <FilterItem icon="calendar-outline" label="Month" options={MONTH_OPTIONS} value={month} onChange={setMonth} style={{ minWidth: 110 }} zIndex={30} />
            <FilterItem icon="person-outline" label="Medical Rep" options={repOptions} value={repFilter} onChange={setRepFilter} style={{ minWidth: 140 }} zIndex={29} />
          </View>
        </View>

        {/* ── Stat Cards ── */}
        <View style={styles.statsRow}>
          <StatCard icon="flag-outline" accent={colors.accents.blue} label="Total Target Value" value={fmtCurrency(totals.targetValue, currency)} />
          <StatCard icon="trending-up-outline" accent={colors.accents.teal} label="Forecasted Value" value={fmtCurrency(totals.forecastValue, currency)} />
          <StatCard icon="alert-circle-outline" accent={colors.accents.rose} label="Deficit Value" value={fmtCurrency(totals.deficitValue, currency)} />
          <StatCard icon="speedometer-outline" accent={colors.accents.amber} label="Coverage" value={`${fmtNumber(totals.coverage)}%`} />
        </View>

        {/* ── Overall progress ── */}
        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <Text style={styles.cardTitle}>Team Forecast Progress</Text>
            <View style={[styles.badge, { backgroundColor: totalsState.bg }]}>
              <Text style={[styles.badgeText, { color: totalsState.text }]}>
                {totals.coverage > 100 ? 'Over Target' : totalsState.label}
              </Text>
            </View>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { backgroundColor: totalsState.bar, width: `${Math.min(totals.coverage, 100)}%` }]} />
          </View>
        </View>

        {loading ? (
          <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
        ) : error ? (
          <View style={styles.centered}>
            <Ionicons name="alert-circle-outline" size={32} color={colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.btnOutline} onPress={fetchForecasts}>
              <Text style={styles.btnOutlineText}>Retry</Text>
            </Pressable>
          </View>
        ) : (
          <>
          {/* ── Analysis: by channel / by product ── */}
          <View style={styles.analysisGrid}>
            <AnalysisCard
              title="Forecast by Sales Channel"
              icon="storefront-outline"
              rows={channelAnalysis}
              currency={currency}
              emptyLabel={forecasts.length ? 'Loading channel data…' : 'No data for this month.'}
            />
            <AnalysisCard
              title="Forecast by Product"
              icon="cube-outline"
              rows={productAnalysis}
              currency={currency}
              emptyLabel="No data for this month."
            />
          </View>

          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Team Forecasts</Text>
              <Text style={styles.cardMeta}>{forecasts.length} rep{forecasts.length === 1 ? '' : 's'}</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View>
                <View style={styles.tblHead}>
                  {TEAM_COLS.map((col) => (
                    <Text key={col.key} style={[styles.tblTh, { width: col.width }]}>{col.label}</Text>
                  ))}
                </View>
                {forecasts.length === 0 ? (
                  <View style={styles.tblEmpty}><Text style={styles.emptyText}>No target found for this month.</Text></View>
                ) : forecasts.map((entry) => {
                  const forecastId = getTeamForecastId(entry);
                  const summary = getPortfolioSummary(entry, []);
                  const coverage = summary.coverage || getCoverage(entry);
                  const status = getForecastStatus(entry);
                  const saving = savingId === forecastId;
                  return (
                    <View key={forecastId} style={styles.tblRow}>
                      <Text style={[styles.tblTd, styles.tblTdStrong, { width: 180 }]} numberOfLines={1}>{getForecastUserName(entry)}</Text>
                      <Text style={[styles.tblTd, { width: 120 }]}>{fmtCurrency(summary.targetValue, currency)}</Text>
                      <Text style={[styles.tblTd, { width: 120 }]}>{fmtCurrency(summary.forecastValue, currency)}</Text>
                      <Text style={[styles.tblTd, { width: 120 }]}>{fmtCurrency(summary.deficitValue, currency)}</Text>
                      <View style={[styles.tblTd, { width: 160 }]}><CoverageBadge coverage={coverage} /></View>
                      <View style={[styles.tblTd, { width: 110 }]}><StatusBadge status={status} /></View>
                      <View style={[styles.tblTd, styles.tblActions, { width: 110 }]}>
                        <Pressable
                          style={styles.actionBtn}
                          disabled={saving}
                          onPress={() => navigation.navigate('ForecastDetails', { forecastId })}
                        >
                          <Ionicons name="eye-outline" size={15} color={colors.textSecondary} />
                        </Pressable>
                        <Pressable style={styles.actionBtn} disabled={saving} onPress={() => changeStatus(entry, 'reviewed')}>
                          <Ionicons name="checkmark-circle-outline" size={15} color="#15803D" />
                        </Pressable>
                        <Pressable style={styles.actionBtn} disabled={saving} onPress={() => changeStatus(entry, 'draft')}>
                          <Ionicons name="close-circle-outline" size={15} color={colors.danger} />
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          </View>
          </>
        )}
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: PAD, gap: 16, paddingBottom: 48 },

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
  statValue: { fontSize: 22, fontWeight: '800', color: colors.textPrimary },

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
  filterOpt: { paddingHorizontal: 12, paddingVertical: 9 },
  filterOptActive: { backgroundColor: colors.primary + '15' },
  filterOptText: { fontSize: 13, color: colors.textPrimary },
  filterOptTextActive: { color: colors.primary, fontWeight: '700' },

  progressCard: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 14, padding: 16, gap: 10, ...shadow,
  },
  progressHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progressTrack: { height: 8, backgroundColor: colors.border + '90', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: 8, borderRadius: 4 },

  card: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 14, padding: 16, gap: 10, ...shadow,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontSize: 14, fontWeight: '800', color: colors.textPrimary },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  cardMeta: { fontSize: 12, color: colors.textMuted },

  /* Analysis cards */
  analysisGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  analysisRow: { gap: 6, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border + '60' },
  analysisTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  analysisName: { flex: 1, fontSize: 12, fontWeight: '700', color: colors.textPrimary },
  analysisValues: { fontSize: 12, fontWeight: '700', color: colors.textPrimary },
  analysisOf: { fontSize: 11, fontWeight: '500', color: colors.textMuted },
  analysisTrack: { height: 6, backgroundColor: colors.border + '90', borderRadius: 3, overflow: 'hidden' },
  analysisFill: { height: 6, borderRadius: 3 },
  emptyText: { fontSize: 13, color: colors.textMuted, textAlign: 'center', paddingVertical: 12 },

  tblHead: { flexDirection: 'row', backgroundColor: colors.primary + '0C', paddingVertical: 9, paddingHorizontal: 8, borderRadius: 6, marginBottom: 2 },
  tblTh: { fontSize: 11, fontWeight: '800', color: colors.primary },
  tblRow: { flexDirection: 'row', paddingVertical: 11, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: colors.border, alignItems: 'center' },
  tblTd: { fontSize: 12, color: colors.textPrimary },
  tblTdStrong: { fontWeight: '700' },
  tblActions: { flexDirection: 'row', gap: 2 },
  tblEmpty: { padding: 24, alignItems: 'center' },
  actionBtn: { padding: 5, borderRadius: 5 },

  coverageCell: { gap: 4, paddingRight: 16 },
  coverageTrack: { height: 5, backgroundColor: colors.border + '90', borderRadius: 3, overflow: 'hidden' },
  coverageFill: { height: 5, borderRadius: 3 },

  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, alignSelf: 'flex-start' },
  badgeText: { fontSize: 11, fontWeight: '700' },

  btnOutline: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
    backgroundColor: colors.surface,
  },
  btnOutlineText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },

  centered: { padding: 60, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText: { fontSize: 14, color: colors.danger, textAlign: 'center' },
});
