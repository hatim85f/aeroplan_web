import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AppShell from '../../components/AppShell';
import { colors } from '../../constants/colors';
import { globalWidth } from '../../constants/globalWidth';
import { getTaskReport } from '../../store/tasks/taskActions';
import { fmtDate, priorityStyle, statusStyle, typeStyle } from './taskUtils';

const shadow = { shadowColor: '#0B2B66', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } };
const PAD = globalWidth('1.2%');

function StatCard({ icon, iconBg, iconColor, label, value }) {
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

export default function TaskReportsScreen({ navigation, userDetails, appMetadata, onSignOut }) {
  const token = userDetails?.token || userDetails?.data?.token || '';
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      setError('');
      setReport(await getTaskReport(token));
    } catch (err) {
      setError(err.message || 'Failed to load report.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const summary = report?.summary || {};
  const rows = report?.tasks || [];

  return (
    <AppShell navigation={navigation} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} activeRoute="TaskReports">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.pageHeader}>
          <View>
            <Text style={styles.pageTitle}>Task Reports</Text>
            <Text style={styles.pageSubtitle}>Progress overview across your team's tasks</Text>
          </View>
          <Pressable style={styles.btnOutline} onPress={load}><Ionicons name="refresh" size={14} color={colors.textSecondary} /><Text style={styles.btnOutlineText}>Refresh</Text></Pressable>
        </View>

        {loading ? (
          <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
        ) : error ? (
          <View style={styles.centered}><Text style={styles.errorText}>{error}</Text><Pressable style={styles.btnOutline} onPress={load}><Text style={styles.btnOutlineText}>Retry</Text></Pressable></View>
        ) : (
          <>
            <View style={styles.statsRow}>
              <StatCard icon="layers-outline" iconBg="#EFF6FF" iconColor="#1D4ED8" label="Total Tasks" value={summary.totalTasks} />
              <StatCard icon="play-circle-outline" iconBg="#ECFEFF" iconColor="#0E7490" label="Active" value={summary.activeTasks} />
              <StatCard icon="checkmark-done-outline" iconBg="#F0FDF4" iconColor="#15803D" label="Completed" value={summary.completedTasks} />
              <StatCard icon="alert-circle-outline" iconBg="#FEF2F2" iconColor="#DC2626" label="Overdue" value={summary.overdueTasks} />
              <StatCard icon="speedometer-outline" iconBg="#F5F3FF" iconColor="#7C3AED" label="Avg Progress" value={summary.averageProgress != null ? `${summary.averageProgress}%` : '—'} />
            </View>

            <View style={styles.tableCard}>
              <Text style={styles.cardTitle}>All Tasks</Text>
              <View style={styles.tableHead}>
                <Text style={[styles.th, { flex: 2.4 }]}>Task</Text>
                <Text style={[styles.th, { flex: 1 }]}>Type</Text>
                <Text style={[styles.th, { flex: 1 }]}>Priority</Text>
                <Text style={[styles.th, { flex: 1 }]}>Status</Text>
                <Text style={[styles.th, { flex: 1.4 }]}>Progress</Text>
                <Text style={[styles.th, { flex: 1.2 }]}>Due</Text>
              </View>
              {rows.length ? rows.map((t) => {
                const ty = typeStyle(t.taskType);
                const pr = priorityStyle(t.priority);
                const st = statusStyle(t.taskStatus);
                return (
                  <Pressable key={String(t.taskId)} style={styles.tableRow} onPress={() => navigation.navigate('TaskDashboard', { taskId: t.taskId })}>
                    <View style={{ flex: 2.4 }}>
                      <Text style={styles.taskName} numberOfLines={1}>{t.title}</Text>
                      <Text style={styles.taskMeta}>{t.assignedUsersCount} assignee{t.assignedUsersCount === 1 ? '' : 's'}</Text>
                    </View>
                    <View style={{ flex: 1 }}><View style={[styles.badge, { backgroundColor: ty.bg }]}><Text style={[styles.badgeText, { color: ty.text }]}>{ty.label}</Text></View></View>
                    <View style={{ flex: 1 }}><View style={[styles.badge, { backgroundColor: pr.bg }]}><Text style={[styles.badgeText, { color: pr.text }]}>{pr.label}</Text></View></View>
                    <View style={{ flex: 1 }}><View style={[styles.badge, { backgroundColor: st.bg }]}><Text style={[styles.badgeText, { color: st.text }]}>{st.label}</Text></View></View>
                    <View style={{ flex: 1.4 }}>
                      <View style={styles.progressTrackSm}><View style={[styles.progressFillSm, { width: `${Math.min(t.overallProgressPercentage || 0, 100)}%`, backgroundColor: (t.overallProgressPercentage || 0) >= 100 ? '#16A34A' : colors.primary }]} /></View>
                      <Text style={styles.taskMeta}>{t.overallProgressPercentage || 0}%</Text>
                    </View>
                    <Text style={[styles.td, { flex: 1.2 }]}>{fmtDate(t.dueDate)}</Text>
                  </Pressable>
                );
              }) : <Text style={styles.emptyText}>No tasks to report yet.</Text>}
            </View>
          </>
        )}
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: PAD, gap: 16, paddingBottom: 48 },
  pageHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pageTitle: { fontSize: 22, fontWeight: '800', color: colors.textPrimary },
  pageSubtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },

  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard: { flex: 1, minWidth: 150, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, ...shadow },
  statIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  statLabel: { fontSize: 11, color: colors.textSecondary, fontWeight: '600', marginBottom: 2 },
  statValue: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },

  tableCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 16, gap: 6, ...shadow },
  cardTitle: { fontSize: 15, fontWeight: '800', color: colors.textPrimary, marginBottom: 8 },
  tableHead: { flexDirection: 'row', paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 8 },
  th: { fontSize: 11, fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase' },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: colors.border + '70', gap: 8 },
  taskName: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  taskMeta: { fontSize: 10.5, color: colors.textMuted, fontWeight: '600', marginTop: 2 },
  td: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeText: { fontSize: 10.5, fontWeight: '700' },
  progressTrackSm: { height: 6, backgroundColor: colors.border + '90', borderRadius: 3, overflow: 'hidden' },
  progressFillSm: { height: 6, borderRadius: 3 },

  btnOutline: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.surface },
  btnOutlineText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  centered: { padding: 60, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText: { fontSize: 14, color: colors.danger, textAlign: 'center' },
  emptyText: { fontSize: 13, color: colors.textMuted, textAlign: 'center', paddingVertical: 20 },
});
