import React, { useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator, Pressable, StyleSheet, Text, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AppShell from '../../components/AppShell';
import { colors } from '../../constants/colors';
import { globalHeight, globalWidth } from '../../constants/globalWidth';
import {
  listTargetPhasing,
  updateTargetPhasingStatus,
  deleteTargetPhasing,
} from '../../store/targets/targetPhasingActions';

const THIS_YEAR = new Date().getFullYear();

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

export default function TargetPhasingScreen({ navigation, userDetails, appMetadata, onSignOut }) {
  const token = userDetails?.token || userDetails?.data?.token || '';

  const [phasings, setPhasings]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [yearOpen, setYearOpen]   = useState(false);
  const [togglingId, setTogglingId] = useState('');

  const yearOpts = ['', THIS_YEAR - 1, THIS_YEAR, THIS_YEAR + 1].map((y) =>
    y === '' ? { value: '', label: 'All Years' } : { value: String(y), label: String(y) }
  );

  const fetchPhasings = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (filterYear) params.year = filterYear;
      const res = await listTargetPhasing(token, params);
      setPhasings(res.phasings);
    } catch (e) {
      setError(e.message || 'Failed to load phasing plans');
    } finally {
      setLoading(false);
    }
  }, [token, filterYear]);

  useEffect(() => { fetchPhasings(); }, [fetchPhasings]);

  const handleToggleStatus = async (p) => {
    const id = p._id || p.id;
    const newStatus = p.status === 'active' ? 'inactive' : 'active';
    setTogglingId(id);
    try {
      await updateTargetPhasingStatus(token, id, { status: newStatus });
      fetchPhasings();
    } catch (e) {
      alert(e.message || 'Failed to update status');
    } finally {
      setTogglingId('');
    }
  };

  const handleDelete = async (p) => {
    if (!confirm(`Delete phasing plan "${p.name}"? This cannot be undone.`)) return;
    try {
      await deleteTargetPhasing(token, p._id || p.id);
      fetchPhasings();
    } catch (e) {
      alert(e.message || 'Failed to delete');
    }
  };

  /* compute total percentage for display */
  const totalPct = (phasing) => {
    if (!Array.isArray(phasing.months)) return 0;
    return phasing.months.reduce((s, m) => s + (m.percentage || 0), 0);
  };

  return (
    <AppShell navigation={navigation} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} activeRoute="TargetPhasing">
      {/* Header */}
      <View style={styles.pageHeader}>
        <View>
          <Text style={styles.pageTitle}>Target Phasing</Text>
          <Text style={styles.pageSubtitle}>Monthly percentage distribution plans for target calculations</Text>
        </View>
        <View style={styles.headerActions}>
          {/* Year filter */}
          <View style={{ position: 'relative', zIndex: 10 }}>
            <Pressable style={styles.filterBtn} onPress={() => setYearOpen((v) => !v)}>
              <Text style={styles.filterBtnText}>{filterYear || 'All Years'}</Text>
              <Ionicons name={yearOpen ? 'chevron-up' : 'chevron-down'} size={12} color={colors.textSecondary} />
            </Pressable>
            {yearOpen && (
              <View style={styles.filterDropdown}>
                {yearOpts.map((opt) => (
                  <Pressable
                    key={opt.value}
                    style={[styles.filterOpt, opt.value === filterYear && styles.filterOptActive]}
                    onPress={() => { setFilterYear(opt.value); setYearOpen(false); }}
                  >
                    <Text style={[styles.filterOptText, opt.value === filterYear && styles.filterOptTextActive]}>{opt.label}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
          <Pressable style={styles.btnPrimary} onPress={() => navigation.navigate('TargetPhasingForm', { mode: 'create' })}>
            <Ionicons name="add" size={14} color={colors.white} />
            <Text style={styles.btnPrimaryText}>Add Phasing</Text>
          </Pressable>
        </View>
      </View>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.btnOutline} onPress={fetchPhasings}><Text style={styles.btnOutlineText}>Retry</Text></Pressable>
        </View>
      ) : (
        <View style={styles.tableCard}>
          {/* Table head */}
          <View style={styles.tableHead}>
            {['Name', 'Year', 'Total %', 'Default', 'Status', 'Months Summary', 'Actions'].map((h) => (
              <Text key={h} style={[styles.th, h === 'Actions' && { textAlign: 'right' }]}>{h}</Text>
            ))}
          </View>

          {phasings.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="git-branch-outline" size={36} color={colors.textMuted} />
              <Text style={styles.emptyStateTitle}>No Phasing Plans</Text>
              <Text style={styles.emptyStateText}>Create a phasing plan to distribute monthly targets.</Text>
              <Pressable style={styles.btnPrimary} onPress={() => navigation.navigate('TargetPhasingForm', { mode: 'create' })}>
                <Ionicons name="add" size={14} color={colors.white} />
                <Text style={styles.btnPrimaryText}>Add First Phasing</Text>
              </Pressable>
            </View>
          ) : (
            phasings.map((p) => {
              const id  = p._id || p.id;
              const pct = totalPct(p);
              const months = Array.isArray(p.months) ? p.months : [];
              const monthSummary = months.slice(0, 6).map((m) => `${m.percentage}%`).join(' · ');

              return (
                <View key={id} style={styles.tableRow}>
                  <View style={[styles.td, { flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
                    <Text style={styles.phasingName} numberOfLines={1}>{p.name}</Text>
                  </View>
                  <Text style={styles.td}>{p.year}</Text>
                  <View style={styles.td}>
                    <View style={[styles.pctBadge, { backgroundColor: pct === 100 ? '#DCFCE7' : '#FFF7ED' }]}>
                      <Text style={[styles.pctBadgeText, { color: pct === 100 ? '#15803D' : '#C2410C' }]}>
                        {pct}%
                      </Text>
                    </View>
                  </View>
                  <View style={styles.td}>
                    {p.isDefault ? (
                      <View style={styles.defaultBadge}>
                        <Ionicons name="star" size={11} color="#B45309" />
                        <Text style={styles.defaultBadgeText}>Default</Text>
                      </View>
                    ) : <Text style={{ fontSize: 13, color: colors.textMuted }}>—</Text>}
                  </View>
                  <View style={styles.td}><StatusBadge status={p.status || 'active'} /></View>
                  <Text style={[styles.td, { fontSize: 12, color: colors.textSecondary }]} numberOfLines={1}>
                    {monthSummary || '—'}
                  </Text>
                  <View style={[styles.td, styles.tdActions]}>
                    <Pressable style={styles.actionBtn} onPress={() => navigation.navigate('TargetPhasingForm', { mode: 'edit', phasingId: id })}>
                      <Ionicons name="create-outline" size={15} color={colors.primary} />
                    </Pressable>
                    <Pressable style={styles.actionBtn} onPress={() => handleToggleStatus(p)} disabled={togglingId === id}>
                      {togglingId === id
                        ? <ActivityIndicator size={13} color={colors.textMuted} />
                        : <Ionicons name={p.status === 'active' ? 'pause-circle-outline' : 'play-circle-outline'} size={15} color={p.status === 'active' ? colors.danger : colors.success} />
                      }
                    </Pressable>
                    <Pressable style={styles.actionBtn} onPress={() => handleDelete(p)}>
                      <Ionicons name="trash-outline" size={15} color={colors.danger} />
                    </Pressable>
                  </View>
                </View>
              );
            })
          )}
        </View>
      )}
    </AppShell>
  );
}

const shadow = { shadowColor: '#11224A', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 14, elevation: 3 };

const styles = StyleSheet.create({
  pageHeader: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    marginBottom: globalHeight('1.2%'), flexWrap: 'wrap', gap: 12,
  },
  pageTitle: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  pageSubtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 40 },
  errorText: { fontSize: 13, color: colors.danger },

  filterBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.surface,
  },
  filterBtnText: { fontSize: 13, color: colors.textPrimary, fontWeight: '600' },
  filterDropdown: {
    position: 'absolute', top: 40, right: 0, minWidth: 130,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 8, ...shadow, zIndex: 100,
  },
  filterOpt: { paddingHorizontal: 12, paddingVertical: 9 },
  filterOptActive: { backgroundColor: colors.primary + '15' },
  filterOptText: { fontSize: 13, color: colors.textPrimary },
  filterOptTextActive: { color: colors.primary, fontWeight: '700' },

  tableCard: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, overflow: 'hidden', ...shadow,
  },
  tableHead: {
    flexDirection: 'row', backgroundColor: colors.backgroundColor,
    paddingHorizontal: 16, paddingVertical: 10, gap: 8,
  },
  th: { flex: 1, fontSize: 11, fontWeight: '800', color: colors.textSecondary, minWidth: 80 },
  tableRow: {
    flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: colors.border, alignItems: 'center', gap: 8,
  },
  td: { flex: 1, fontSize: 13, color: colors.textPrimary, minWidth: 80 },
  tdActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 4 },
  actionBtn: { padding: 6, borderRadius: 6 },

  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, alignSelf: 'flex-start' },
  badgeText: { fontSize: 11, fontWeight: '700' },

  phasingName: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  pctBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, alignSelf: 'flex-start' },
  pctBadgeText: { fontSize: 12, fontWeight: '800' },
  defaultBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: '#FFFBEB', alignSelf: 'flex-start' },
  defaultBadgeText: { fontSize: 11, fontWeight: '700', color: '#B45309' },

  emptyState: { alignItems: 'center', gap: 10, paddingVertical: 60 },
  emptyStateTitle: { fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  emptyStateText: { fontSize: 13, color: colors.textMuted },

  btnPrimary: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8,
  },
  btnPrimaryText: { color: colors.white, fontSize: 13, fontWeight: '700' },
  btnOutline: { borderWidth: 1, borderColor: colors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  btnOutlineText: { color: colors.primary, fontSize: 13, fontWeight: '700' },
});
