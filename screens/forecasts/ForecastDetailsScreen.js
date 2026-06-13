import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AppShell from '../../components/AppShell';
import { colors } from '../../constants/colors';
import { globalWidth } from '../../constants/globalWidth';
import { getForecastById, updateForecastStatus } from '../../store/forecasts/forecastActions';
import {
  coverageState,
  fmtCurrency,
  fmtNumber,
  forecastStatusColors,
  getAccountForecastName,
  getAccountForecastQuantity,
  getAccountForecastStatus,
  getAccountForecastValue,
  getChannelAccountForecasts,
  getChannelId,
  getChannelName,
  getCoverage,
  getCurrency,
  getDeficitUnits,
  getDeficitValue,
  getForecastFromResult,
  getForecastItems,
  getForecastStatus,
  getForecastUnits,
  getForecastUserName,
  getForecastValue,
  getId,
  getItemChannels,
  getItemProductId,
  getItemProductName,
  getItemProductNickname,
  getMonthLabel,
  getPortfolioSummary,
  getTargetUnits,
  getTargetValue,
} from './forecastUtils';

const isManager = (role) =>
  ['admin', 'manager', 'senior_manager'].includes(String(role).toLowerCase());

const shadow = { shadowColor: '#11224A', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 14, elevation: 3 };
const PAD = globalWidth('1.2%');

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

