import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AppShell from '../../components/AppShell';
import { colors } from '../../constants/colors';
import { globalWidth } from '../../constants/globalWidth';
import {
  getMyTaskDashboard,
  getTeamTaskDashboard,
  listMyTasks,
  listTeamTasks,
} from '../../store/tasks/taskActions';
import CreateTaskModal from './CreateTaskModal';
import {
  dueLabel, fmtDate, isManagerRole, priorityStyle, statusStyle, typeStyle,
} from './taskUtils';

const shadow = { shadowColor: '#0B2B66', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } };
const PAD = globalWidth('1.2%');

const STATUS_FILTERS = ['', 'active', 'completed', 'cancelled'];
const TYPE_FILTERS = ['', 'checklist', 'recurring'];

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

function Badge({ s }) {
  return <View style={[styles.badge, { backgroundColor: s.bg }]}><Text style={[styles.badgeText, { color: s.text }]}>{s.label}</Text></View>;
}

export default function TasksScreen({ navigation, userDetails, appMetadata, onSignOut, route }) {
  const user = userDetails?.user || userDetails?.data?.user || userDetails || {};
  const token = userDetails?.token || userDetails?.data?.token || '';
  const manager = isManagerRole(user.role || '');
  const teamView = manager && route?.name === 'TeamTasks';

  const [tasks, setTasks] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const fetchTasks = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      setError('');
      const params = {};
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (typeFilter) params.taskType = typeFilter;
      if (teamView) {
        const [list, dash] = await Promise.all([listTeamTasks(token, params), getTeamTaskDashboard(token).catch(() => null)]);
        setTasks(list);
        setSummary(dash?.summaryCards || null);
      } else {
        const [list, dash] = await Promise.all([listMyTasks(token, params), getMyTaskDashboard(token).catch(() => null)]);
        setTasks(list);
        setSummary(dash || null);
      }
    } catch (err) {
      setError(err.message || 'Failed to load tasks.');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, teamView, token, typeFilter]);

  useEffect(() => {
    const t = setTimeout(fetchTasks, 300);
    return () => clearTimeout(t);
  }, [fetchTasks]);

  return (
    <AppShell navigation={navigation} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} activeRoute={teamView ? 'TeamTasks' : 'MyTasks'}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        <View style={styles.pageHeader}>
          <View>
            <Text style={styles.pageTitle}>{teamView ? 'Team Tasks' : 'My Tasks'}</Text>
            <Text style={styles.pageSubtitle}>{teamView ? 'Tasks across your team' : 'Tasks assigned to you'}</Text>
          </View>
          {!teamView ? (
            <Pressable style={styles.btnPrimary} onPress={() => setShowCreate(true)}>
              <Ionicons name="add" size={15} color="#fff" />
              <Text style={styles.btnPrimaryText}>Create Task</Text>
            </Pressable>
          ) : null}
        </View>

        {/* Summary cards */}
        {summary ? (
          <View style={styles.statsRow}>
            {teamView ? (
              <>
                <StatCard icon="albums-outline" iconColor="#1D4ED8" iconBg="#EFF6FF" label="Active Tasks" value={summary.activeTasks} />
                <StatCard icon="checkmark-circle-outline" iconColor="#15803D" iconBg="#F0FDF4" label="Completed" value={summary.completedTasks} />
                <StatCard icon="alert-circle-outline" iconColor="#DC2626" iconBg="#FEF2F2" label="Overdue" value={summary.overdueTasks} />
                <StatCard icon="repeat-outline" iconColor="#7C3AED" iconBg="#F5F3FF" label="Recurring Pending" value={summary.recurringPending} />
              </>
            ) : (
              <>
                <StatCard icon="albums-outline" iconColor="#1D4ED8" iconBg="#EFF6FF" label="Open Tasks" value={summary.openTasks} />
                <StatCard icon="alert-circle-outline" iconColor="#DC2626" iconBg="#FEF2F2" label="Overdue" value={summary.overdueTasks} />
                <StatCard icon="today-outline" iconColor="#B45309" iconBg="#FFFBEB" label="Due Today" value={summary.dueToday} />
                <StatCard icon="repeat-outline" iconColor="#7C3AED" iconBg="#F5F3FF" label="Recurring Pending" value={summary.recurringPending} />
              </>
            )}
          </View>
        ) : null}

        {/* Filters */}
        <View style={styles.filterBar}>
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={14} color={colors.textMuted} />
            <TextInput value={search} onChangeText={setSearch} placeholder="Search tasks…" placeholderTextColor={colors.textMuted} style={styles.searchInput} />
          </View>
          <View style={styles.chipRow}>
            {STATUS_FILTERS.map((s) => (
              <Pressable key={s || 'all'} style={[styles.chip, statusFilter === s && styles.chipActive]} onPress={() => setStatusFilter(s)}>
                <Text style={[styles.chipText, statusFilter === s && styles.chipTextActive]}>{s ? statusStyle(s).label : 'All Status'}</Text>
              </Pressable>
            ))}
            {TYPE_FILTERS.map((t) => (
              <Pressable key={t || 'allt'} style={[styles.chip, typeFilter === t && styles.chipActive]} onPress={() => setTypeFilter(t)}>
                <Text style={[styles.chipText, typeFilter === t && styles.chipTextActive]}>{t ? typeStyle(t).label : 'All Types'}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {loading ? (
          <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
        ) : error ? (
          <View style={styles.centered}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.btnOutline} onPress={fetchTasks}><Text style={styles.btnOutlineText}>Retry</Text></Pressable>
          </View>
        ) : !tasks.length ? (
          <View style={styles.card}><Text style={styles.emptyText}>{teamView ? 'No team tasks yet.' : 'No tasks assigned to you.'}</Text></View>
        ) : (
          <View style={styles.grid}>
            {tasks.map((task) => {
              const ty = typeStyle(task.taskType);
              const pr = priorityStyle(task.priority);
              const st = statusStyle(task.taskStatus);
              const overdue = task.daysRemaining != null && task.daysRemaining < 0 && task.taskStatus === 'active';
              return (
                <View key={String(task.taskId)} style={styles.taskCard}>
                  <View style={styles.taskTop}>
                    <Text style={styles.taskTitle} numberOfLines={2}>{task.title}</Text>
                  </View>
                  <View style={styles.taskBadges}>
                    <View style={[styles.badge, { backgroundColor: ty.bg }]}><Ionicons name={ty.icon} size={11} color={ty.text} /><Text style={[styles.badgeText, { color: ty.text, marginLeft: 3 }]}>{ty.label}</Text></View>
                    <Badge s={pr} />
                    <Badge s={st} />
                  </View>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${Math.min(task.overallProgressPercentage, 100)}%`, backgroundColor: task.overallProgressPercentage >= 100 ? '#16A34A' : colors.primary }]} />
                  </View>
                  <Text style={styles.progressLabel}>{task.overallProgressPercentage}% complete</Text>
                  <View style={styles.taskMeta}>
                    <Text style={[styles.metaText, overdue && { color: colors.danger, fontWeight: '700' }]}>
                      <Ionicons name="calendar-outline" size={11} color={overdue ? colors.danger : colors.textMuted} /> {fmtDate(task.dueDate)} · {dueLabel(task.daysRemaining)}
                    </Text>
                    <Text style={styles.metaText}><Ionicons name="people-outline" size={11} color={colors.textMuted} /> {task.assignedUsersCount}</Text>
                    <Text style={styles.metaText}><Ionicons name="chatbubble-outline" size={11} color={colors.textMuted} /> {task.commentsCount}</Text>
                  </View>
                  <Pressable style={styles.openBtn} onPress={() => navigation.navigate('TaskDashboard', { taskId: String(task.taskId) })}>
                    <Text style={styles.openBtnText}>Open Task</Text>
                    <Ionicons name="arrow-forward" size={13} color="#fff" />
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {showCreate ? (
        <CreateTaskModal
          token={token}
          isManager={manager}
          onClose={() => setShowCreate(false)}
          onCreated={(created) => { setShowCreate(false); fetchTasks(); const id = created?.taskId || created?._id; if (id) navigation.navigate('TaskDashboard', { taskId: String(id) }); }}
        />
      ) : null}
    </AppShell>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: PAD, gap: 14, paddingBottom: 48 },
  pageHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 },
  pageTitle: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  pageSubtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },

  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard: { flex: 1, minWidth: 150, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, ...shadow },
  statIcon: { width: 36, height: 36, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  statLabel: { fontSize: 11, color: colors.textSecondary, fontWeight: '600', marginBottom: 2 },
  statValue: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },

  filterBar: { gap: 10 },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, backgroundColor: colors.surface, minHeight: 38, maxWidth: 420 },
  searchInput: { flex: 1, fontSize: 12, color: colors.textPrimary, paddingVertical: 9 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: colors.surface },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 12, color: colors.textPrimary, fontWeight: '600' },
  chipTextActive: { color: '#fff' },

  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 16, ...shadow },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  taskCard: { flex: 1, minWidth: 280, maxWidth: 400, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, gap: 9, ...shadow },
  taskTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  taskTitle: { flex: 1, fontSize: 14, fontWeight: '800', color: colors.textPrimary },
  taskBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeText: { fontSize: 10.5, fontWeight: '700' },
  progressTrack: { height: 7, backgroundColor: colors.border + '90', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: 7, borderRadius: 4 },
  progressLabel: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },
  taskMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metaText: { fontSize: 11, color: colors.textMuted, fontWeight: '600' },
  openBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.primary, borderRadius: 8, paddingVertical: 9 },
  openBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  btnPrimary: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8 },
  btnPrimaryText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  btnOutline: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.surface },
  btnOutlineText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },

  emptyText: { fontSize: 13, color: colors.textMuted, textAlign: 'center', paddingVertical: 14 },
  centered: { padding: 50, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText: { fontSize: 14, color: colors.danger, textAlign: 'center' },
});
