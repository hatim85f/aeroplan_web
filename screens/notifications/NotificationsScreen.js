import React, { useState, useEffect, useCallback } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AppShell from '../../components/AppShell';
import { colors } from '../../constants/colors';
import { globalHeight, globalWidth } from '../../constants/globalWidth';
import { getNotifications, markNotificationOpened } from '../../store/notifications/notificationActions';

const shadow = { shadowColor: '#11224A', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 14, elevation: 3 };
const PAD = globalWidth('1.2%');

// Routes that exist in MainNavigator — guard against bad routeName payloads.
const VALID_ROUTES = new Set([
  'Home', 'Accounts', 'AccountDetail', 'Lines', 'Teams', 'Profile', 'Products',
  'SalesChannels', 'SalesTeam', 'Orders', 'CreateOrder', 'OrderDetails', 'OrderHistory',
  'SalesOverview', 'SalesRecords', 'SalesTable', 'TargetDashboard', 'MyTargetDashboard',
  'TargetAssignments', 'TargetPhasing', 'ForecastTeam', 'MyForecast', 'ForecastMatching',
  'Achievement', 'RepCoverage', 'StockAccounts', 'PlanningCalendar', 'PlanningAccounts',
  'PlanningDashboard', 'PlanningReports', 'MyTasks', 'TeamTasks', 'TaskDashboard',
  'TaskReports', 'Notifications',
]);

// Pick a category icon + tinted background per notification, based on its
// payload.category (set by the backend) with a route/title fallback. Mirrors
// the mobile notifications palette so the two clients look consistent.
const resolveVisual = (item) => {
  const cat = String(item?.payload?.category || item?.category || '').toLowerCase();
  const hay = `${cat} ${String(item?.routeName || '')} ${String(item?.title || '')}`.toLowerCase();
  const A = colors.accents;
  if (hay.includes('task')) return { bg: A.purple.bg, fg: A.purple.chip, icon: 'checkbox-outline' };
  if (hay.includes('order')) return { bg: A.amber.bg, fg: A.amber.chip, icon: 'cart-outline' };
  if (hay.includes('forecast')) return { bg: A.teal.bg, fg: A.teal.chip, icon: 'stats-chart-outline' };
  if (hay.includes('sale')) return { bg: A.rose.bg, fg: A.rose.chip, icon: 'bar-chart-outline' };
  if (hay.includes('plan') || hay.includes('calendar') || hay.includes('visit')) {
    return { bg: A.blue.bg, fg: A.blue.chip, icon: 'calendar-outline' };
  }
  if (hay.includes('stock') || hay.includes('low') || hay.includes('alert')) {
    return { bg: colors.dangerLight, fg: colors.danger, icon: 'cube-outline' };
  }
  return { bg: A.gray.bg, fg: A.gray.chip, icon: 'notifications-outline' };
};

const relTime = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
};

const tsOf = (n) => {
  const t = n?.createdAt || n?.timeStamp;
  const d = t ? new Date(t).getTime() : 0;
  return Number.isNaN(d) ? 0 : d;
};

export default function NotificationsScreen({ navigation, userDetails, appMetadata, onSignOut }) {
  const token = userDetails?.token || userDetails?.data?.token || '';
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    try {
      setLoading(true);
      setError('');
      const data = await getNotifications(token);
      const sorted = (Array.isArray(data) ? data : []).slice().sort((a, b) => tsOf(b) - tsOf(a));
      setItems(sorted);
    } catch (err) {
      setError(err.message || 'Failed to load notifications.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const onPressRow = useCallback(async (n) => {
    // Optimistically mark opened in local state.
    if (!n.isOpened) {
      setItems((prev) => prev.map((x) => (x._id === n._id ? { ...x, isOpened: true } : x)));
      markNotificationOpened(token, n._id).catch(() => {});
    }
    if (n.routeName && VALID_ROUTES.has(n.routeName)) {
      navigation.navigate(n.routeName, n.payload || {});
    }
  }, [token, navigation]);

  const unread = items.filter((n) => !n.isOpened).length;

  return (
    <AppShell navigation={navigation} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} activeRoute="Notifications">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.pageHeader}>
          <View>
            <Text style={styles.pageTitle}>Notifications</Text>
            <Text style={styles.pageSubtitle}>
              {unread > 0 ? `${unread} unread notification${unread === 1 ? '' : 's'}` : 'You are all caught up'}
            </Text>
          </View>
          <Pressable style={styles.btnOutline} onPress={load}>
            <Ionicons name="refresh" size={14} color={colors.textSecondary} />
            <Text style={styles.btnOutlineText}>Reload</Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.centered}><ActivityIndicator size="large" color={colors.primary} /></View>
        ) : error ? (
          <View style={styles.centered}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.btnOutline} onPress={load}><Text style={styles.btnOutlineText}>Retry</Text></Pressable>
          </View>
        ) : !items.length ? (
          <View style={styles.emptyCard}>
            <Ionicons name="notifications-off-outline" size={40} color={colors.textMuted} />
            <Text style={styles.emptyText}>No notifications yet.</Text>
          </View>
        ) : (
          <View style={styles.listCard}>
            {items.map((n, i) => {
              const unreadRow = !n.isOpened;
              const visual = resolveVisual(n);
              return (
                <Pressable
                  key={n._id || i}
                  onPress={() => onPressRow(n)}
                  style={[styles.row, unreadRow && styles.rowUnread, i === items.length - 1 && styles.rowLast]}
                >
                  <View style={[styles.iconBox, { backgroundColor: visual.bg }]}>
                    <Ionicons name={visual.icon} size={16} color={visual.fg} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle} numberOfLines={1}>{n.title || 'Notification'}</Text>
                    {!!n.subtitle && <Text style={styles.rowSub} numberOfLines={2}>{n.subtitle}</Text>}
                  </View>
                  <View style={styles.rowRight}>
                    <Text style={styles.rowTime}>{relTime(n.createdAt || n.timeStamp)}</Text>
                    {unreadRow && <View style={styles.dot} />}
                  </View>
                </Pressable>
              );
            })}
          </View>
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

  listCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14, overflow: 'hidden', ...shadow },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: colors.border + '80',
  },
  rowLast: { borderBottomWidth: 0 },
  rowUnread: { backgroundColor: colors.surfaceSoft },
  iconBox: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  iconBoxUnread: { backgroundColor: colors.primaryLight },
  iconBoxRead: { backgroundColor: colors.backgroundColor },
  rowTitle: { fontSize: 13.5, fontWeight: '700', color: colors.textPrimary },
  rowSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  rowRight: { alignItems: 'flex-end', gap: 6, minWidth: 60 },
  rowTime: { fontSize: 11, color: colors.textMuted, fontWeight: '600' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },

  emptyCard: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14,
    paddingVertical: globalHeight('8%'), alignItems: 'center', justifyContent: 'center', gap: 12, ...shadow,
  },
  emptyText: { fontSize: 14, color: colors.textMuted, fontWeight: '600' },

  btnOutline: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.surface },
  btnOutlineText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  centered: { padding: 60, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText: { fontSize: 14, color: colors.danger, textAlign: 'center' },
});
