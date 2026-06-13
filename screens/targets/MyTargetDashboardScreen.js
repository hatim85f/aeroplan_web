import React, { useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AppShell from '../../components/AppShell';
import { colors } from '../../constants/colors';
import { globalHeight, globalWidth } from '../../constants/globalWidth';
import {
  listTargetAssignments,
  getTargetMonthlyBreakdown,
} from '../../store/targets/targetAssignmentActions';
import { listTargetPhasing } from '../../store/targets/targetPhasingActions';

const THIS_MONTH = new Date().getMonth() + 1;
const THIS_YEAR  = new Date().getFullYear();

const TARGET_BASIS_LABELS = {
  cifUsd:       'CIF USD',
  wholesaleAed: 'Wholesale AED',
  retailAed:    'Retail AED',
};

const STATUS_STYLE = {
  active:   { bg: '#DCFCE7', text: '#15803D' },
  inactive: { bg: '#F1F5F9', text: '#64748B' },
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

function TargetCard({ assignment, onPress, onViewBreakdown }) {
  const product  = assignment.productId || {};
  const channel  = assignment.channelId || {};
  const pName    = product.productName || product.name || assignment.productName || '—';
  const pNick    = product.productNickname || product.nickname || assignment.productNickname || '';
  const chName   = channel.channelName || channel.channelKey || assignment.channelName || '—';
  const basis    = assignment.targetValueBasis || channel.targetValueBasis || '';
  const currency = assignment.currency || assignment.targetCurrency || 'USD';
  const status   = assignment.status || 'active';

  const fmt = (n) => n != null ? Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 }) : '—';
  const sym = currency === 'AED' ? 'AED ' : '$';

  return (
    <Pressable style={styles.targetCard} onPress={onPress}>
      <View style={styles.targetCardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.targetProductName}>{pName}</Text>
          {pNick ? <Text style={styles.targetProductNick}>{pNick}</Text> : null}
        </View>
        <StatusBadge status={status} />
      </View>

      <View style={styles.targetMeta}>
        <View style={styles.targetMetaItem}>
          <Ionicons name="radio-button-on-outline" size={12} color={colors.textMuted} />
          <Text style={styles.targetMetaText}>{chName}</Text>
        </View>
        <View style={styles.targetMetaItem}>
          <Ionicons name="calendar-outline" size={12} color={colors.textMuted} />
          <Text style={styles.targetMetaText}>
            {assignment.startDate?.slice(0, 10)} → {assignment.endDate?.slice(0, 10)}
          </Text>
        </View>
        {basis ? (
          <View style={styles.targetMetaItem}>
            <Ionicons name="analytics-outline" size={12} color={colors.textMuted} />
            <Text style={styles.targetMetaText}>{TARGET_BASIS_LABELS[basis] || basis} / {currency}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.targetValues}>
        <View style={styles.targetValItem}>
          <Text style={styles.targetValLabel}>Target Units</Text>
          <Text style={styles.targetValNum}>{fmt(assignment.totalTargetUnits)}</Text>
        </View>
        <View style={styles.targetValDivider} />
        <View style={styles.targetValItem}>
          <Text style={styles.targetValLabel}>Target Value</Text>
          <Text style={styles.targetValNum}>{sym}{fmt(assignment.totalTargetValue)}</Text>
        </View>
      </View>

      <Pressable style={styles.breakdownBtn} onPress={onViewBreakdown}>
        <Ionicons name="bar-chart-outline" size={13} color={colors.primary} />
        <Text style={styles.breakdownBtnText}>View Monthly Breakdown</Text>
      </Pressable>
    </Pressable>
  );
}

function MonthlyBreakdownPanel({ assignment, phasings, onClose }) {
  const [selectedPhasingId, setSelectedPhasingId] = useState('');
  const [breakdown, setBreakdown] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const token = assignment._token || '';

  const currency  = assignment.currency || assignment.targetCurrency || 'USD';
  const sym       = currency === 'AED' ? 'AED ' : '$';

  const fetch = useCallback(async (pId) => {
    setLoading(true);
    setError('');
    try {
      const data = await assignment._fetchBreakdown(assignment._id || assignment.id, pId);
      setBreakdown(data);
    } catch (e) {
      setError(e.message || 'Failed to load breakdown');
    } finally {
      setLoading(false);
    }
  }, [assignment]);

  useEffect(() => {
    const def = phasings.find((p) => p.isDefault) || phasings[0];
    if (def) {
      setSelectedPhasingId(def._id || def.id || '');
      fetch(def._id || def.id || '');
    } else {
      fetch('');
    }
  }, []);

  const months = Array.isArray(breakdown?.months) ? breakdown.months : [];

  return (
    <View style={styles.breakdownPanel}>
      <View style={styles.breakdownPanelHeader}>
        <Text style={styles.breakdownPanelTitle}>Monthly Breakdown</Text>
        <Pressable onPress={onClose}>
          <Ionicons name="close" size={18} color={colors.textSecondary} />
        </Pressable>
      </View>

      {phasings.length > 0 && (
        <View style={styles.phasingSelect}>
          <Text style={styles.phasingSelectLabel}>Phasing:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {phasings.map((p) => {
              const pid = p._id || p.id || '';
              const sel = selectedPhasingId === pid;
              return (
                <Pressable
                  key={pid}
                  style={[styles.phasingPill, sel && styles.phasingPillActive]}
                  onPress={() => { setSelectedPhasingId(pid); fetch(pid); }}
                >
                  <Text style={[styles.phasingPillText, sel && styles.phasingPillTextActive]}>
                    {p.name || pid}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}

      {loading ? (
        <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 16 }} />
      ) : error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : months.length === 0 ? (
        <Text style={styles.emptyText}>No phasing data available. Select or create a phasing plan.</Text>
      ) : (
        <View style={styles.breakdownTable}>
          <View style={styles.breakdownTableHead}>
            {['Month', '%', 'Units', 'Value'].map((h) => (
              <Text key={h} style={[styles.breakdownTh, h === 'Month' && { flex: 2 }]}>{h}</Text>
            ))}
          </View>
          {months.map((m) => (
            <View
              key={m.month}
              style={[styles.breakdownRow, m.month === THIS_MONTH && styles.breakdownRowHighlight]}
            >
              <Text style={[styles.breakdownTd, { flex: 2, fontWeight: m.month === THIS_MONTH ? '800' : '600' }]}>
                {m.monthName || m.month}
                {m.month === THIS_MONTH ? ' ✦' : ''}
              </Text>
              <Text style={styles.breakdownTd}>{m.percentage}%</Text>
              <Text style={styles.breakdownTd}>{m.targetUnits != null ? Number(m.targetUnits).toLocaleString() : '—'}</Text>
              <Text style={styles.breakdownTd}>{m.targetValue != null ? `${sym}${Number(m.targetValue).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

export default function MyTargetDashboardScreen({ navigation, userDetails, appMetadata, onSignOut }) {
  const user  = userDetails?.user || userDetails?.data?.user || userDetails || {};
  const token = userDetails?.token || userDetails?.data?.token || '';
  const userId = user._id || user.id || user.userId || '';

  const [assignments, setAssignments] = useState([]);
  const [phasings, setPhasings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeBreakdown, setActiveBreakdown] = useState(null);
  const [year, setYear] = useState(String(THIS_YEAR));
  const [yearOpen, setYearOpen] = useState(false);

  const fetchBreakdown = useCallback(async (id, phasingId) => {
    return getTargetMonthlyBreakdown(token, id, phasingId);
  }, [token]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [aRes, pRes] = await Promise.all([
        listTargetAssignments(token, { year, userId }),
        listTargetPhasing(token, { year }),
      ]);
      const sorted = [...aRes.assignments].sort((a, b) => {
        const order = { active: 0, inactive: 1 };
        return (order[a.status] ?? 9) - (order[b.status] ?? 9);
      });
      setAssignments(sorted);
      setPhasings(pRes.phasings);
    } catch (e) {
      setError(e.message || 'Failed to load targets');
    } finally {
      setLoading(false);
    }
  }, [token, year, userId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const activeList   = assignments.filter((a) => a.status === 'active');
  const inactiveList = assignments.filter((a) => a.status !== 'active');

  const [showInactive, setShowInactive] = useState(false);

  const yearOpts = [THIS_YEAR - 1, THIS_YEAR, THIS_YEAR + 1].map((y) => String(y));

  return (
    <AppShell navigation={navigation} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} activeRoute="MyTargetDashboard">
      <View style={styles.pageHeader}>
        <View>
          <Text style={styles.pageTitle}>My Targets</Text>
          <Text style={styles.pageSubtitle}>Your assigned sales targets by product and channel</Text>
        </View>
        <View style={{ position: 'relative', zIndex: 10 }}>
          <Pressable style={styles.filterBtn} onPress={() => setYearOpen((v) => !v)}>
            <Text style={styles.filterBtnText}>{year}</Text>
            <Ionicons name={yearOpen ? 'chevron-up' : 'chevron-down'} size={12} color={colors.textSecondary} />
          </Pressable>
          {yearOpen && (
            <View style={styles.filterDropdown}>
              {yearOpts.map((y) => (
                <Pressable
                  key={y}
                  style={[styles.filterOpt, y === year && styles.filterOptActive]}
                  onPress={() => { setYear(y); setYearOpen(false); }}
                >
                  <Text style={[styles.filterOptText, y === year && styles.filterOptTextActive]}>{y}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.btnOutline} onPress={fetchAll}>
            <Text style={styles.btnOutlineText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

          {/* Active */}
          {activeList.length > 0 && (
            <View style={styles.group}>
              <View style={styles.groupHeader}>
                <View style={[styles.groupDot, { backgroundColor: '#15803D' }]} />
                <Text style={styles.groupTitle}>Active Targets ({activeList.length})</Text>
              </View>
              <View style={styles.cardGrid}>
                {activeList.map((a) => (
                  <TargetCard
                    key={a._id || a.id}
                    assignment={a}
                    onPress={() => navigation.navigate('TargetAssignmentDetails', { assignmentId: a._id || a.id })}
                    onViewBreakdown={() => setActiveBreakdown({
                      ...a,
                      _id: a._id || a.id,
                      _fetchBreakdown: fetchBreakdown,
                    })}
                  />
                ))}
              </View>
            </View>
          )}

          {/* Inactive collapsed */}
          {inactiveList.length > 0 && (
            <View style={styles.group}>
              <Pressable style={styles.groupHeader} onPress={() => setShowInactive((v) => !v)}>
                <View style={[styles.groupDot, { backgroundColor: '#94A3B8' }]} />
                <Text style={styles.groupTitle}>Inactive Targets ({inactiveList.length})</Text>
                <Ionicons name={showInactive ? 'chevron-up' : 'chevron-down'} size={14} color={colors.textMuted} style={{ marginLeft: 'auto' }} />
              </Pressable>
              {showInactive && (
                <View style={styles.cardGrid}>
                  {inactiveList.map((a) => (
                    <TargetCard
                      key={a._id || a.id}
                      assignment={a}
                      onPress={() => navigation.navigate('TargetAssignmentDetails', { assignmentId: a._id || a.id })}
                      onViewBreakdown={() => setActiveBreakdown({
                        ...a,
                        _id: a._id || a.id,
                        _fetchBreakdown: fetchBreakdown,
                      })}
                    />
                  ))}
                </View>
              )}
            </View>
          )}

          {assignments.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="flag-outline" size={48} color={colors.textMuted} />
              <Text style={styles.emptyStateTitle}>No Targets Found</Text>
              <Text style={styles.emptyStateText}>No target assignments found for {year}.</Text>
            </View>
          )}

        </ScrollView>
      )}

      {/* Monthly breakdown overlay */}
      {activeBreakdown && (
        <View style={styles.overlay}>
          <Pressable style={styles.overlayBg} onPress={() => setActiveBreakdown(null)} />
          <View style={styles.overlayPanel}>
            <MonthlyBreakdownPanel
              assignment={activeBreakdown}
              phasings={phasings}
              onClose={() => setActiveBreakdown(null)}
            />
          </View>
        </View>
      )}
    </AppShell>
  );
}

const shadow = { shadowColor: '#11224A', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 14, elevation: 3 };

const styles = StyleSheet.create({
  pageHeader: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    marginBottom: globalHeight('1.5%'), flexWrap: 'wrap', gap: 12,
  },
  pageTitle: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  pageSubtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },

  scroll: { paddingBottom: globalHeight('4%'), gap: 20 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 40 },

  group: { gap: 12 },
  groupHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 6,
  },
  groupDot: { width: 8, height: 8, borderRadius: 4 },
  groupTitle: { fontSize: 14, fontWeight: '800', color: colors.textPrimary },

  cardGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },

  targetCard: {
    flex: 1, minWidth: 280, maxWidth: 420,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, padding: 16, gap: 10, ...shadow,
  },
  targetCardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  targetProductName: { fontSize: 15, fontWeight: '800', color: colors.textPrimary },
  targetProductNick: { fontSize: 11, color: colors.textMuted, fontWeight: '700', marginTop: 2 },

  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '700' },

  targetMeta: { gap: 4 },
  targetMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  targetMetaText: { fontSize: 12, color: colors.textSecondary },

  targetValues: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.backgroundColor, borderRadius: 8, padding: 10,
  },
  targetValItem: { flex: 1, alignItems: 'center', gap: 2 },
  targetValDivider: { width: 1, height: 36, backgroundColor: colors.border },
  targetValLabel: { fontSize: 10, color: colors.textMuted, fontWeight: '600' },
  targetValNum: { fontSize: 16, fontWeight: '800', color: colors.textPrimary },

  breakdownBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 6,
  },
  breakdownBtnText: { fontSize: 12, color: colors.primary, fontWeight: '700' },

  emptyState: { alignItems: 'center', gap: 10, paddingVertical: 60 },
  emptyStateTitle: { fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  emptyStateText: { fontSize: 13, color: colors.textMuted },
  emptyText: { fontSize: 13, color: colors.textMuted, paddingVertical: 8 },
  errorText: { fontSize: 13, color: colors.danger },

  filterBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.surface,
  },
  filterBtnText: { fontSize: 13, color: colors.textPrimary, fontWeight: '600' },
  filterDropdown: {
    position: 'absolute', top: 40, right: 0, minWidth: 100,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 8, ...shadow, zIndex: 100,
  },
  filterOpt: { paddingHorizontal: 12, paddingVertical: 9 },
  filterOptActive: { backgroundColor: colors.primary + '15' },
  filterOptText: { fontSize: 13, color: colors.textPrimary },
  filterOptTextActive: { color: colors.primary, fontWeight: '700' },

  btnOutline: {
    borderWidth: 1, borderColor: colors.primary,
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8,
  },
  btnOutlineText: { color: colors.primary, fontSize: 13, fontWeight: '700' },

  // Breakdown overlay
  overlay: { ...StyleSheet.absoluteFillObject, zIndex: 200, flexDirection: 'row' },
  overlayBg: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },
  overlayPanel: {
    position: 'absolute', right: 0, top: 0, bottom: 0,
    width: '40%', minWidth: 340, maxWidth: 520,
    backgroundColor: colors.surface, ...shadow,
  },

  breakdownPanel: { flex: 1, padding: 20, gap: 14 },
  breakdownPanelHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  breakdownPanelTitle: { fontSize: 16, fontWeight: '800', color: colors.textPrimary },

  phasingSelect: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  phasingSelectLabel: { fontSize: 12, color: colors.textSecondary, fontWeight: '700' },
  phasingPill: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  phasingPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  phasingPillText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  phasingPillTextActive: { color: colors.white, fontWeight: '700' },

  breakdownTable: { gap: 0 },
  breakdownTableHead: {
    flexDirection: 'row', backgroundColor: colors.backgroundColor,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6,
  },
  breakdownTh: { flex: 1, fontSize: 11, fontWeight: '800', color: colors.textSecondary },
  breakdownRow: {
    flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  breakdownRowHighlight: { backgroundColor: colors.primary + '0D' },
  breakdownTd: { flex: 1, fontSize: 13, color: colors.textPrimary, fontWeight: '600' },
});
