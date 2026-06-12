import React, { useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AppShell from '../../components/AppShell';
import { colors } from '../../constants/colors';
import { globalHeight, globalWidth } from '../../constants/globalWidth';
import {
  getTargetAssignmentById,
  getTargetMonthlyBreakdown,
  updateTargetAssignmentStatus,
  deleteTargetAssignment,
} from '../../store/targets/targetAssignmentActions';
import { listTargetPhasing } from '../../store/targets/targetPhasingActions';

const isManager = (role) =>
  ['admin', 'manager', 'senior_manager'].includes(String(role).toLowerCase());

const THIS_MONTH = new Date().getMonth() + 1;

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

function DetailRow({ label, value, children }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      {children || <Text style={styles.detailValue}>{value ?? '—'}</Text>}
    </View>
  );
}

function SectionCard({ title, children }) {
  return (
    <View style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

export default function TargetAssignmentDetailsScreen({ navigation, route, userDetails, appMetadata, onSignOut }) {
  const assignmentId = route?.params?.assignmentId;
  const token  = userDetails?.token || userDetails?.data?.token || '';
  const user   = userDetails?.user || userDetails?.data?.user || userDetails || {};
  const role   = user.role || '';
  const manager = isManager(role);

  const [assignment, setAssignment] = useState(null);
  const [phasings, setPhasings]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState('');

  const [selectedPhasingId, setSelectedPhasingId] = useState('');
  const [breakdown, setBreakdown]   = useState(null);
  const [bdLoading, setBdLoading]   = useState(false);
  const [bdError, setBdError]       = useState('');

  const [toggling, setToggling]     = useState(false);

  const fetchAssignment = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [data, pRes] = await Promise.all([
        getTargetAssignmentById(token, assignmentId),
        listTargetPhasing(token, {}),
      ]);
      setAssignment(data);
      setPhasings(pRes.phasings);

      const def = pRes.phasings.find((p) => p.isDefault) || pRes.phasings[0];
      if (def) {
        const pid = def._id || def.id || '';
        setSelectedPhasingId(pid);
        fetchBreakdown(pid);
      }
    } catch (e) {
      setError(e.message || 'Failed to load assignment');
    } finally {
      setLoading(false);
    }
  }, [token, assignmentId]);

  const fetchBreakdown = useCallback(async (phasingId) => {
    if (!assignmentId) return;
    setBdLoading(true);
    setBdError('');
    try {
      const data = await getTargetMonthlyBreakdown(token, assignmentId, phasingId);
      setBreakdown(data);
    } catch (e) {
      setBdError(e.message || 'Failed to load monthly breakdown');
    } finally {
      setBdLoading(false);
    }
  }, [token, assignmentId]);

  useEffect(() => { fetchAssignment(); }, [fetchAssignment]);

  const handleToggleStatus = async () => {
    const id = assignment._id || assignment.id;
    const newStatus = assignment.status === 'active' ? 'inactive' : 'active';
    setToggling(true);
    try {
      await updateTargetAssignmentStatus(token, id, { status: newStatus });
      fetchAssignment();
    } catch (e) {
      alert(e.message || 'Failed to update status');
    } finally {
      setToggling(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Delete this target assignment? This cannot be undone.')) return;
    try {
      await deleteTargetAssignment(token, assignment._id || assignment.id);
      navigation.navigate('TargetAssignments');
    } catch (e) {
      alert(e.message || 'Failed to delete');
    }
  };

  if (loading) return (
    <AppShell navigation={navigation} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} activeRoute="TargetAssignments">
      <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
    </AppShell>
  );

  if (error) return (
    <AppShell navigation={navigation} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} activeRoute="TargetAssignments">
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable style={styles.btnOutline} onPress={fetchAssignment}><Text style={styles.btnOutlineText}>Retry</Text></Pressable>
      </View>
    </AppShell>
  );

  const product  = assignment?.productId || {};
  const channel  = assignment?.channelId || {};
  const repUser  = assignment?.userId || {};
  const pName    = product.productName || product.name || '—';
  const pNick    = product.productNickname || product.nickname || '';
  const chName   = channel.channelName || channel.channelKey || '—';
  const repName  = repUser.fullName || repUser.name || repUser.email || '—';
  const currency = assignment?.currency || assignment?.targetCurrency || 'USD';
  const sym      = currency === 'AED' ? 'AED ' : '$';
  const basis    = assignment?.targetValueBasis || channel?.targetValueBasis || '';

  const fmt    = (n) => n != null ? Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 }) : '—';
  const fmtVal = (v) => v != null ? `${sym}${fmt(v)}` : '—';
  const fmtDt  = (d) => d ? d.slice(0, 10) : '—';

  const months = Array.isArray(breakdown?.months) ? breakdown.months : [];

  return (
    <AppShell navigation={navigation} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} activeRoute="TargetAssignments">
      {/* Breadcrumb */}
      <View style={styles.breadcrumb}>
        <Pressable onPress={() => navigation.navigate('TargetAssignments')}>
          <Text style={styles.breadcrumbLink}>Target Assignments</Text>
        </Pressable>
        <Ionicons name="chevron-forward" size={13} color={colors.textMuted} />
        <Text style={styles.breadcrumbCurrent}>{pName}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Header card */}
        <View style={styles.headerCard}>
          <View style={styles.headerCardLeft}>
            <Text style={styles.headerProductName}>{pName}</Text>
            {pNick ? <Text style={styles.headerProductNick}>{pNick}</Text> : null}
            <View style={styles.headerMeta}>
              <View style={styles.headerMetaItem}>
                <Ionicons name="person-outline" size={13} color={colors.textMuted} />
                <Text style={styles.headerMetaText}>{repName}</Text>
              </View>
              <View style={styles.headerMetaItem}>
                <Ionicons name="radio-button-on-outline" size={13} color={colors.textMuted} />
                <Text style={styles.headerMetaText}>{chName}</Text>
              </View>
              <View style={styles.headerMetaItem}>
                <Ionicons name="calendar-outline" size={13} color={colors.textMuted} />
                <Text style={styles.headerMetaText}>{fmtDt(assignment?.startDate)} → {fmtDt(assignment?.endDate)}</Text>
              </View>
            </View>
          </View>
          <View style={styles.headerCardRight}>
            <StatusBadge status={assignment?.status || 'active'} />
            {manager && (
              <View style={styles.headerActions}>
                <Pressable style={styles.actionBtn} onPress={() => navigation.navigate('TargetAssignmentForm', { mode: 'edit', assignmentId })}>
                  <Ionicons name="create-outline" size={15} color={colors.primary} />
                  <Text style={styles.actionBtnText}>Edit</Text>
                </Pressable>
                <Pressable style={styles.actionBtn} onPress={() => navigation.navigate('TargetAssignmentForm', { mode: 'duplicate', assignmentId })}>
                  <Ionicons name="copy-outline" size={15} color="#7C3AED" />
                  <Text style={[styles.actionBtnText, { color: '#7C3AED' }]}>Duplicate</Text>
                </Pressable>
                <Pressable style={styles.actionBtn} onPress={handleToggleStatus} disabled={toggling}>
                  {toggling
                    ? <ActivityIndicator size={13} color={colors.textMuted} />
                    : <Ionicons name={assignment?.status === 'active' ? 'pause-circle-outline' : 'play-circle-outline'} size={15} color={assignment?.status === 'active' ? colors.danger : colors.success} />
                  }
                  <Text style={[styles.actionBtnText, { color: assignment?.status === 'active' ? colors.danger : colors.success }]}>
                    {assignment?.status === 'active' ? 'Deactivate' : 'Activate'}
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>

        <View style={styles.detailsGrid}>
          {/* Assignment Details */}
          <SectionCard title="Assignment Details">
            <DetailRow label="Medical Rep"       value={repName} />
            <DetailRow label="Product"           value={`${pName}${pNick ? ` (${pNick})` : ''}`} />
            <DetailRow label="Sales Channel"     value={chName} />
            <DetailRow label="Year"              value={assignment?.year} />
            <DetailRow label="Period"            value={`${fmtDt(assignment?.startDate)} → ${fmtDt(assignment?.endDate)}`} />
            <DetailRow label="Status">
              <StatusBadge status={assignment?.status || 'active'} />
            </DetailRow>
            {assignment?.notes ? <DetailRow label="Notes" value={assignment.notes} /> : null}
            <DetailRow label="Created"           value={assignment?.createdAt ? new Date(assignment.createdAt).toLocaleDateString() : '—'} />
            <DetailRow label="Updated"           value={assignment?.updatedAt ? new Date(assignment.updatedAt).toLocaleDateString() : '—'} />
          </SectionCard>

          {/* Target Summary */}
          <SectionCard title="Target Summary">
            <View style={styles.targetSummaryCards}>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Period Target Units</Text>
                <Text style={styles.summaryValue}>{fmt(assignment?.totalTargetUnits)}</Text>
                <Text style={styles.summaryUnit}>units</Text>
              </View>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryLabel}>Period Target Value</Text>
                <Text style={styles.summaryValue}>{fmtVal(assignment?.totalTargetValue)}</Text>
                <Text style={styles.summaryUnit}>{currency}</Text>
              </View>
            </View>
            {basis ? (
              <View style={styles.basisRow}>
                <Ionicons name="analytics-outline" size={13} color={colors.textMuted} />
                <Text style={styles.basisText}>
                  Value Basis: {TARGET_BASIS_LABELS[basis] || basis} / {currency}
                </Text>
              </View>
            ) : null}
          </SectionCard>
        </View>

        {/* Monthly Breakdown */}
        <SectionCard title="Monthly Breakdown">
          {/* Phasing selector */}
          {phasings.length > 0 && (
            <View style={styles.phasingRow}>
              <Text style={styles.phasingLabel}>Phasing Plan:</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                {phasings.map((p) => {
                  const pid = p._id || p.id || '';
                  const sel = selectedPhasingId === pid;
                  return (
                    <Pressable
                      key={pid}
                      style={[styles.phasingPill, sel && styles.phasingPillActive]}
                      onPress={() => { setSelectedPhasingId(pid); fetchBreakdown(pid); }}
                    >
                      <Text style={[styles.phasingPillText, sel && styles.phasingPillTextActive]}>
                        {p.name || pid}{p.isDefault ? ' ★' : ''}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {bdLoading ? (
            <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 16 }} />
          ) : bdError ? (
            <Text style={styles.errorText}>{bdError}</Text>
          ) : months.length === 0 ? (
            <View style={styles.emptyBreakdown}>
              <Ionicons name="bar-chart-outline" size={24} color={colors.textMuted} />
              <Text style={styles.emptyBreakdownText}>
                {phasings.length === 0
                  ? 'No phasing plans available. Create a phasing plan first.'
                  : 'Select a phasing plan to view the monthly breakdown.'}
              </Text>
              {phasings.length === 0 && manager && (
                <Pressable style={styles.btnPrimary} onPress={() => navigation.navigate('TargetPhasing')}>
                  <Text style={styles.btnPrimaryText}>Manage Phasing</Text>
                </Pressable>
              )}
            </View>
          ) : (
            <>
              <View style={styles.breakdownTableHead}>
                {['Month', 'Phasing %', 'Target Units', 'Target Value'].map((h) => (
                  <Text key={h} style={styles.breakdownTh}>{h}</Text>
                ))}
              </View>
              {months.map((m) => (
                <View key={m.month} style={[styles.breakdownRow, m.month === THIS_MONTH && styles.breakdownRowHighlight]}>
                  <Text style={[styles.breakdownTd, m.month === THIS_MONTH && { fontWeight: '800', color: colors.primary }]}>
                    {m.monthName || m.month}{m.month === THIS_MONTH ? ' ✦' : ''}
                  </Text>
                  <Text style={styles.breakdownTd}>{m.percentage}%</Text>
                  <Text style={styles.breakdownTd}>{m.targetUnits != null ? Number(m.targetUnits).toLocaleString() : '—'}</Text>
                  <Text style={styles.breakdownTd}>{m.targetValue != null ? `${sym}${Number(m.targetValue).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}</Text>
                </View>
              ))}
              {/* Totals row */}
              <View style={[styles.breakdownRow, styles.breakdownTotalsRow]}>
                <Text style={[styles.breakdownTd, { fontWeight: '800' }]}>Total</Text>
                <Text style={[styles.breakdownTd, { fontWeight: '800' }]}>
                  {months.reduce((s, m) => s + (m.percentage || 0), 0)}%
                </Text>
                <Text style={[styles.breakdownTd, { fontWeight: '800' }]}>
                  {fmt(months.reduce((s, m) => s + (m.targetUnits || 0), 0))}
                </Text>
                <Text style={[styles.breakdownTd, { fontWeight: '800' }]}>
                  {`${sym}${fmt(months.reduce((s, m) => s + (m.targetValue || 0), 0))}`}
                </Text>
              </View>
            </>
          )}
        </SectionCard>

      </ScrollView>
    </AppShell>
  );
}

const shadow = { shadowColor: '#0B2B66', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } };

const styles = StyleSheet.create({
  breadcrumb: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: globalHeight('1.2%') },
  breadcrumbLink: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  breadcrumbCurrent: { fontSize: 13, color: colors.textSecondary },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 40 },
  errorText: { color: colors.danger, fontSize: 13 },
  scroll: { paddingBottom: globalHeight('4%'), gap: 16 },

  headerCard: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, padding: 20, flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', gap: 16, ...shadow,
  },
  headerCardLeft: { flex: 1, gap: 8 },
  headerProductName: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  headerProductNick: { fontSize: 13, color: colors.textMuted, fontWeight: '700' },
  headerMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  headerMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerMetaText: { fontSize: 13, color: colors.textSecondary },
  headerCardRight: { alignItems: 'flex-end', gap: 12 },
  headerActions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  actionBtnText: { fontSize: 13, fontWeight: '700', color: colors.primary },

  detailsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },

  sectionCard: {
    flex: 1, minWidth: 280,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, padding: 18, gap: 0, ...shadow,
  },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: colors.textPrimary, marginBottom: 14 },

  detailRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  detailLabel: { fontSize: 13, color: colors.textSecondary },
  detailValue: { fontSize: 13, fontWeight: '700', color: colors.textPrimary, maxWidth: '60%', textAlign: 'right' },

  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '700' },

  targetSummaryCards: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  summaryCard: {
    flex: 1, backgroundColor: colors.backgroundColor, borderRadius: 8,
    padding: 14, alignItems: 'center', gap: 4,
  },
  summaryLabel: { fontSize: 11, color: colors.textSecondary, fontWeight: '600', textAlign: 'center' },
  summaryValue: { fontSize: 22, fontWeight: '800', color: colors.textPrimary },
  summaryUnit: { fontSize: 11, color: colors.textMuted },
  basisRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 8 },
  basisText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },

  phasingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  phasingLabel: { fontSize: 12, color: colors.textSecondary, fontWeight: '700', flexShrink: 0 },
  phasingPill: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  phasingPillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  phasingPillText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  phasingPillTextActive: { color: colors.white, fontWeight: '700' },

  breakdownTableHead: {
    flexDirection: 'row', backgroundColor: colors.backgroundColor,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 6, marginBottom: 4,
  },
  breakdownTh: { flex: 1, fontSize: 11, fontWeight: '800', color: colors.textSecondary },
  breakdownRow: {
    flexDirection: 'row', paddingHorizontal: 14, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  breakdownRowHighlight: { backgroundColor: colors.primary + '0D' },
  breakdownTotalsRow: { backgroundColor: colors.backgroundColor, borderRadius: 6, borderBottomWidth: 0 },
  breakdownTd: { flex: 1, fontSize: 13, color: colors.textPrimary, fontWeight: '600' },

  emptyBreakdown: { alignItems: 'center', gap: 10, paddingVertical: 32 },
  emptyBreakdownText: { fontSize: 13, color: colors.textMuted, textAlign: 'center', maxWidth: 360 },

  btnPrimary: {
    backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 9,
    borderRadius: 8, marginTop: 4,
  },
  btnPrimaryText: { color: colors.white, fontSize: 13, fontWeight: '700' },
  btnOutline: { borderWidth: 1, borderColor: colors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  btnOutlineText: { color: colors.primary, fontSize: 13, fontWeight: '700' },
});