function CoverageBadge({ coverage }) {
  const state = coverageState(coverage);
  return (
    <View style={[styles.badge, { backgroundColor: state.bg }]}>
      <Text style={[styles.badgeText, { color: state.text }]}>{fmtNumber(coverage)}%</Text>
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

export default function ForecastDetailsScreen({ navigation, route, userDetails, appMetadata, onSignOut }) {
  const user = userDetails?.user || userDetails?.data?.user || userDetails || {};
  const token = userDetails?.token || userDetails?.data?.token || '';
  const manager = isManager(user.role || '');
  const forecastId = route?.params?.forecastId;

  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [expandedProductId, setExpandedProductId] = useState('');

  const fetchForecast = useCallback(async () => {
    if (!token || !forecastId) return;
    try {
      setLoading(true);
      setError('');
      const result = await getForecastById(token, forecastId);
      setForecast(getForecastFromResult(result));
    } catch (err) {
      setForecast(null);
      setError(err.message || 'Failed to load forecast.');
    } finally {
      setLoading(false);
    }
  }, [forecastId, token]);

  useEffect(() => { fetchForecast(); }, [fetchForecast]);

  const items = useMemo(() => getForecastItems(forecast || {}), [forecast]);
  const summary = useMemo(() => getPortfolioSummary(forecast, items), [forecast, items]);
  const currency = getCurrency(forecast || {});
  const status = getForecastStatus(forecast || {});
  const summaryState = coverageState(summary.coverage);

  const changeStatus = async (nextStatus) => {
    const message = nextStatus === 'reviewed'
      ? 'Accept this forecast and mark it as reviewed?'
      : 'Reject this forecast and send it back to draft?';
    if (!window.confirm(message)) return;
    try {
      setSaving(true);
      await updateForecastStatus(token, forecastId, { status: nextStatus });
      await fetchForecast();
    } catch (err) {
      window.alert(err.message || 'Status update failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell navigation={navigation} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} activeRoute="ForecastTeam">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* ── Header ── */}
        <View style={styles.pageHeader}>
          <View style={styles.headerLeft}>
            <Pressable style={styles.backBtn} onPress={() => navigation.navigate(manager ? 'ForecastTeam' : 'MyForecast')}>
              <Ionicons name="arrow-back" size={18} color={colors.textPrimary} />
            </Pressable>
            <View>
              <View style={styles.titleRow}>
                <Text style={styles.pageTitle}>{getForecastUserName(forecast || {})}</Text>
                <StatusBadge status={status} />
              </View>
              <Text style={styles.pageSubtitle}>
                Forecast details — {getMonthLabel(forecast?.month)} {forecast?.year || ''}
              </Text>
            </View>
          </View>
          {manager ? (
            <View style={styles.headerRight}>
              <Pressable style={[styles.btnAccept, saving && styles.btnDisabled]} disabled={saving} onPress={() => changeStatus('reviewed')}>
                <Ionicons name="checkmark-circle-outline" size={14} color="#15803D" />
                <Text style={styles.btnAcceptText}>Accept</Text>
              </Pressable>
              <Pressable style={[styles.btnReject, saving && styles.btnDisabled]} disabled={saving} onPress={() => changeStatus('draft')}>
                <Ionicons name="close-circle-outline" size={14} color={colors.danger} />
                <Text style={styles.btnRejectText}>Reject</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        {loading ? (
          <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
        ) : error ? (
          <View style={styles.centered}>
            <Ionicons name="alert-circle-outline" size={32} color={colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.btnOutline} onPress={fetchForecast}>
              <Text style={styles.btnOutlineText}>Retry</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/* ── Summary cards ── */}
            <View style={styles.statsRow}>
              <StatCard icon="flag-outline" iconColor="#1D4ED8" iconBg="#EFF6FF" label="Target Value" value={fmtCurrency(summary.targetValue, currency)} sub={`${fmtNumber(summary.targetUnits)} units`} />
              <StatCard icon="trending-up-outline" iconColor="#15803D" iconBg="#F0FDF4" label="Forecasted Value" value={fmtCurrency(summary.forecastValue, currency)} sub={`${fmtNumber(summary.forecastUnits)} units`} />
              <StatCard icon="alert-circle-outline" iconColor="#DC2626" iconBg="#FEF2F2" label="Deficit Value" value={fmtCurrency(summary.deficitValue, currency)} sub={`${fmtNumber(summary.deficitUnits)} units`} />
              <StatCard icon="speedometer-outline" iconColor="#7C3AED" iconBg="#F5F3FF" label="Coverage" value={`${fmtNumber(summary.coverage)}%`} />
            </View>

            {/* ── Overall progress ── */}
            <View style={styles.progressCard}>
              <View style={styles.progressHeader}>
                <Text style={styles.cardTitle}>Portfolio Progress</Text>
                <View style={[styles.badge, { backgroundColor: summaryState.bg }]}>
                  <Text style={[styles.badgeText, { color: summaryState.text }]}>
                    {summary.coverage > 100 ? 'Over Target' : summaryState.label}
                  </Text>
                </View>
              </View>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { backgroundColor: summaryState.bar, width: `${Math.min(summary.coverage, 100)}%` }]} />
              </View>
            </View>

            {/* ── Products ── */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Products</Text>
                <Text style={styles.cardMeta}>{items.length} product{items.length === 1 ? '' : 's'}</Text>
              </View>

              {items.length === 0 ? (
                <Text style={styles.emptyText}>No target found for this month.</Text>
              ) : items.map((item) => {
                const productId = getItemProductId(item) || getItemProductName(item);
                const expanded = expandedProductId === productId;
                const itemCoverage = getCoverage(item);
                const nickname = getItemProductNickname(item);
                const channels = getItemChannels(item);
                const itemState = coverageState(itemCoverage);

                return (
                  <View key={productId} style={styles.productBlock}>
                    <Pressable style={styles.productRow} onPress={() => setExpandedProductId(expanded ? '' : productId)}>
                      <View style={styles.productNameWrap}>
                        <Text style={styles.productName} numberOfLines={1}>{getItemProductName(item)}</Text>
                        {nickname ? <Text style={styles.productNick} numberOfLines={1}>{nickname}</Text> : null}
                      </View>
                      <Text style={styles.productMetric}>{fmtNumber(getTargetUnits(item))} u</Text>
                      <Text style={styles.productMetric}>{fmtCurrency(getTargetValue(item), currency)}</Text>
                      <Text style={styles.productMetric}>{fmtCurrency(getForecastValue(item), currency)}</Text>
                      <Text style={styles.productMetric}>{fmtCurrency(getDeficitValue(item), currency)}</Text>
                      <View style={styles.productCoverage}>
                        <CoverageBadge coverage={itemCoverage} />
                      </View>
                      <View style={styles.productBarWrap}>
                        <View style={styles.coverageTrack}>
                          <View style={[styles.coverageFill, { backgroundColor: itemState.bar, width: `${Math.min(itemCoverage, 100)}%` }]} />
                        </View>
                      </View>
                      <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
                    </Pressable>

                    {expanded ? (
                      <View style={styles.channelList}>
                        {channels.map((channel) => {
                          const channelCoverage = getCoverage(channel);
                          const rows = getChannelAccountForecasts(channel);
                          return (
                            <View key={getChannelId(channel) || getChannelName(channel)} style={styles.channelBlock}>
                              <View style={styles.channelHeader}>
                                <Text style={styles.channelName}>{getChannelName(channel)}</Text>
                                <CoverageBadge coverage={channelCoverage} />
                              </View>
                              <View style={styles.channelMetrics}>
                                <Text style={styles.channelMetric}>Target: {fmtNumber(getTargetUnits(channel))} u / {fmtCurrency(getTargetValue(channel), currency)}</Text>
                                <Text style={styles.channelMetric}>Forecast: {fmtNumber(getForecastUnits(channel))} u / {fmtCurrency(getForecastValue(channel), currency)}</Text>
                                <Text style={styles.channelMetric}>Deficit: {fmtNumber(getDeficitUnits(channel))} u / {fmtCurrency(getDeficitValue(channel), currency)}</Text>
                              </View>
                              {rows.length ? (
                                <View>
                                  <View style={styles.accHead}>
                                    <Text style={[styles.accTh, { flex: 2 }]}>Account</Text>
                                    <Text style={[styles.accTh, { width: 60 }]}>Type</Text>
                                    <Text style={[styles.accTh, { width: 80 }]}>Qty</Text>
                                    <Text style={[styles.accTh, { width: 100 }]}>Value</Text>
                                    <Text style={[styles.accTh, { width: 80 }]}>Status</Text>
                                    <Text style={[styles.accTh, { flex: 2 }]}>Notes</Text>
                                  </View>
                                  {rows.map((row) => (
                                    <View key={getId(row) || getAccountForecastName(row)} style={styles.accRow}>
                                      <Text style={[styles.accTd, { flex: 2, fontWeight: '600' }]} numberOfLines={1}>{getAccountForecastName(row)}</Text>
                                      <Text style={[styles.accTd, { width: 60 }]}>{row.inputType === 'value' ? 'Value' : 'Units'}</Text>
                                      <Text style={[styles.accTd, { width: 80 }]}>{fmtNumber(getAccountForecastQuantity(row))}</Text>
                                      <Text style={[styles.accTd, { width: 100 }]}>{fmtCurrency(getAccountForecastValue(row), currency)}</Text>
                                      <Text style={[styles.accTd, { width: 80, textTransform: 'capitalize' }]}>{getAccountForecastStatus(row)}</Text>
                                      <Text style={[styles.accTd, { flex: 2 }]} numberOfLines={1}>{row.notes || '—'}</Text>
                                    </View>
                                  ))}
                                </View>
                              ) : (
                                <Text style={styles.emptyText}>No forecast added yet.</Text>
                              )}
                            </View>
                          );
                        })}
                        {!channels.length ? <Text style={styles.emptyText}>No channels found for this product.</Text> : null}
                      </View>
                    ) : null}
                  </View>
                );
              })}
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
    justifyContent: 'space-between', flexWrap: 'wrap', gap: 12,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: {
    width: 34, height: 34, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pageTitle: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  pageSubtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  btnAccept: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#86EFAC',
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
  },
  btnAcceptText: { fontSize: 12, fontWeight: '700', color: '#15803D' },
  btnReject: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FCA5A5',
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
  },
  btnRejectText: { fontSize: 12, fontWeight: '700', color: colors.danger },
  btnDisabled: { opacity: 0.5 },

  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard: {
    flex: 1, minWidth: 150, flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, padding: 16, ...shadow,
  },
  statIcon: { width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  statBody: { flex: 1 },
  statLabel: { fontSize: 11, color: colors.textSecondary, fontWeight: '600', marginBottom: 3 },
  statValue: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  statSub: { fontSize: 11, color: colors.textMuted, marginTop: 2 },

  progressCard: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, padding: 16, gap: 10, ...shadow,
  },
  progressHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progressTrack: { height: 8, backgroundColor: colors.border + '90', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: 8, borderRadius: 4 },

  card: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, padding: 16, gap: 10, ...shadow,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontSize: 14, fontWeight: '800', color: colors.textPrimary },
  cardMeta: { fontSize: 12, color: colors.textMuted },
  emptyText: { fontSize: 13, color: colors.textMuted, textAlign: 'center', paddingVertical: 12 },

  productBlock: { borderBottomWidth: 1, borderBottomColor: colors.border },
  productRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  productNameWrap: { flex: 2, minWidth: 140 },
  productName: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  productNick: { fontSize: 11, color: colors.textMuted, marginTop: 1 },
  productMetric: { width: 95, fontSize: 12, color: colors.textPrimary },
  productCoverage: { width: 70 },
  productBarWrap: { flex: 1, minWidth: 80 },
  coverageTrack: { height: 5, backgroundColor: colors.border + '90', borderRadius: 3, overflow: 'hidden' },
  coverageFill: { height: 5, borderRadius: 3 },

  channelList: { paddingBottom: 12, gap: 10 },
  channelBlock: {
    backgroundColor: colors.surfaceSoft, borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, padding: 12, gap: 8,
  },
  channelHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  channelName: { fontSize: 13, fontWeight: '800', color: colors.textPrimary },
  channelMetrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  channelMetric: { fontSize: 12, color: colors.textSecondary },

  accHead: { flexDirection: 'row', gap: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  accTh: { fontSize: 10, fontWeight: '800', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.3 },
  accRow: { flexDirection: 'row', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border + '70', alignItems: 'center' },
  accTd: { fontSize: 12, color: colors.textPrimary },

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
