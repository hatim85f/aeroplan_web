import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AppShell from '../../components/AppShell';
import { colors } from '../../constants/colors';
import { globalWidth } from '../../constants/globalWidth';
import { getMyAchievement, getTeamAchievement } from '../../store/achievements/achievementActions';

const isManager = (role) =>
  ['admin', 'manager', 'senior_manager'].includes(String(role).toLowerCase());

const THIS_YEAR = new Date().getFullYear();
const THIS_MONTH = new Date().getMonth() + 1;

const shadow = { shadowColor: '#0B2B66', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } };
const PAD = globalWidth('1.2%');

const MONTH_OPTIONS = [
  { label: 'January', value: '1' }, { label: 'February', value: '2' }, { label: 'March', value: '3' },
  { label: 'April', value: '4' }, { label: 'May', value: '5' }, { label: 'June', value: '6' },
  { label: 'July', value: '7' }, { label: 'August', value: '8' }, { label: 'September', value: '9' },
  { label: 'October', value: '10' }, { label: 'November', value: '11' }, { label: 'December', value: '12' },
];

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const yearOptions = () => [THIS_YEAR - 1, THIS_YEAR, THIS_YEAR + 1].map((y) => ({ label: String(y), value: String(y) }));

const fmtN = (value) => Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
const fmtUSD = (value) => `$${Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
const fmtPct = (value) => `${Number(value || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}%`;

// Achievement states: <70 Below Target, 70–99 On Track, 100–110 Achieved, >110 Over Achieved.
const achievementState = (pct) => {
  const value = Number(pct) || 0;
  if (value > 110) return { bg: '#F5F3FF', text: '#7C3AED', bar: '#7C3AED', label: 'Over Achieved' };
  if (value >= 100) return { bg: '#DCFCE7', text: '#15803D', bar: '#16A34A', label: 'Achieved' };
  if (value >= 70) return { bg: '#EFF6FF', text: '#1D4ED8', bar: '#1D4ED8', label: 'On Track' };
  if (value > 0) return { bg: '#FEF2F2', text: '#DC2626', bar: '#EF4444', label: 'Below Target' };
  return { bg: '#F1F5F9', text: '#64748B', bar: '#CBD5E1', label: 'No Sales' };
};

function StatCard({ icon, iconColor, iconBg, label, value, sub }) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: iconBg }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <View style={styles.statBody}>
        <Text style={styles.statLabel}>{label}</Text>
        <Text style={styles.statValue}>{value ?? '—'}</Text>
        {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
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

function AchievementBadge({ pct }) {
  const state = achievementState(pct);
  return (
    <View style={[styles.badge, { backgroundColor: state.bg }]}>
      <Text style={[styles.badgeText, { color: state.text }]}>{state.label}</Text>
    </View>
  );
}

function PctText({ value }) {
  const state = achievementState(value);
  return <Text style={[styles.pctText, { color: state.text }]}>{fmtPct(value)}</Text>;
}

function ChannelPeriod({ label, pct, sales, target, gap, salesUnits, targetUnits, unitsPct }) {
  const state = achievementState(pct);
  return (
    <View style={styles.period}>
      <View style={styles.periodHeader}>
        <Text style={styles.periodLabel}>{label}</Text>
        <Text style={[styles.periodPct, { color: state.text }]}>{fmtPct(pct)}</Text>
      </View>
      <View style={styles.periodTrack}>
        <View style={[styles.periodFill, { backgroundColor: state.bar, width: `${Math.min(Number(pct) || 0, 100)}%` }]} />
      </View>
      <View style={styles.kvRow}>
        <Text style={styles.kvLabel}>Sales</Text>
        <Text style={styles.kvValue}>{fmtUSD(sales)}</Text>
      </View>
      <View style={styles.kvRow}>
        <Text style={styles.kvLabel}>Target</Text>
        <Text style={styles.kvValue}>{fmtUSD(target)}</Text>
      </View>
      <View style={styles.kvRow}>
        <Text style={styles.kvLabel}>Gap</Text>
        <Text style={[styles.kvValue, { color: Number(gap) > 0 ? '#DC2626' : '#15803D' }]}>{fmtUSD(gap)}</Text>
      </View>
      <View style={styles.kvRow}>
        <Text style={styles.kvLabel}>Units</Text>
        <Text style={styles.kvValue}>{fmtN(salesUnits)} / {fmtN(targetUnits)} ({fmtPct(unitsPct)})</Text>
      </View>
    </View>
  );
}

function ProgressLine({ label, pct, target, sales }) {
  const state = achievementState(pct);
  return (
    <View style={styles.progressLine}>
      <View style={styles.progressHeader}>
        <Text style={styles.progressLabel}>{label}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={styles.progressMeta}>{fmtUSD(sales)} of {fmtUSD(target)}</Text>
          <Text style={[styles.progressPct, { color: state.text }]}>{fmtPct(pct)}</Text>
          <AchievementBadge pct={pct} />
        </View>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { backgroundColor: state.bar, width: `${Math.min(Number(pct) || 0, 100)}%` }]} />
      </View>
    </View>
  );
}

export default function AchievementScreen({ navigation, userDetails, appMetadata, onSignOut }) {
  const user = userDetails?.user || userDetails?.data?.user || userDetails || {};
  const token = userDetails?.token || userDetails?.data?.token || '';
  const manager = isManager(user.role || '');

  const [year, setYear] = useState(String(THIS_YEAR));
  const [month, setMonth] = useState(String(THIS_MONTH));
  const [repFilter, setRepFilter] = useState('');
  const [repOptions, setRepOptions] = useState([{ label: 'All Reps', value: '' }]);
  const [channelFilters, setChannelFilters] = useState([]);
  const [channelOptions, setChannelOptions] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedProductId, setExpandedProductId] = useState('');

  const fetchAchievement = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      setError('');
      const params = { year, month };
      if (manager && repFilter) params.userId = repFilter;
      if (channelFilters.length) params.channelIds = channelFilters.join(',');
      const result = manager
        ? await getTeamAchievement(token, params)
        : await getMyAchievement(token, params);
      setData(result || null);
      if (manager && !repFilter && Array.isArray(result?.reps)) {
        setRepOptions([
          { label: 'All Reps', value: '' },
          ...result.reps.map((rep) => ({ label: rep.userName, value: String(rep.userId) })),
        ]);
      }
      if (!channelFilters.length && Array.isArray(result?.products)) {
        const byId = new Map();
        result.products.forEach((product) => (product.channels || []).forEach((channel) => {
          byId.set(String(channel.channelId), channel.channelName || 'Channel');
        }));
        setChannelOptions([...byId.entries()].map(([value, label]) => ({ value, label }))
          .sort((left, right) => left.label.localeCompare(right.label)));
      }
    } catch (err) {
      setData(null);
      setError(err.message || 'Failed to load achievement.');
    } finally {
      setLoading(false);
    }
  }, [channelFilters, manager, month, repFilter, token, year]);

  useEffect(() => { fetchAchievement(); }, [fetchAchievement]);

  const toggleChannel = (value) => {
    setChannelFilters((current) => (
      current.includes(value) ? current.filter((entry) => entry !== value) : [...current, value]
    ));
  };

  const cards = data?.summaryCards || {};
  const products = useMemo(() => data?.products || [], [data]);
  const reps = useMemo(() => data?.reps || [], [data]);
  const monthName = MONTH_NAMES[Number(month) - 1];
  const ytdLabel = `Jan–${monthName}`;

  return (
    <AppShell navigation={navigation} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} activeRoute="Achievement">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* ── Header ── */}
        <View style={styles.pageHeader}>
          <View>
            <Text style={styles.pageTitle}>Achievement</Text>
            <Text style={styles.pageSubtitle}>Actual sales vs target — {monthName} {year} and YTD ({ytdLabel})</Text>
          </View>
          <View style={styles.headerRight}>
            <FilterItem icon="calendar-outline" label="Year" options={yearOptions()} value={year} onChange={setYear} style={{ minWidth: 90 }} zIndex={31} />
            <FilterItem icon="calendar-outline" label="Month" options={MONTH_OPTIONS} value={month} onChange={setMonth} style={{ minWidth: 110 }} zIndex={30} />
            {manager ? (
              <FilterItem icon="person-outline" label="Medical Rep" options={repOptions} value={repFilter} onChange={setRepFilter} style={{ minWidth: 140 }} zIndex={29} />
            ) : null}
          </View>
        </View>

        {/* ── Sales channel filter ── */}
        {channelOptions.length ? (
          <View style={styles.channelFilterBar}>
            <Pressable
              style={[styles.chip, !channelFilters.length && styles.chipActive]}
              onPress={() => setChannelFilters([])}
            >
              <Text style={[styles.chipText, !channelFilters.length && styles.chipTextActive]}>All Channels</Text>
            </Pressable>
            {channelOptions.map((option) => {
              const selected = channelFilters.includes(option.value);
              return (
                <Pressable key={option.value} style={[styles.chip, selected && styles.chipActive]} onPress={() => toggleChannel(option.value)}>
                  <Text style={[styles.chipText, selected && styles.chipTextActive]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        {loading ? (
          <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
        ) : error ? (
          <View style={styles.centered}>
            <Ionicons name="alert-circle-outline" size={32} color={colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.btnOutline} onPress={fetchAchievement}>
              <Text style={styles.btnOutlineText}>Retry</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/* ── Monthly cards ── */}
            <Text style={styles.sectionLabel}>{monthName} {year}</Text>
            <View style={styles.statsRow}>
              <StatCard icon="flag-outline" iconColor="#1D4ED8" iconBg="#EFF6FF" label="Monthly Target" value={fmtUSD(cards.monthlyTargetValue)} sub={`${fmtN(cards.monthlyTargetUnits)} units`} />
              <StatCard icon="cash-outline" iconColor="#15803D" iconBg="#F0FDF4" label="Monthly Sales" value={fmtUSD(cards.monthlySalesValue)} sub={`${fmtN(cards.monthlySalesUnits)} units`} />
              <StatCard icon="speedometer-outline" iconColor="#7C3AED" iconBg="#F5F3FF" label="Monthly Achievement" value={fmtPct(cards.monthlyAchievementPercentage)} sub={`Units ${fmtPct(cards.monthlyUnitsAchievementPercentage)}`} />
              <StatCard icon="trending-down-outline" iconColor="#DC2626" iconBg="#FEF2F2" label="Monthly Gap" value={fmtUSD(cards.monthlyGapValue)} sub={`${fmtN(cards.monthlyGapUnits)} units`} />
            </View>

            {/* ── YTD cards ── */}
            <Text style={styles.sectionLabel}>YTD ({ytdLabel})</Text>
            <View style={styles.statsRow}>
              <StatCard icon="flag-outline" iconColor="#1D4ED8" iconBg="#EFF6FF" label="YTD Target" value={fmtUSD(cards.ytdTargetValue)} sub={`${fmtN(cards.ytdTargetUnits)} units`} />
              <StatCard icon="cash-outline" iconColor="#15803D" iconBg="#F0FDF4" label="YTD Sales" value={fmtUSD(cards.ytdSalesValue)} sub={`${fmtN(cards.ytdSalesUnits)} units`} />
              <StatCard icon="speedometer-outline" iconColor="#7C3AED" iconBg="#F5F3FF" label="YTD Achievement" value={fmtPct(cards.ytdAchievementPercentage)} sub={`Units ${fmtPct(cards.ytdUnitsAchievementPercentage)}`} />
              <StatCard icon="trending-down-outline" iconColor="#DC2626" iconBg="#FEF2F2" label="YTD Gap" value={fmtUSD(cards.ytdGapValue)} sub={`${fmtN(cards.ytdGapUnits)} units`} />
            </View>

            {/* ── Total progress ── */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Total Achievement</Text>
              <ProgressLine label={`${monthName} ${year}`} pct={cards.monthlyAchievementPercentage} target={cards.monthlyTargetValue} sales={cards.monthlySalesValue} />
              <ProgressLine label={`YTD (${ytdLabel})`} pct={cards.ytdAchievementPercentage} target={cards.ytdTargetValue} sales={cards.ytdSalesValue} />
            </View>

            {/* ── Product table ── */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Achievement by Product</Text>
                <Text style={styles.cardMeta}>{products.length} product{products.length === 1 ? '' : 's'}</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ minWidth: '100%' }}>
                  <View style={styles.tblHead}>
                    <Text style={[styles.tblTh, styles.colName]}>PRODUCT</Text>
                    <Text style={[styles.tblThNum, styles.colSm]}>M. TGT UNITS</Text>
                    <Text style={[styles.tblThNum, styles.colSm]}>M. SALES UNITS</Text>
                    <Text style={[styles.tblThNum, styles.colSm]}>M. UNITS %</Text>
                    <Text style={[styles.tblThNum, styles.colNum]}>M. TARGET</Text>
                    <Text style={[styles.tblThNum, styles.colNum]}>M. SALES</Text>
                    <Text style={[styles.tblThNum, styles.colSm]}>M. ACHV %</Text>
                    <Text style={[styles.tblThNum, styles.colNum]}>M. GAP</Text>
                    <Text style={[styles.tblThNum, styles.colNum]}>YTD TARGET</Text>
                    <Text style={[styles.tblThNum, styles.colNum]}>YTD SALES</Text>
                    <Text style={[styles.tblThNum, styles.colSm]}>YTD %</Text>
                    <Text style={[styles.tblThNum, styles.colNum]}>YTD GAP</Text>
                    <Text style={[styles.tblTh, { width: 36 }]} />
                  </View>
                  {!products.length ? (
                    <View style={styles.tblEmpty}><Text style={styles.emptyText}>No target found for this month.</Text></View>
                  ) : products.map((product, index) => {
                    const productId = String(product.productId);
                    const expanded = expandedProductId === productId;
                    return (
                      <View key={productId}>
                        <Pressable
                          style={[styles.tblRow, index % 2 === 1 && styles.tblRowAlt]}
                          onPress={() => setExpandedProductId(expanded ? '' : productId)}
                        >
                          <View style={styles.colName}>
                            <Text style={styles.tblTdStrong} numberOfLines={1}>{product.productNickname || product.productName}</Text>
                            <AchievementBadge pct={product.ytdAchievementPercentage} />
                          </View>
                          <Text style={[styles.tblTdNum, styles.colSm]}>{fmtN(product.monthlyTargetUnits)}</Text>
                          <Text style={[styles.tblTdNum, styles.colSm]}>{fmtN(product.monthlySalesUnits)}</Text>
                          <View style={[styles.colSm, styles.cellRight]}><PctText value={product.monthlyUnitsAchievementPercentage} /></View>
                          <Text style={[styles.tblTdNum, styles.colNum]}>{fmtUSD(product.monthlyTargetValue)}</Text>
                          <Text style={[styles.tblTdNum, styles.colNum]}>{fmtUSD(product.monthlySalesValue)}</Text>
                          <View style={[styles.colSm, styles.cellRight]}><PctText value={product.monthlyAchievementPercentage} /></View>
                          <Text style={[styles.tblTdNum, styles.colNum]}>{fmtUSD(product.monthlyGapValue)}</Text>
                          <Text style={[styles.tblTdNum, styles.colNum]}>{fmtUSD(product.ytdTargetValue)}</Text>
                          <Text style={[styles.tblTdNum, styles.colNum]}>{fmtUSD(product.ytdSalesValue)}</Text>
                          <View style={[styles.colSm, styles.cellRight]}><PctText value={product.ytdAchievementPercentage} /></View>
                          <Text style={[styles.tblTdNum, styles.colNum]}>{fmtUSD(product.ytdGapValue)}</Text>
                          <View style={{ width: 36, alignItems: 'center' }}>
                            <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={15} color={colors.textMuted} />
                          </View>
                        </Pressable>

                        {expanded ? (
                          <View style={styles.channelWrap}>
                            {(product.channels || []).map((channel) => (
                              <View key={String(channel.channelId)} style={styles.channelBlock}>
                                <View style={styles.channelHeader}>
                                  <Text style={styles.channelName}>{channel.channelName}</Text>
                                  <View style={styles.basisChip}>
                                    <Text style={styles.basisChipText}>{channel.targetValueBasis} · {channel.targetCurrency}</Text>
                                  </View>
                                  <View style={{ flex: 1 }} />
                                  <AchievementBadge pct={channel.ytdAchievementPercentage} />
                                </View>
                                <View style={styles.periodRow}>
                                  <ChannelPeriod
                                    label="Monthly"
                                    pct={channel.monthlyAchievementPercentage}
                                    sales={channel.monthlySalesValue}
                                    target={channel.monthlyTargetValue}
                                    gap={channel.monthlyGapValue}
                                    salesUnits={channel.monthlySalesUnits}
                                    targetUnits={channel.monthlyTargetUnits}
                                    unitsPct={channel.monthlyUnitsAchievementPercentage}
                                  />
                                  <View style={styles.periodDivider} />
                                  <ChannelPeriod
                                    label="YTD"
                                    pct={channel.ytdAchievementPercentage}
                                    sales={channel.ytdSalesValue}
                                    target={channel.ytdTargetValue}
                                    gap={channel.ytdGapValue}
                                    salesUnits={channel.ytdSalesUnits}
                                    targetUnits={channel.ytdTargetUnits}
                                    unitsPct={channel.ytdUnitsAchievementPercentage}
                                  />
                                </View>
                              </View>
                            ))}
                          </View>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              </ScrollView>
            </View>

            {/* ── Rep comparison (manager) ── */}
            {manager && !repFilter ? (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>Rep Comparison</Text>
                  <Text style={styles.cardMeta}>{reps.length} rep{reps.length === 1 ? '' : 's'}</Text>
                </View>
                {Number(data?.unattributed?.ytdSalesValue) > 0 ? (
                  <View style={styles.unattributedNote}>
                    <Ionicons name="information-circle-outline" size={14} color="#B45309" />
                    <Text style={styles.unattributedNoteText}>
                      {fmtUSD(data.unattributed.ytdSalesValue)} of YTD sales ({fmtUSD(data.unattributed.monthlySalesValue)} this month) are in the team totals but not credited to any rep — add account coverage in Rep Coverage to attribute them.
                    </Text>
                  </View>
                ) : null}
                <View style={styles.tblHead}>
                  <Text style={[styles.tblTh, styles.colName]}>REP</Text>
                  <Text style={[styles.tblThNum, styles.colNum]}>M. TARGET</Text>
                  <Text style={[styles.tblThNum, styles.colNum]}>M. SALES</Text>
                  <Text style={[styles.tblThNum, styles.colSm]}>M. ACHV %</Text>
                  <Text style={[styles.tblThNum, styles.colNum]}>M. GAP</Text>
                  <Text style={[styles.tblThNum, styles.colNum]}>YTD TARGET</Text>
                  <Text style={[styles.tblThNum, styles.colNum]}>YTD SALES</Text>
                  <Text style={[styles.tblThNum, styles.colSm]}>YTD %</Text>
                  <Text style={[styles.tblThNum, styles.colNum]}>YTD GAP</Text>
                  <Text style={[styles.tblTh, { width: 110 }]}>STATUS</Text>
                </View>
                {!reps.length ? (
                  <View style={styles.tblEmpty}><Text style={styles.emptyText}>No reps with targets for this period.</Text></View>
                ) : reps.map((rep, index) => (
                  <View key={String(rep.userId)} style={[styles.tblRow, index % 2 === 1 && styles.tblRowAlt]}>
                    <Text style={[styles.tblTdStrong, styles.colName]} numberOfLines={1}>{rep.userName}</Text>
                    <Text style={[styles.tblTdNum, styles.colNum]}>{fmtUSD(rep.monthlyTargetValue)}</Text>
                    <Text style={[styles.tblTdNum, styles.colNum]}>{fmtUSD(rep.monthlySalesValue)}</Text>
                    <View style={[styles.colSm, styles.cellRight]}><PctText value={rep.monthlyAchievementPercentage} /></View>
                    <Text style={[styles.tblTdNum, styles.colNum]}>{fmtUSD(rep.monthlyGapValue)}</Text>
                    <Text style={[styles.tblTdNum, styles.colNum]}>{fmtUSD(rep.ytdTargetValue)}</Text>
                    <Text style={[styles.tblTdNum, styles.colNum]}>{fmtUSD(rep.ytdSalesValue)}</Text>
                    <View style={[styles.colSm, styles.cellRight]}><PctText value={rep.ytdAchievementPercentage} /></View>
                    <Text style={[styles.tblTdNum, styles.colNum]}>{fmtUSD(rep.ytdGapValue)}</Text>
                    <View style={{ width: 110 }}><AchievementBadge pct={rep.ytdAchievementPercentage} /></View>
                  </View>
                ))}
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: PAD, gap: 14, paddingBottom: 48 },

  pageHeader: {
    flexDirection: 'row', alignItems: 'flex-start',
    justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, zIndex: 30,
  },
  pageTitle: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  pageSubtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },

  sectionLabel: { fontSize: 11, fontWeight: '800', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },

  channelFilterBar: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  chip: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 16,
    paddingHorizontal: 12, paddingVertical: 6, backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 12, color: colors.textPrimary, fontWeight: '600' },
  chipTextActive: { color: '#fff' },

  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard: {
    flex: 1, minWidth: 150, flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, padding: 14, ...shadow,
  },
  statIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  statBody: { flex: 1 },
  statLabel: { fontSize: 11, color: colors.textSecondary, fontWeight: '600', marginBottom: 2 },
  statValue: { fontSize: 18, fontWeight: '800', color: colors.textPrimary },
  statSub: { fontSize: 10, color: colors.textMuted, marginTop: 1 },

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
    borderRadius: 12, padding: 16, gap: 12, ...shadow,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontSize: 14, fontWeight: '800', color: colors.textPrimary },
  cardMeta: { fontSize: 12, color: colors.textMuted },
  emptyText: { fontSize: 13, color: colors.textMuted, textAlign: 'center', paddingVertical: 12 },

  progressLine: { gap: 6 },
  progressHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 },
  progressLabel: { fontSize: 12, fontWeight: '700', color: colors.textPrimary },
  progressMeta: { fontSize: 11, color: colors.textMuted },
  progressPct: { fontSize: 13, fontWeight: '800' },
  progressTrack: { height: 9, backgroundColor: colors.border + '90', borderRadius: 5, overflow: 'hidden' },
  progressFill: { height: 9, borderRadius: 5 },

  /* Table */
  colName: { flex: 1.9, minWidth: 150, gap: 4 },
  colNum: { flex: 1, minWidth: 88 },
  colSm: { flex: 0.8, minWidth: 72 },
  cellRight: { alignItems: 'flex-end' },

  tblHead: {
    flexDirection: 'row', backgroundColor: colors.primary + '0C',
    paddingVertical: 9, paddingHorizontal: 12, borderRadius: 6, gap: 14, alignItems: 'center',
  },
  tblTh: { fontSize: 10, fontWeight: '800', color: colors.primary },
  tblThNum: { fontSize: 10, fontWeight: '800', color: colors.primary, textAlign: 'right' },
  tblRow: {
    flexDirection: 'row', paddingVertical: 11, paddingHorizontal: 12, gap: 14,
    borderBottomWidth: 1, borderBottomColor: colors.border, alignItems: 'center',
  },
  tblRowAlt: { backgroundColor: colors.backgroundColor + '70' },
  tblTdNum: { fontSize: 12, color: colors.textPrimary, textAlign: 'right' },
  tblTdStrong: { fontSize: 12, color: colors.textPrimary, fontWeight: '700' },
  tblEmpty: { padding: 24, alignItems: 'center' },
  pctText: { fontSize: 12, fontWeight: '800' },

  channelWrap: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 12,
    paddingVertical: 12, paddingHorizontal: 12,
    backgroundColor: colors.surfaceSoft, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  channelBlock: {
    flex: 1, minWidth: 420,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, padding: 14, gap: 12, ...shadow,
  },
  channelHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  channelName: { fontSize: 14, fontWeight: '800', color: colors.textPrimary },
  basisChip: {
    backgroundColor: colors.backgroundColor, borderWidth: 1, borderColor: colors.border,
    borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2,
  },
  basisChipText: { fontSize: 10, fontWeight: '700', color: colors.textMuted },

  periodRow: { flexDirection: 'row', gap: 14 },
  periodDivider: { width: 1, backgroundColor: colors.border },
  period: { flex: 1, gap: 7 },
  periodHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  periodLabel: { fontSize: 10, fontWeight: '800', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  periodPct: { fontSize: 17, fontWeight: '800' },
  periodTrack: { height: 7, backgroundColor: colors.border + '90', borderRadius: 4, overflow: 'hidden' },
  periodFill: { height: 7, borderRadius: 4 },
  kvRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  kvLabel: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },
  kvValue: { fontSize: 12, color: colors.textPrimary, fontWeight: '700' },

  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, alignSelf: 'flex-start' },
  badgeText: { fontSize: 10, fontWeight: '700' },
  unattributedNote: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A',
    borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8,
  },
  unattributedNoteText: { flex: 1, fontSize: 12, color: '#B45309', fontWeight: '600' },

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
