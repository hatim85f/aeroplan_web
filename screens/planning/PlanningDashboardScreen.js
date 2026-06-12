import React, { useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AppShell from '../../components/AppShell';
import { colors } from '../../constants/colors';
import { globalWidth } from '../../constants/globalWidth';
import { getManagerDashboard, getTeamWeek } from '../../store/planning/planningActions';
import { addDays, isManagerRole, isoDate, weekStartOf } from './planningUtils';

const shadow = { shadowColor: '#0B2B66', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } };
const PAD = globalWidth('1.2%');

function StatCard({ icon, iconColor, iconBg, label, value }) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: iconBg }]}><Ionicons name={icon} size={18} color={iconColor} /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.statLabel}>{label}</Text>
        <Text style={styles.statValue}>{value ?? '—'}</Text>
      </View>
    </View>
  );
}

export default function PlanningDashboardScreen({ navigation, userDetails, appMetadata, onSignOut }) {
  const user = userDetails?.user || userDetails?.data?.user || userDetails || {};
  const token = userDetails?.token || userDetails?.data?.token || '';
  const manager = isManagerRole(user.role || '');

  const [date, setDate] = useState(() => isoDate(new Date()));
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [weekRep, setWeekRep] = useState(null); // { userId, userName }
  const [weekStart, setWeekStart] = useState(() => isoDate(weekStartOf(new Date())));
  const [week, setWeek] = useState(null);
  const [weekLoading, setWeekLoading] = useState(false);

  const fetchDashboard = useCallback(async () => {
    if (!token || !manager) return;
    try {
      setLoading(true);
      setError('');
      setData(await getManagerDashboard(token, { date }));
    } catch (err) {
      setError(err.message || 'Failed to load planning dashboard.');
    } finally {
      setLoading(false);
    }
  }, [date, manager, token]);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  const openWeek = useCallback(async (rep, startIso) => {
    setWeekRep(rep);
    try {
      setWeekLoading(true);
      setWeek(await getTeamWeek(token, { userId: String(rep.userId), weekStartDate: startIso }));
    } catch {
      setWeek(null);
    } finally {
      setWeekLoading(false);
    }
  }, [token]);

  const shiftWeek = (deltaDays) => {
    const next = isoDate(addDays(new Date(weekStart), deltaDays));
    setWeekStart(next);
    if (weekRep) openWeek(weekRep, next);
  };

  if (!manager) {
    return (
      <AppShell navigation={navigation} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} activeRoute="PlanningDashboard">
        <View style={styles.centered}><Text style={styles.errorText}>Only managers can view the team planning dashboard.</Text></View>
      </AppShell>
    );
  }

  const cards = data?.summaryCards || {};
  const reps = data?.reps || [];

  return (
    <AppShell navigation={navigation} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} activeRoute="PlanningDashboard">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        <View style={styles.pageHeader}>
          <View>
            <Text style={styles.pageTitle}>Today Team Plan</Text>
            <Text style={styles.pageSubtitle}>Where everyone is planned to visit</Text>
          </View>
          <View style={styles.dateNav}>
            <Pressable style={styles.navBtn} onPress={() => setDate(isoDate(addDays(new Date(date), -1)))}><Ionicons name="chevron-back" size={16} color={colors.textPrimary} /></Pressable>
            <Text style={styles.dateLabel}>{date}</Text>
            <Pressable style={styles.navBtn} onPress={() => setDate(isoDate(addDays(new Date(date), 1)))}><Ionicons name="chevron-forward" size={16} color={colors.textPrimary} /></Pressable>
            <Pressable style={styles.btnOutlineSm} onPress={() => setDate(isoDate(new Date()))}><Text style={styles.btnOutlineSmText}>Today</Text></Pressable>
          </View>
        </View>

        <View style={styles.statsRow}>
          <StatCard icon="people-outline" iconColor="#1D4ED8" iconBg="#EFF6FF" label="Total Reps" value={cards.totalReps} />
          <StatCard icon="checkmark-circle-outline" iconColor="#15803D" iconBg="#F0FDF4" label="Reps With Visits" value={cards.repsWithVisits} />
          <StatCard icon="alert-circle-outline" iconColor="#B45309" iconBg="#FFFBEB" label="Reps Without Visits" value={cards.repsWithoutVisits} />
          <StatCard icon="navigate-outline" iconColor="#7C3AED" iconBg="#F5F3FF" label="Total Visits Today" value={cards.totalVisits} />
        </View>

        {loading ? (
          <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
        ) : error ? (
          <View style={styles.centered}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.btnOutline} onPress={fetchDashboard}><Text style={styles.btnOutlineText}>Retry</Text></Pressable>
          </View>
        ) : (
          <View style={styles.repGrid}>
            {reps.map((rep) => (
              <View key={String(rep.userId)} style={styles.repCard}>
                <View style={styles.repHeader}>
                  <Text style={styles.repName} numberOfLines={1}>{rep.userName}</Text>
                  <View style={[styles.countPill, rep.visitsCount ? styles.countPillActive : null]}>
                    <Text style={[styles.countPillText, rep.visitsCount ? { color: '#fff' } : null]}>{rep.visitsCount}</Text>
                  </View>
                </View>
                {rep.visits.length ? (
                  <View style={styles.visitList}>
                    {rep.visits.map((visit) => (
                      <View key={String(visit.visitId)} style={styles.visitChip}>
                        <Ionicons name="business-outline" size={12} color={colors.textSecondary} />
                        <Text style={styles.visitText} numberOfLines={1}>{visit.accountName}</Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.repEmpty}>No visits planned</Text>
                )}
                <Pressable style={styles.weekBtn} onPress={() => { setWeekStart(isoDate(weekStartOf(new Date(date)))); openWeek({ userId: rep.userId, userName: rep.userName }, isoDate(weekStartOf(new Date(date)))); }}>
                  <Ionicons name="calendar-outline" size={13} color={colors.primary} />
                  <Text style={styles.weekBtnText}>View Weekly Plan</Text>
                </Pressable>
              </View>
            ))}
            {!reps.length ? <Text style={styles.emptyText}>No reps in your team yet.</Text> : null}
          </View>
        )}
      </ScrollView>

      {/* Weekly plan drawer */}
      {weekRep && (
        <View style={styles.drawerOverlay}>
          <Pressable style={styles.drawerBackdrop} onPress={() => { setWeekRep(null); setWeek(null); }} />
          <View style={styles.drawer}>
            <View style={styles.drawerHeader}>
              <View>
                <Text style={styles.drawerTitle}>{weekRep.userName}</Text>
                <Text style={styles.drawerSub}>Weekly plan</Text>
              </View>
              <Pressable onPress={() => { setWeekRep(null); setWeek(null); }}><Ionicons name="close" size={20} color={colors.textMuted} /></Pressable>
            </View>
            <View style={styles.weekNav}>
              <Pressable style={styles.navBtn} onPress={() => shiftWeek(-7)}><Ionicons name="chevron-back" size={15} color={colors.textPrimary} /></Pressable>
              <Text style={styles.weekLabel}>Week of {week?.weekStartDate || weekStart}</Text>
              <Pressable style={styles.navBtn} onPress={() => shiftWeek(7)}><Ionicons name="chevron-forward" size={15} color={colors.textPrimary} /></Pressable>
            </View>
            {weekLoading ? (
              <View style={styles.centered}><ActivityIndicator color={colors.primary} /></View>
            ) : (
              <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                {(week?.days || []).map((day) => (
                  <View key={day.date} style={styles.weekDay}>
                    <View style={styles.weekDayHead}>
                      <Text style={styles.weekDayName}>{day.dayName}</Text>
                      <Text style={styles.weekDayDate}>{day.date.slice(5)}</Text>
                    </View>
                    {day.visits.length ? day.visits.map((visit) => (
                      <View key={String(visit.visitId)} style={styles.weekVisit}>
                        <Ionicons name="business-outline" size={12} color={colors.textSecondary} />
                        <Text style={styles.weekVisitText} numberOfLines={1}>{visit.accountName}</Text>
                      </View>
                    )) : <Text style={styles.weekDayEmpty}>No visits planned</Text>}
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      )}
    </AppShell>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: PAD, gap: 14, paddingBottom: 48 },
  pageHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 },
  pageTitle: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  pageSubtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  dateNav: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  navBtn: { width: 30, height: 30, borderRadius: 7, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  dateLabel: { fontSize: 13, fontWeight: '700', color: colors.textPrimary, minWidth: 100, textAlign: 'center' },

  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard: { flex: 1, minWidth: 150, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, ...shadow },
  statIcon: { width: 36, height: 36, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  statLabel: { fontSize: 11, color: colors.textSecondary, fontWeight: '600', marginBottom: 2 },
  statValue: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },

  repGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  repCard: { flex: 1, minWidth: 260, maxWidth: 380, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, gap: 10, ...shadow },
  repHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  repName: { fontSize: 14, fontWeight: '800', color: colors.textPrimary, flex: 1 },
  countPill: { minWidth: 24, alignItems: 'center', backgroundColor: colors.border + '70', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  countPillActive: { backgroundColor: colors.primary },
  countPillText: { fontSize: 11, fontWeight: '800', color: colors.textSecondary },
  visitList: { gap: 6 },
  visitChip: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: colors.backgroundColor, borderRadius: 7, paddingHorizontal: 9, paddingVertical: 7 },
  visitText: { flex: 1, fontSize: 12, color: colors.textPrimary, fontWeight: '600' },
  repEmpty: { fontSize: 12, color: colors.textMuted, paddingVertical: 6 },
  weekBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start' },
  weekBtnText: { fontSize: 12, color: colors.primary, fontWeight: '700' },

  drawerOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, flexDirection: 'row', zIndex: 100 },
  drawerBackdrop: { flex: 1, backgroundColor: 'rgba(7,18,47,0.35)' },
  drawer: { width: 380, maxWidth: '90%', backgroundColor: colors.surface, padding: 16, gap: 12, borderLeftWidth: 1, borderLeftColor: colors.border },
  drawerHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  drawerTitle: { fontSize: 16, fontWeight: '800', color: colors.textPrimary },
  drawerSub: { fontSize: 12, color: colors.textSecondary },
  weekNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  weekLabel: { fontSize: 12, fontWeight: '700', color: colors.textPrimary, minWidth: 140, textAlign: 'center' },
  weekDay: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10, gap: 6, marginBottom: 8 },
  weekDayHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  weekDayName: { fontSize: 12, fontWeight: '800', color: colors.textPrimary },
  weekDayDate: { fontSize: 11, color: colors.textMuted },
  weekVisit: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: colors.backgroundColor, borderRadius: 7, paddingHorizontal: 9, paddingVertical: 7 },
  weekVisitText: { flex: 1, fontSize: 12, color: colors.textPrimary, fontWeight: '600' },
  weekDayEmpty: { fontSize: 11, color: colors.textMuted },

  btnOutline: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.surface },
  btnOutlineText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  btnOutlineSm: { borderWidth: 1, borderColor: colors.border, borderRadius: 7, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: colors.surface },
  btnOutlineSmText: { fontSize: 11, color: colors.textSecondary, fontWeight: '700' },

  emptyText: { fontSize: 13, color: colors.textMuted, textAlign: 'center', paddingVertical: 14 },
  centered: { padding: 40, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText: { fontSize: 14, color: colors.danger, textAlign: 'center' },
});
