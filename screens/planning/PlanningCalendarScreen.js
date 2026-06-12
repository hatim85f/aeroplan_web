import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AppShell from '../../components/AppShell';
import { colors } from '../../constants/colors';
import { globalWidth } from '../../constants/globalWidth';
import {
  createVisits,
  deleteVisit,
  getMyCalendar,
  listPlanningAccounts,
  submitPlan,
  updateVisit,
} from '../../store/planning/planningActions';
import { addDays, isoDate, planStatusStyle, weekDays, weekStartOf } from './planningUtils';

const shadow = { shadowColor: '#0B2B66', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } };
const PAD = globalWidth('1.2%');

const fmtRange = (start, end) => {
  const s = new Date(start);
  const e = new Date(end);
  const sM = s.toLocaleDateString('en-US', { month: 'short' });
  const eM = e.toLocaleDateString('en-US', { month: 'short' });
  return `${sM} ${s.getDate()} – ${eM} ${e.getDate()}, ${e.getFullYear()}`;
};

const LEGEND = [
  { key: 'draft', label: 'Draft', color: '#1D4ED8' },
  { key: 'submitted', label: 'Submitted', color: '#15803D' },
  { key: 'cancelled', label: 'Cancelled', color: '#94A3B8' },
];

export default function PlanningCalendarScreen({ navigation, userDetails, appMetadata, onSignOut }) {
  const token = userDetails?.token || userDetails?.data?.token || '';

  const [weekStart, setWeekStart] = useState(() => weekStartOf(new Date()));
  const [accounts, setAccounts] = useState([]);
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [movingVisit, setMovingVisit] = useState(null);

  // Per-day add modal
  const [pickerDay, setPickerDay] = useState(null);
  const [pickerIds, setPickerIds] = useState([]);
  const [pickerSearch, setPickerSearch] = useState('');

  const days = useMemo(() => weekDays(weekStart), [weekStart]);
  const rangeStart = isoDate(days[0].date);
  const rangeEnd = isoDate(days[6].date);

  const fetchAccounts = useCallback(async () => {
    if (!token) return;
    setAccounts(await listPlanningAccounts(token).catch(() => []));
  }, [token]);

  const fetchVisits = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      const data = await getMyCalendar(token, { startDate: rangeStart, endDate: rangeEnd });
      setVisits(data?.visits || []);
    } catch { setVisits([]); } finally { setLoading(false); }
  }, [rangeEnd, rangeStart, token]);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);
  useEffect(() => { fetchVisits(); }, [fetchVisits]);

  const visitsByDay = useMemo(() => {
    const map = {};
    visits.forEach((v) => { const k = isoDate(v.visitDate); (map[k] = map[k] || []).push(v); });
    return map;
  }, [visits]);

  const addToDay = async (dayIso, ids) => {
    if (!ids.length) return;
    try {
      await createVisits(token, ids.map((id) => ({ planningAccountId: id, visitDate: dayIso })));
      await fetchVisits();
    } catch (err) { window.alert(err.message || 'Failed to add visits.'); }
  };

  const onDayBodyPress = async (dayIso) => {
    if (!movingVisit) return;
    const moving = movingVisit;
    setMovingVisit(null);
    if (isoDate(moving.visitDate) === dayIso) return;
    try { await updateVisit(token, String(moving.visitId), { visitDate: dayIso }); await fetchVisits(); }
    catch (err) { window.alert(err.message || 'Failed to move visit.'); }
  };

  const openPicker = (dayIso) => { setPickerIds([]); setPickerSearch(''); setPickerDay(dayIso); };
  const confirmPicker = async () => {
    const day = pickerDay;
    setPickerDay(null);
    await addToDay(day, pickerIds);
    setPickerIds([]);
  };

  const removeVisit = async (visit) => {
    try { await deleteVisit(token, String(visit.visitId)); await fetchVisits(); }
    catch (err) { window.alert(err.message || 'Failed to remove visit.'); }
  };

  const handleSubmit = async () => {
    if (!window.confirm(`Submit your plan for ${rangeStart} → ${rangeEnd}?`)) return;
    try {
      setSaving(true);
      const result = await submitPlan(token, { startDate: rangeStart, endDate: rangeEnd });
      await fetchVisits();
      window.alert(`Plan submitted. ${result?.submittedCount ?? 0} visit(s) submitted.`);
    } catch (err) { window.alert(err.message || 'Failed to submit plan.'); }
    finally { setSaving(false); }
  };

  // Weekly summary
  const summary = useMemo(() => {
    const active = visits.filter((v) => v.planStatus !== 'cancelled');
    const submitted = active.filter((v) => v.planStatus === 'submitted').length;
    const draft = active.filter((v) => v.planStatus === 'draft').length;
    const pct = active.length ? Math.round((submitted / active.length) * 100) : 0;
    return { planned: active.length, submitted, draft, accounts: accounts.length, pct };
  }, [accounts.length, visits]);

  const pickerList = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase();
    return accounts.filter((a) => !q || String(a.accountName).toLowerCase().includes(q));
  }, [accounts, pickerSearch]);

  return (
    <AppShell navigation={navigation} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} activeRoute="PlanningCalendar">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Header */}
        <View style={styles.pageHeader}>
          <View>
            <Text style={styles.pageTitle}>Planning Calendar</Text>
            <Text style={styles.pageSubtitle}>
              {movingVisit ? 'Moving visit — click the target day' : 'Use “Add Account” on any day to plan visits'}
            </Text>
          </View>
          <View style={styles.headerRight}>
            <View style={styles.weekPill}><Text style={styles.weekPillText}>Week</Text></View>
            <Pressable style={styles.navBtn} onPress={() => setWeekStart(addDays(weekStart, -7))}><Ionicons name="chevron-back" size={16} color={colors.textPrimary} /></Pressable>
            <View style={styles.rangePill}>
              <Ionicons name="calendar-outline" size={13} color={colors.textSecondary} />
              <Text style={styles.rangeText}>{fmtRange(rangeStart, rangeEnd)}</Text>
            </View>
            <Pressable style={styles.navBtn} onPress={() => setWeekStart(addDays(weekStart, 7))}><Ionicons name="chevron-forward" size={16} color={colors.textPrimary} /></Pressable>
            <Pressable style={styles.btnOutline} onPress={() => setWeekStart(weekStartOf(new Date()))}><Text style={styles.btnOutlineText}>Today</Text></Pressable>
            <Pressable style={[styles.btnPrimary, saving && { opacity: 0.6 }]} onPress={handleSubmit} disabled={saving}>
              {saving ? <ActivityIndicator size={12} color="#fff" /> : <Ionicons name="checkmark-done-outline" size={14} color="#fff" />}
              <Text style={styles.btnPrimaryText}>Submit Plan</Text>
            </Pressable>
          </View>
        </View>

        {/* Legend */}
        <View style={styles.legendRow}>
          {LEGEND.map((item) => (
            <View key={item.key} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: item.color }]} />
              <Text style={styles.legendText}>{item.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.boardRow}>
          {/* Week grid */}
          <View style={styles.weekGrid}>
            {days.map((day) => {
              const dayVisits = visitsByDay[day.iso] || [];
              const isToday = day.iso === isoDate(new Date());
              const armedActive = Boolean(movingVisit);
              return (
                <View key={day.iso} style={[styles.dayCol, isToday && styles.dayColToday]}>
                  <View style={styles.dayHead}>
                    <Text style={styles.dayName}>{day.dayName} {String(day.dayNum).padStart(2, '0')}</Text>
                    <View style={styles.dayCount}><Text style={styles.dayCountText}>{dayVisits.length}</Text></View>
                  </View>
                  <Pressable style={styles.addAccountBtn} onPress={() => openPicker(day.iso)}>
                    <Ionicons name="add" size={13} color={colors.primary} />
                    <Text style={styles.addAccountText}>Add Account</Text>
                  </Pressable>
                  <Pressable style={styles.dayBody} onPress={() => onDayBodyPress(day.iso)}>
                    {dayVisits.map((visit) => {
                      const st = planStatusStyle(visit.planStatus);
                      const isMoving = movingVisit && String(movingVisit.visitId) === String(visit.visitId);
                      return (
                        <View key={String(visit.visitId)} style={[styles.visitCard, { borderLeftColor: st.text }, isMoving && styles.visitCardMoving]}>
                          <Text style={styles.visitText} numberOfLines={2}>{visit.accountName}</Text>
                          <View style={styles.visitFooter}>
                            <View style={styles.statusRow}>
                              <View style={[styles.statusDot, { backgroundColor: st.text }]} />
                              <Text style={[styles.statusLabel, { color: st.text }]}>{st.label}</Text>
                            </View>
                            <Pressable hitSlop={6} onPress={(e) => { e.stopPropagation(); setArmedIds([]); setMovingVisit(isMoving ? null : visit); }}>
                              <Ionicons name="swap-horizontal-outline" size={13} color={colors.textMuted} />
                            </Pressable>
                            <Pressable hitSlop={6} onPress={(e) => { e.stopPropagation(); removeVisit(visit); }}>
                              <Ionicons name="close" size={13} color={colors.danger} />
                            </Pressable>
                          </View>
                        </View>
                      );
                    })}
                    {!dayVisits.length ? (
                      <View style={styles.dayEmpty}>
                        <Ionicons name="calendar-outline" size={22} color={colors.textMuted} />
                        <Text style={styles.dayEmptyTitle}>{armedActive ? 'Click to move here' : 'No visits planned'}</Text>
                        {!armedActive ? <Text style={styles.dayEmptySub}>Use “Add Account” above</Text> : null}
                      </View>
                    ) : null}
                  </Pressable>
                  <Pressable style={styles.addAccountBtnBottom} onPress={() => openPicker(day.iso)}>
                    <Ionicons name="add" size={13} color={colors.primary} />
                    <Text style={styles.addAccountText}>Add Account</Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        </View>

        {/* Weekly summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Weekly Summary</Text>
          <View style={styles.summaryRow}>
            <SummaryStat icon="calendar-outline" iconBg="#EFF6FF" iconColor="#1D4ED8" value={summary.planned} label="Planned Visits" />
            <SummaryStat icon="checkmark-circle-outline" iconBg="#F0FDF4" iconColor="#15803D" value={summary.submitted} label="Submitted" />
            <SummaryStat icon="create-outline" iconBg="#EFF6FF" iconColor="#1D4ED8" value={summary.draft} label="Draft" />
            <SummaryStat icon="business-outline" iconBg="#F5F3FF" iconColor="#7C3AED" value={summary.accounts} label="Planning Accounts" />
            <View style={styles.completionBox}>
              <View style={styles.completionRing}>
                <Text style={styles.completionPct}>{summary.pct}%</Text>
              </View>
              <View>
                <Text style={styles.completionLabel}>Plan Submitted</Text>
                <Text style={styles.completionSub}>{summary.submitted} of {summary.planned} visits</Text>
              </View>
            </View>
          </View>
        </View>

        {loading ? <View style={styles.centered}><ActivityIndicator color={colors.primary} /></View> : null}
      </ScrollView>

      {/* Per-day add modal */}
      {pickerDay && (
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
              <Text style={styles.modalTitle}>Add Accounts · {pickerDay}</Text>
              <View style={{ flex: 1 }} />
              <Pressable onPress={() => setPickerDay(null)}><Ionicons name="close" size={20} color={colors.textMuted} /></Pressable>
            </View>
            <View style={styles.searchBox}>
              <Ionicons name="search-outline" size={13} color={colors.textMuted} />
              <TextInput value={pickerSearch} onChangeText={setPickerSearch} placeholder="Search accounts..." placeholderTextColor={colors.textMuted} style={styles.searchInput} />
            </View>
            <Text style={styles.pickerCount}>{pickerIds.length} selected</Text>
            <ScrollView style={{ maxHeight: 320, borderWidth: 1, borderColor: colors.border, borderRadius: 8 }} nestedScrollEnabled>
              {pickerList.map((account) => {
                const sel = pickerIds.includes(String(account._id));
                return (
                  <Pressable key={String(account._id)} style={[styles.pickRow, sel && styles.pickRowActive]} onPress={() => setPickerIds((cur) => (cur.includes(String(account._id)) ? cur.filter((x) => x !== String(account._id)) : [...cur, String(account._id)]))}>
                    <Ionicons name={sel ? 'checkbox' : 'square-outline'} size={16} color={sel ? colors.primary : colors.textMuted} />
                    <Text style={styles.pickText} numberOfLines={1}>{account.accountName}</Text>
                  </Pressable>
                );
              })}
              {!pickerList.length ? <Text style={styles.emptyText}>No accounts found.</Text> : null}
            </ScrollView>
            <View style={styles.modalActions}>
              <Pressable style={styles.btnOutline} onPress={() => setPickerDay(null)}><Text style={styles.btnOutlineText}>Cancel</Text></Pressable>
              <Pressable style={[styles.btnPrimary, !pickerIds.length && { opacity: 0.5 }]} disabled={!pickerIds.length} onPress={confirmPicker}>
                <Ionicons name="checkmark" size={14} color="#fff" />
                <Text style={styles.btnPrimaryText}>Add {pickerIds.length ? `(${pickerIds.length})` : ''}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </AppShell>
  );
}

function SummaryStat({ icon, iconBg, iconColor, value, label }) {
  return (
    <View style={styles.summaryStat}>
      <View style={[styles.summaryIcon, { backgroundColor: iconBg }]}><Ionicons name={icon} size={18} color={iconColor} /></View>
      <View>
        <Text style={styles.summaryValue}>{value}</Text>
        <Text style={styles.summaryLabel}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: PAD, gap: 12, paddingBottom: 48 },
  pageHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 },
  pageTitle: { fontSize: 22, fontWeight: '800', color: colors.textPrimary },
  pageSubtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  weekPill: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.surface },
  weekPillText: { fontSize: 12, fontWeight: '700', color: colors.textPrimary },
  navBtn: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  rangePill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: colors.surface },
  rangeText: { fontSize: 12, fontWeight: '700', color: colors.textPrimary },

  legendRow: { flexDirection: 'row', gap: 16, alignItems: 'center', justifyContent: 'flex-end' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  legendText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },

  boardRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  accountsPanel: { width: 260, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, gap: 10, ...shadow },
  panelHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  panelTitle: { fontSize: 14, fontWeight: '800', color: colors.textPrimary },
  selectedPill: { backgroundColor: colors.primary + '14', borderRadius: 12, paddingHorizontal: 9, paddingVertical: 3 },
  selectedPillText: { fontSize: 11, fontWeight: '800', color: colors.primary },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, backgroundColor: colors.backgroundColor, minHeight: 38 },
  searchInput: { flex: 1, fontSize: 12, color: colors.textPrimary, paddingVertical: 9 },
  selectAllRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  selectAllText: { fontSize: 12, fontWeight: '700', color: colors.textPrimary },
  accountItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  accountItemText: { flex: 1, fontSize: 12, color: colors.textSecondary },

  weekGrid: { flex: 1, flexDirection: 'row', gap: 8 },
  dayCol: { flex: 1, minWidth: 0, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, ...shadow },
  dayColToday: { borderColor: colors.primary },
  dayHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  dayName: { fontSize: 13.5, fontWeight: '800', color: colors.textPrimary },
  dayCount: { minWidth: 22, height: 22, borderRadius: 11, backgroundColor: colors.backgroundColor, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  dayCountText: { fontSize: 12, fontWeight: '800', color: colors.textSecondary },
  addAccountBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.border },
  addAccountBtnBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 12, borderTopWidth: 1, borderTopColor: colors.border },
  addAccountText: { fontSize: 12.5, fontWeight: '700', color: colors.primary },
  dayBody: { padding: 10, gap: 9, minHeight: 440 },
  visitCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderLeftWidth: 3, borderRadius: 9, padding: 11, gap: 8, ...shadow },
  visitCardMoving: { borderColor: colors.primary, backgroundColor: colors.primary + '0E' },
  visitText: { fontSize: 12.5, color: colors.textPrimary, fontWeight: '700' },
  visitFooter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginRight: 'auto' },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusLabel: { fontSize: 10, fontWeight: '700' },
  dayEmpty: { alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 40 },
  dayEmptyTitle: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  dayEmptySub: { fontSize: 10.5, color: colors.textMuted },

  summaryCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 16, gap: 12, ...shadow },
  summaryTitle: { fontSize: 15, fontWeight: '800', color: colors.textPrimary },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, alignItems: 'center' },
  summaryStat: { flex: 1, minWidth: 150, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.backgroundColor, borderRadius: 10, padding: 12 },
  summaryIcon: { width: 38, height: 38, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  summaryValue: { fontSize: 22, fontWeight: '800', color: colors.textPrimary },
  summaryLabel: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },
  completionBox: { flex: 1, minWidth: 180, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.backgroundColor, borderRadius: 10, padding: 12 },
  completionRing: { width: 54, height: 54, borderRadius: 27, borderWidth: 5, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  completionPct: { fontSize: 13, fontWeight: '800', color: colors.textPrimary },
  completionLabel: { fontSize: 12, fontWeight: '800', color: colors.textPrimary },
  completionSub: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },

  btnPrimary: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8 },
  btnPrimaryText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  btnOutline: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.surface },
  btnOutlineText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },

  modalOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(7,18,47,0.45)', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 },
  modal: { backgroundColor: '#fff', borderRadius: 14, padding: 18, gap: 12, width: '100%', maxWidth: 520, ...shadow },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  modalTitle: { fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  pickerCount: { fontSize: 11, fontWeight: '800', color: colors.primary },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border + '60' },
  pickRowActive: { backgroundColor: colors.primary + '0E' },
  pickText: { flex: 1, fontSize: 12.5, color: colors.textPrimary },

  emptyText: { fontSize: 12, color: colors.textMuted, textAlign: 'center', paddingVertical: 12 },
  centered: { padding: 24, alignItems: 'center', justifyContent: 'center' },
});
