import React, { useState, useEffect, useCallback } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  Pressable, ScrollView,
  StyleSheet, Text, View,
} from 'react-native';
import Svg, {
  Rect,
  Line as SvgLine, Text as SvgText,
} from 'react-native-svg';

import { colors } from '../../constants/colors';
import { globalHeight, globalWidth } from '../../constants/globalWidth';
import { getProfilePicture } from '../../constants/profile';
import { canManageStructure } from '../../constants/roles';
import AppSidebar from '../../components/AppSidebar';
import AppTopBar from '../../components/AppTopBar';
import { getSalesOverview } from '../../store/sales/salesActions';
import { getMyForecast, getTeamForecasts } from '../../store/forecasts/forecastActions';
import { getMyAchievement, getTeamAchievement } from '../../store/achievements/achievementActions';
import { getManagerDashboard, getMyCalendar } from '../../store/planning/planningActions';
import { getNotifications } from '../../store/notifications/notificationActions';

const QUICK_ACTIONS = [
  { icon: 'cart', label: 'Add Order', color: '#F97316', bg: '#FFF4EE', action: 'addOrder' },
  { icon: 'stats-chart', label: 'Modify Forecast', color: '#0F6FFF', bg: '#EEF4FF', action: 'forecast' },
  { icon: 'calendar', label: 'New Daily Plan', color: '#8B5CF6', bg: '#F3EEFF', action: 'plan' },
  { icon: 'document-text', label: 'Check Sales\nDetails', color: '#0F6FFF', bg: '#EEF4FF', action: 'sales' },
];

const STATUS_COLORS = ['#8B5CF6', '#1677FF', '#22C55E', '#F97316', '#0F6FFF', '#6B46FF'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/* ─── Helpers ─────────────────────────────────────────────────────────── */

const fmtMoney = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('en-US');

const num = (n) => Number(n) || 0;

const initialsOf = (name) =>
  String(name || '?')
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?';

const statusPill = (planStatus) => {
  const s = String(planStatus || '').toLowerCase();
  if (s === 'submitted') return { label: 'Submitted', style: 'statusGreen' };
  if (s === 'draft') return { label: 'Draft', style: 'statusBlue' };
  return { label: planStatus ? String(planStatus) : 'Planned', style: 'statusGray' };
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

/* ─── Root ────────────────────────────────────────────────────────────── */

export default function HomeScreen({ navigation, userDetails, appMetadata, onSignOut }) {
  const user = userDetails?.user || userDetails?.data?.user || userDetails || {};
  const token = userDetails?.token || userDetails?.data?.token || '';
  const displayName = user.displayName || user.fullName || user.name || user.userName || 'Ahmed Hassan';
  const role = user.role || user.title || 'Medical Representative';
  const profilePicture = getProfilePicture(user);
  const isManager = canManageStructure(user);

  const [loading, setLoading] = useState(true);
  const [salesValue, setSalesValue] = useState(0);
  const [forecastValue, setForecastValue] = useState(0);
  const [achievement, setAchievement] = useState(null);
  const [planRows, setPlanRows] = useState([]);
  const [accountsToVisit, setAccountsToVisit] = useState(0);
  const [trend, setTrend] = useState([]);
  const [teamRows, setTeamRows] = useState([]);
  const [notifications, setNotifications] = useState([]);

  const load = useCallback(async () => {
    if (!token) { setLoading(false); return; }
    setLoading(true);

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const todayISO = `${year}-${String(month).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const overviewP = getSalesOverview(token, { year, month });
    const forecastP = isManager
      ? getTeamForecasts(token, { year, month })
      : getMyForecast(token, { year, month });
    const achievementP = isManager
      ? getTeamAchievement(token, { year, month })
      : getMyAchievement(token, { year, month });
    const planP = isManager
      ? getManagerDashboard(token, { date: todayISO })
      : getMyCalendar(token, { startDate: todayISO, endDate: todayISO });
    const notifP = getNotifications(token);

    // Build last-6-months sales series requests.
    const trendReqs = [];
    for (let i = 5; i >= 0; i -= 1) {
      const dt = new Date(year, month - 1 - i, 1);
      const Y = dt.getFullYear();
      const M = dt.getMonth() + 1;
      trendReqs.push({ Y, M, label: MONTH_SHORT[dt.getMonth()] });
    }
    const trendP = Promise.all(
      trendReqs.map((r) =>
        getSalesOverview(token, { year: r.Y, month: r.M })
          .then((o) => ({ label: r.label, v: num(o?.totalCalculatedCifUsd) }))
          .catch(() => ({ label: r.label, v: 0 }))
      )
    );

    const [overviewR, forecastR, achievementR, planR, notifR, trendR] = await Promise.allSettled([
      overviewP, forecastP, achievementP, planP, notifP, trendP,
    ]);

    // MTD Sales — prefer the role-attributed achievement sales value (rep = own share,
    // manager = their team). Fall back to the raw sales-overview total if achievement is unavailable.
    if (achievementR.status === 'fulfilled' && achievementR.value?.summaryCards?.monthlySalesValue != null) {
      setSalesValue(num(achievementR.value.summaryCards.monthlySalesValue));
    } else if (overviewR.status === 'fulfilled') {
      setSalesValue(num(overviewR.value?.totalCalculatedCifUsd));
    }

    // Forecast (getMyForecast/getTeamForecasts may return the raw envelope)
    if (forecastR.status === 'fulfilled') {
      const f = forecastR.value?.data ?? forecastR.value ?? {};
      setForecastValue(num(
        f.totalForecastValue ?? f.totalMonthlyTargetValue ?? f.summaryCards?.forecastValue ?? 0
      ));
    }

    // Achievement (+ team rows for manager)
    if (achievementR.status === 'fulfilled') {
      const a = achievementR.value || {};
      setAchievement(a);
      if (isManager && Array.isArray(a.reps)) {
        const rows = a.reps
          .map((r) => ({
            name: r.userName || 'Rep',
            role: 'Representative',
            score: Math.round(num(r.monthlyAchievementPercentage)),
          }))
          .sort((x, y) => y.score - x.score);
        setTeamRows(rows);
      }
    }

    // Today's plan + accounts-to-visit
    if (planR.status === 'fulfilled') {
      const p = planR.value || {};
      if (isManager) {
        const rows = [];
        (p.reps || []).forEach((rep) => {
          if (num(rep.visitsCount) > 0) {
            (rep.visits || []).forEach((v) => {
              rows.push({
                accountName: v.accountName || 'Account',
                person: rep.userName || '',
                status: v.planStatus,
              });
            });
          }
        });
        // Sort by rep name, then account name, for a clean grouped list.
        rows.sort((x, y) => (x.person || '').localeCompare(y.person || '')
          || (x.accountName || '').localeCompare(y.accountName || ''));
        setPlanRows(rows);
        setAccountsToVisit(num(p.summaryCards?.totalVisits));
      } else {
        const visits = Array.isArray(p.visits) ? p.visits : [];
        const rows = visits.map((v) => ({
          accountName: v.accountName || 'Account',
          status: v.planStatus,
        })).sort((x, y) => (x.accountName || '').localeCompare(y.accountName || ''));
        setPlanRows(rows);
        setAccountsToVisit(visits.length);
      }
    }

    // Notifications
    if (notifR.status === 'fulfilled') {
      setNotifications(Array.isArray(notifR.value) ? notifR.value : []);
    }

    // Sales trend
    if (trendR.status === 'fulfilled') {
      setTrend(Array.isArray(trendR.value) ? trendR.value : []);
    }

    setLoading(false);
  }, [token, isManager]);

  useEffect(() => { load(); }, [load]);

  const goPlanning = () => navigation.navigate('PlanningCalendar');

  const onQuickAction = (action) => {
    if (action === 'addOrder') navigation.navigate('CreateOrder');
    else if (action === 'forecast') navigation.navigate(isManager ? 'ForecastTeam' : 'MyForecast');
    else if (action === 'plan') navigation.navigate('PlanningCalendar');
    else if (action === 'sales') navigation.navigate('SalesOverview');
  };

  const summaryCards = achievement?.summaryCards || {};
  const achPct = Math.round(num(summaryCards.monthlyAchievementPercentage));
  const achTargetSub = summaryCards.monthlyTargetValue != null
    ? `vs Target ${fmtMoney(summaryCards.monthlyTargetValue)}`
    : 'vs Target';

  const recentActivity = notifications.slice(0, 3);
  const unreadCount = notifications.filter((n) => !n.isOpened).length;

  return (
    <View style={styles.shell}>
      <AppSidebar
        onSignOut={onSignOut}
        appMetadata={appMetadata}
        displayName={displayName}
        role={role}
        picture={profilePicture}
        activeRoute="Home"
      />
      <View style={styles.main}>
        <AppTopBar displayName={displayName} role={role} picture={profilePicture} pendingCount={0} />
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false}>

          {/* ── Greeting ─────────────────────────────────────────────── */}
          <View style={styles.greeting}>
            <Text style={styles.greetingTitle}>Good Morning, {displayName}</Text>
            <Text style={styles.greetingText}>Ready to plan your sales day?</Text>
          </View>

          {/* ── Hero Row ─────────────────────────────────────────────── */}
          <View style={styles.heroRow}>
            <View style={styles.aiCard}>
              <View style={styles.heroOrb} />
              <View style={styles.heroOrb2} />
              <View style={styles.aiContent}>
                <Text style={styles.aiTitle}>AI sales plan</Text>
                <Text style={styles.aiBody}>
                  {accountsToVisit} {accountsToVisit === 1 ? 'account' : 'accounts'} to visit today. Start with your priority accounts.
                </Text>
                <Pressable style={styles.aiBtn} onPress={goPlanning}>
                  <Text style={styles.aiBtnText}>View plan</Text>
                </Pressable>
              </View>
            </View>

            <MetricCard accent={colors.accents.blue} icon="cash-outline"     title="MTD Sales"        value={loading ? '—' : fmtMoney(salesValue)}    sub="This Month" />
            <MetricCard accent={colors.accents.teal} icon="bar-chart-outline" title="Forecast"         value={loading ? '—' : fmtMoney(forecastValue)} sub="This Month" />
            <MetricCard accent={colors.accents.rose} icon="disc-outline"      title="MTD Achievement"  value={loading ? '—' : `${achPct}%`}            sub={achTargetSub} />
            <MetricCard accent={colors.accents.amber} icon="calendar-outline"  title="Accounts to Visit" value={loading ? '—' : String(accountsToVisit)} sub="Planned Today" link="View Accounts" onLinkPress={goPlanning} />
          </View>

          {/* ── Body ─────────────────────────────────────────────────── */}
          <View style={styles.bodyGrid}>

            {/* Left column */}
            <View style={styles.leftCol}>
              <Panel
                title="Today's Plan"
                action={<Text style={styles.link} onPress={goPlanning}>View All</Text>}
              >
                <PlanTable rows={planRows} isManager={isManager} loading={loading} onAction={goPlanning} />
              </Panel>

              <View style={styles.lowerRow}>
                <Panel title="Quick Actions" style={styles.qaPanel}>
                  <View style={styles.qaGrid}>
                    {QUICK_ACTIONS.map((a) => (
                      <Pressable key={a.label} style={styles.qaItem} onPress={() => onQuickAction(a.action)}>
                        <View style={[styles.qaIconBox, { backgroundColor: a.bg }]}>
                          <Ionicons name={a.icon} size={globalWidth('1.3%')} color={a.color} />
                        </View>
                        <Text style={styles.qaLabel}>{a.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                </Panel>

                <Panel
                  title="Recent Activity"
                  action={<Text style={styles.link} onPress={() => navigation.navigate('Notifications')}>View All</Text>}
                  style={styles.raPanel}
                >
                  <View style={styles.activityList}>
                    {recentActivity.length ? recentActivity.map((r) => (
                      <View key={r._id || r.title} style={styles.activityRow}>
                        <Ionicons
                          name={r.isOpened ? 'notifications-outline' : 'notifications'}
                          size={globalWidth('1.1%')}
                          color={r.isOpened ? colors.textSecondary : colors.primary}
                        />
                        <View style={styles.activityCopy}>
                          <Text style={styles.activityTitle} numberOfLines={1}>{r.title || 'Notification'}</Text>
                          {!!r.subtitle && <Text style={styles.activitySub} numberOfLines={1}>{r.subtitle}</Text>}
                        </View>
                        <Text style={styles.activityTime}>{relTime(r.timeStamp || r.createdAt)}</Text>
                      </View>
                    )) : (
                      <Text style={styles.emptyText}>No recent activity.</Text>
                    )}
                  </View>
                </Panel>
              </View>
            </View>

            {/* Right column */}
            <View style={styles.rightCol}>
              <Panel
                title="Sales Trend (6 Months)"
                action={
                  <View style={styles.trendActions}>
                    <View style={styles.monthPill}>
                      <Text style={styles.monthPillText}>Last 6 Months</Text>
                    </View>
                  </View>
                }
              >
                <SalesTrendChart data={trend} />
              </Panel>

              {isManager ? (
                <Panel
                  title="Team Performance"
                  action={<Text style={styles.link} onPress={() => navigation.navigate('Achievement')}>View All</Text>}
                >
                  {teamRows.length ? (
                    <>
                      {teamRows.slice(0, 5).map((m, i) => <TeamRow key={m.name + i} member={m} index={i} />)}
                      {teamRows.length > 5 && (
                        <View style={styles.moreRow}>
                          <Text style={styles.moreText}>+{teamRows.length - 5} more team members</Text>
                          <Text style={styles.link} onPress={() => navigation.navigate('Achievement')}>View All</Text>
                        </View>
                      )}
                    </>
                  ) : (
                    <Text style={styles.emptyText}>{loading ? 'Loading…' : 'No team data yet.'}</Text>
                  )}
                </Panel>
              ) : (
                <Panel
                  title="Your Achievement"
                  action={<Text style={styles.link} onPress={() => navigation.navigate('Achievement')}>View All</Text>}
                >
                  <View style={styles.achWrap}>
                    <Text style={styles.achBig}>{loading ? '—' : `${achPct}%`}</Text>
                    <Text style={styles.achCaption}>Monthly Achievement</Text>
                    <View style={styles.achRow}>
                      <View style={styles.achStat}>
                        <Text style={styles.achStatLabel}>Target</Text>
                        <Text style={styles.achStatValue}>{fmtMoney(summaryCards.monthlyTargetValue)}</Text>
                      </View>
                      <View style={styles.achStat}>
                        <Text style={styles.achStatLabel}>Sales</Text>
                        <Text style={styles.achStatValue}>{fmtMoney(summaryCards.monthlySalesValue)}</Text>
                      </View>
                    </View>
                  </View>
                </Panel>
              )}
            </View>

          </View>
        </ScrollView>
        <BottomNav navigation={navigation} unreadCount={unreadCount} />
      </View>
    </View>
  );
}

/* ─── MetricCard ──────────────────────────────────────────────────────── */

function MetricCard({ accent, icon, title, value, sub, trend, link, onLinkPress }) {
  const a = accent || colors.accents.blue;
  return (
    <View style={[styles.metricCard, { backgroundColor: a.bg, borderColor: a.border }]}>
      <View style={[styles.metricIconBox, { backgroundColor: a.chip }]}>
        <Ionicons name={icon} size={globalWidth('1.05%')} color="#fff" />
      </View>
      <Text style={[styles.metricTitle, { color: a.label }]}>{title}</Text>
      <Text style={[styles.metricValue, { color: a.value }]}>{value}</Text>
      <Text style={[styles.metricSub, { color: a.label }]}>{sub}</Text>
      {trend && <Text style={styles.metricTrend}>{trend}</Text>}
      {link && <Text style={[styles.metricLink, { color: a.chip }]} onPress={onLinkPress}>{link}</Text>}
    </View>
  );
}

/* ─── Panel wrapper ───────────────────────────────────────────────────── */

function Panel({ title, action, children, style }) {
  return (
    <View style={[styles.panel, style]}>
      <View style={styles.panelHeader}>
        <Text style={styles.panelTitle}>{title}</Text>
        {action}
      </View>
      {children}
    </View>
  );
}

/* ─── Plan Table ──────────────────────────────────────────────────────── */

function PlanTable({ rows = [], isManager = false, loading = false, onAction }) {
  return (
    <View style={styles.table}>
      {/* Header */}
      <View style={styles.tableHead}>
        <Text style={[styles.headCell, styles.colAccount]}>Account{isManager ? ' / Rep' : ''}</Text>
        <Text style={[styles.headCell, styles.colStatus]}>Status</Text>
        <Text style={[styles.headCell, styles.colAction]}>Action</Text>
      </View>

      {!rows.length ? (
        <View style={styles.tableRow}>
          <Text style={styles.emptyText}>
            {loading ? 'Loading…' : 'No visits planned for today.'}
          </Text>
        </View>
      ) : rows.map((row, i) => {
        const pill = statusPill(row.status);
        return (
          <View key={`${row.accountName}-${i}`} style={styles.tableRow}>
            {/* Account */}
            <View style={[styles.rowCell, styles.colAccount]}>
              <View style={[styles.accountCircle, { backgroundColor: STATUS_COLORS[i % STATUS_COLORS.length] }]}>
                <Text style={styles.accountInitials}>{initialsOf(row.accountName)}</Text>
              </View>
              <View style={{ flexShrink: 1 }}>
                <Text style={styles.accountName} numberOfLines={1}>{row.accountName}</Text>
                {isManager && !!row.person && <Text style={styles.accountSub} numberOfLines={1}>{row.person}</Text>}
              </View>
            </View>

            {/* Status */}
            <View style={[styles.rowCell, styles.colStatus]}>
              <Text style={[styles.statusPill, styles[pill.style]]}>{pill.label}</Text>
            </View>

            {/* Action */}
            <View style={[styles.rowCellInline, styles.colAction]}>
              <Pressable style={styles.btnOutline} onPress={onAction}>
                <Text style={styles.btnOutlineText}>View Plan</Text>
              </Pressable>
            </View>
          </View>
        );
      })}
    </View>
  );
}

/* ─── Sales Trend SVG Chart ───────────────────────────────────────────── */

// Round a value up to a "nice" axis maximum.
function niceMax(v) {
  if (!v || v <= 0) return 10;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const r = v / pow;
  let mult = 1;
  if (r <= 1) mult = 1;
  else if (r <= 2) mult = 2;
  else if (r <= 5) mult = 5;
  else mult = 10;
  return mult * pow;
}

// Compact axis label: 18450 -> $18k, 950 -> $950.
function axisLabel(v) {
  if (v >= 1000) return `$${Math.round(v / 1000)}k`;
  return `$${Math.round(v)}`;
}

function SalesTrendChart({ data = [] }) {
  const [cw, setCw] = useState(0);
  const totalH = globalHeight('17%');
  const PL = 36, PR = 10, PT = 26, PB = 22;
  const chartW = Math.max(cw - PL - PR, 0);
  const chartH = Math.max(totalH - PT - PB, 0);

  const points = data.length ? data : [];
  const rawMax = points.reduce((m, d) => Math.max(m, num(d.v)), 0);
  const MAX = niceMax(rawMax) || 10;
  const n = points.length;

  // Inactive bars stay muted; the current month is the accent.
  const inactiveBar = colors.surfaceSoft;
  const baselineY = PT + chartH;

  // Highlight the current month — always the last point in the 6-month series.
  const currentIdx = n - 1;

  // Bar geometry: evenly distribute n bars across the plot width.
  const slot = n > 0 ? chartW / n : chartW;
  const barW = Math.max(Math.min(slot * 0.55, 26), 6);

  const bars = points.map((d, i) => {
    const v = num(d.v);
    const h = MAX > 0 ? (v / MAX) * chartH : 0;
    const cx = PL + slot * i + slot / 2;
    return {
      x: cx - barW / 2,
      y: baselineY - h,
      h,
      barW,
      cx,
      label: d.label,
      v,
      active: i === currentIdx,
    };
  });

  const yTicks = [MAX, MAX * 0.66, MAX * 0.33, 0];

  return (
    <View onLayout={(e) => setCw(e.nativeEvent.layout.width)} style={{ height: totalH }}>
      {cw > 0 && n > 0 && (
        <Svg width={cw} height={totalH}>
          {/* Y-axis gridlines + value labels */}
          {yTicks.map((val) => {
            const gy = PT + (1 - val / MAX) * chartH;
            return (
              <React.Fragment key={val}>
                <SvgLine
                  x1={PL} y1={gy} x2={PL + chartW} y2={gy}
                  stroke={colors.border} strokeWidth={val === 0 ? 1 : 0.8}
                />
                <SvgText
                  x={PL - 4} y={gy + 3.5}
                  fontSize={8} fill={colors.textMuted} textAnchor="end"
                >
                  {axisLabel(val)}
                </SvgText>
              </React.Fragment>
            );
          })}

          {/* Bars */}
          {bars.map((b, i) => (
            <Rect
              key={`bar-${b.label}-${i}`}
              x={b.x} y={b.y}
              width={b.barW} height={Math.max(b.h, 0)}
              rx={5} ry={5}
              fill={b.active ? colors.primary : inactiveBar}
            />
          ))}

          {/* Value label above each bar */}
          {bars.map((b, i) => (
            b.v > 0 ? (
              <SvgText
                key={`val-${b.label}-${i}`}
                x={b.cx} y={Math.max(b.y - 5, PT - 6)}
                fontSize={7.5}
                fill={b.active ? colors.primary : colors.textMuted}
                textAnchor="middle" fontWeight={b.active ? 'bold' : 'normal'}
              >
                {axisLabel(b.v)}
              </SvgText>
            ) : null
          ))}

          {/* X-axis month labels */}
          {bars.map((b, i) => (
            <SvgText
              key={`lbl-${b.label}-${i}`}
              x={b.cx} y={totalH - 5}
              fontSize={7.5} fill={colors.textMuted} textAnchor="middle"
            >
              {b.label}
            </SvgText>
          ))}
        </Svg>
      )}
    </View>
  );
}

/* ─── Team Row ────────────────────────────────────────────────────────── */

const AVATAR_COLORS = ['#8B5CF6', '#0F6FFF', '#F97316'];

function TeamRow({ member, index = 0 }) {
  const { name, role, score } = member;
  const initials = initialsOf(name);
  const avatarBg = AVATAR_COLORS[index % AVATAR_COLORS.length] || colors.primary;
  const pct = Math.max(0, Math.min(100, num(score)));

  return (
    <View style={styles.teamRow}>
      <View style={[styles.teamAvatar, { backgroundColor: avatarBg + '22' }]}>
        <Text style={[styles.teamAvatarText, { color: avatarBg }]}>{initials}</Text>
      </View>
      <View style={styles.teamInfo}>
        <Text style={styles.teamName} numberOfLines={1}>{name}</Text>
        <Text style={styles.teamRole} numberOfLines={1}>{role}</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${pct}%` }]} />
      </View>
      <Text style={styles.scoreText}>{Math.round(num(score))}%</Text>
    </View>
  );
}

/* ─── Bottom Nav ──────────────────────────────────────────────────────── */

function BottomNav({ navigation, unreadCount = 0 }) {
  const items = [
    { icon: 'home', label: 'Home', route: 'Home', active: true },
    { icon: 'calendar-outline', label: 'Planning', route: 'PlanningCalendar' },
    { icon: 'checkbox-outline', label: 'Tasks', route: 'MyTasks' },
    { icon: 'receipt-outline', label: 'Orders', route: 'Orders' },
    { icon: 'notifications-outline', label: 'Notifications', route: 'Notifications', badge: unreadCount },
  ];
  return (
    <View style={styles.bottomNav}>
      {items.map(({ icon, label, route, active, badge }) => (
        <Pressable key={label} style={styles.bottomItem} onPress={() => navigation.navigate(route)}>
          <View>
            <Ionicons name={icon} size={globalWidth('1.15%')} color={active ? colors.primary : colors.textPrimary} />
            {badge > 0 && <Text style={styles.bottomBadge}>{badge > 9 ? '9+' : badge}</Text>}
          </View>
          <Text style={[styles.bottomLabel, active && styles.bottomLabelActive]}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/* ─── Styles ──────────────────────────────────────────────────────────── */

const shadow = {
  shadowColor: '#0B2B66',
  shadowOpacity: 0.07,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 2 },
};

const styles = StyleSheet.create({
  /* ── Shell ── */
  shell: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.backgroundColor,
  },

  /* ── Main ── */
  main: { flex: 1, minWidth: 0, minHeight: 0 },

  /* ── Content ── */
  content: {
    padding: globalWidth('1.3%'),
    paddingBottom: globalHeight('10%'),
  },

  /* ── Greeting ── */
  greeting: { marginBottom: globalHeight('1.5%') },
  greetingTitle: { color: colors.textPrimary, fontSize: globalWidth('1.15%'), fontWeight: '800' },
  greetingText: { color: colors.textSecondary, fontSize: globalWidth('0.68%'), marginTop: globalHeight('0.4%') },

  /* ── Hero Row ── */
  heroRow: {
    flexDirection: 'row',
    gap: globalWidth('0.75%'),
    marginBottom: globalHeight('1.3%'),
  },
  aiCard: {
    flex: 2.5,
    height: globalHeight('19%'),
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    ...colors.elev.hero,
  },
  heroOrb: {
    position: 'absolute', top: -globalHeight('5%'), right: -globalWidth('2%'),
    width: globalWidth('9%'), height: globalWidth('9%'),
    borderRadius: globalWidth('4.5%'),
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  heroOrb2: {
    position: 'absolute', bottom: -globalHeight('6%'), right: globalWidth('5%'),
    width: globalWidth('6%'), height: globalWidth('6%'),
    borderRadius: globalWidth('3%'),
    backgroundColor: 'rgba(255,255,255,0.09)',
  },
  aiContent: {
    flex: 1,
    paddingHorizontal: globalWidth('1.4%'),
    paddingVertical: globalHeight('1.5%'),
    justifyContent: 'center',
  },
  aiImage: {
    height: '100%',
    width: globalWidth('14%'),
    flexShrink: 0,
  },
  aiTitle: { color: colors.white, fontSize: globalWidth('1%'), fontWeight: '800', marginBottom: globalHeight('0.7%') },
  aiBold: { color: colors.white, fontSize: globalWidth('0.65%'), fontWeight: '700', marginBottom: globalHeight('0.5%') },
  aiBody: { color: 'rgba(255,255,255,0.88)', fontSize: globalWidth('0.58%'), lineHeight: globalWidth('0.92%'), marginBottom: globalHeight('1.2%') },
  aiBtn: {
    alignSelf: 'flex-start',
    backgroundColor: colors.white,
    borderRadius: 8,
    paddingHorizontal: globalWidth('1%'),
    paddingVertical: globalHeight('0.75%'),
  },
  aiBtnText: { color: colors.primary, fontSize: globalWidth('0.6%'), fontWeight: '800' },

  /* ── Metric Card ── */
  metricCard: {
    ...colors.elev.card,
    flex: 1,
    height: globalHeight('19%'),
    borderWidth: 1, borderColor: colors.border,
    borderRadius: 14, backgroundColor: colors.surface,
    padding: globalWidth('0.9%'),
  },
  metricIconBox: {
    width: globalWidth('2.1%'), height: globalWidth('2.1%'),
    borderRadius: globalWidth('0.6%'),
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: globalHeight('1%'),
  },
  metricTitle: { color: colors.textSecondary, fontSize: globalWidth('0.58%') },
  metricValue: { color: colors.textPrimary, fontSize: globalWidth('1.15%'), fontWeight: '800', marginTop: globalHeight('0.6%') },
  metricSub: { color: colors.textSecondary, fontSize: globalWidth('0.5%'), marginTop: globalHeight('0.4%') },
  metricTrend: { color: colors.success, fontSize: globalWidth('0.5%'), fontWeight: '700', marginTop: globalHeight('0.8%') },
  metricLink: { color: colors.primary, fontSize: globalWidth('0.5%'), fontWeight: '800', marginTop: globalHeight('0.8%') },

  /* ── Body Grid ── */
  bodyGrid: {
    flexDirection: 'row',
    gap: globalWidth('1%'),
    flexWrap: 'wrap',
  },
  leftCol: { flex: 1.75, minWidth: 0, gap: globalHeight('1.2%') },
  rightCol: { flex: 1, minWidth: 0, gap: globalHeight('1.2%') },

  /* ── Panel ── */
  panel: {
    ...colors.elev.card,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: 14, backgroundColor: colors.surface,
    padding: globalWidth('0.85%'),
  },
  panelHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: globalHeight('1%'),
  },
  panelTitle: { color: colors.textPrimary, fontSize: globalWidth('0.78%'), fontWeight: '800' },
  link: { color: colors.primary, fontSize: globalWidth('0.55%'), fontWeight: '700' },

  /* ── Lower Row ── */
  lowerRow: { flexDirection: 'row', gap: globalWidth('1%'), flexWrap: 'wrap' },
  qaPanel: { flex: 1 },
  raPanel: { flex: 1.3 },

  /* ── Plan Table ── */
  table: {
    borderWidth: 1, borderColor: colors.border,
    borderRadius: 8, overflow: 'hidden',
  },
  tableHead: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.backgroundColor,
    paddingHorizontal: globalWidth('0.6%'),
    paddingVertical: globalHeight('1.1%'),
  },
  headCell: {
    color: colors.textSecondary, fontSize: globalWidth('0.58%'), fontWeight: '700',
  },
  tableRow: {
    flexDirection: 'row', alignItems: 'center',
    borderTopWidth: 1, borderTopColor: colors.border,
    paddingHorizontal: globalWidth('0.6%'),
    minHeight: globalHeight('6%'),
  },
  rowCell: { justifyContent: 'center' },
  rowCellInline: { flexDirection: 'row', alignItems: 'center', gap: globalWidth('0.35%') },
  colAccount: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: globalWidth('0.55%') },
  colTerritory: { flex: 1.4 },
  colTime: { flex: 1 },
  colStatus: { flex: 1 },
  colAction: { flex: 1.2 },
  accountCircle: {
    width: globalWidth('1.9%'), height: globalWidth('1.9%'),
    borderRadius: globalWidth('0.95%'),
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  accountInitials: { color: colors.white, fontSize: globalWidth('0.55%'), fontWeight: '800' },
  accountName: { color: colors.textPrimary, fontSize: globalWidth('0.62%'), fontWeight: '700' },
  accountSub: { color: colors.textSecondary, fontSize: globalWidth('0.5%'), marginTop: 1 },
  cellMain: { color: colors.textSecondary, fontSize: globalWidth('0.6%') },
  cellSub: { color: colors.textMuted, fontSize: globalWidth('0.5%'), marginTop: 1 },
  statusPill: {
    alignSelf: 'flex-start', borderRadius: 6, overflow: 'hidden',
    paddingHorizontal: globalWidth('0.5%'), paddingVertical: globalHeight('0.45%'),
    fontSize: globalWidth('0.55%'), fontWeight: '700',
  },
  statusBlue: { color: colors.primary, backgroundColor: colors.primaryLight },
  statusGreen: { color: colors.success, backgroundColor: '#E7F8EF' },
  statusGray: { color: colors.textSecondary, backgroundColor: colors.backgroundColor },
  btnPrimary: {
    borderRadius: 6, backgroundColor: colors.primary,
    paddingHorizontal: globalWidth('0.7%'), paddingVertical: globalHeight('0.65%'),
  },
  btnPrimaryText: { color: colors.white, fontSize: globalWidth('0.58%'), fontWeight: '800' },
  btnOutline: {
    borderRadius: 6, borderWidth: 1, borderColor: colors.primary,
    paddingHorizontal: globalWidth('0.7%'), paddingVertical: globalHeight('0.65%'),
  },
  btnOutlineText: { color: colors.primary, fontSize: globalWidth('0.58%'), fontWeight: '800' },

  /* ── Quick Actions ── */
  qaGrid: { flexDirection: 'row', gap: globalWidth('0.5%'), flexWrap: 'wrap' },
  qaItem: {
    flex: 1, minWidth: globalWidth('4%'),
    borderWidth: 1, borderColor: colors.border,
    borderRadius: 8, alignItems: 'center', justifyContent: 'center',
    padding: globalWidth('0.6%'), gap: globalHeight('0.6%'),
    minHeight: globalHeight('8.5%'),
  },
  qaIconBox: {
    width: globalWidth('2.2%'), height: globalWidth('2.2%'),
    borderRadius: 8, alignItems: 'center', justifyContent: 'center',
  },
  qaLabel: {
    color: colors.textPrimary, fontSize: globalWidth('0.5%'),
    fontWeight: '700', textAlign: 'center',
  },

  /* ── Activity ── */
  activityList: { gap: globalHeight('1%') },
  activityRow: {
    flexDirection: 'row', alignItems: 'center', gap: globalWidth('0.5%'),
  },
  activityCopy: { flex: 1 },
  activityTitle: { color: colors.textPrimary, fontSize: globalWidth('0.6%'), fontWeight: '700' },
  activitySub: { color: colors.textSecondary, fontSize: globalWidth('0.5%'), marginTop: 1 },
  activityTime: { color: colors.textSecondary, fontSize: globalWidth('0.5%') },

  /* ── Sales Trend ── */
  trendActions: { flexDirection: 'row', alignItems: 'center', gap: globalWidth('0.55%') },
  monthPill: {
    flexDirection: 'row', alignItems: 'center', gap: globalWidth('0.3%'),
    borderWidth: 1, borderColor: colors.border, borderRadius: 6,
    paddingHorizontal: globalWidth('0.5%'), paddingVertical: globalHeight('0.45%'),
  },
  monthPillText: { color: colors.textSecondary, fontSize: globalWidth('0.55%'), fontWeight: '600' },

  /* ── Team ── */
  teamRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: globalWidth('0.5%'), marginBottom: globalHeight('0.8%'),
  },
  teamAvatar: {
    width: globalWidth('1.8%'), height: globalWidth('1.8%'),
    borderRadius: globalWidth('0.9%'),
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  teamAvatarText: { fontSize: globalWidth('0.55%'), fontWeight: '800' },
  teamInfo: { width: globalWidth('7%') },
  teamName: { color: colors.textPrimary, fontSize: globalWidth('0.6%'), fontWeight: '700' },
  teamRole: { color: colors.textSecondary, fontSize: globalWidth('0.5%'), marginTop: 1 },
  progressTrack: {
    flex: 1, height: globalHeight('0.6%'),
    borderRadius: 4, backgroundColor: colors.border, overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: colors.primary },
  scoreText: { color: colors.textPrimary, fontSize: globalWidth('0.6%'), fontWeight: '800' },
  teamTrend: { color: colors.success, fontSize: globalWidth('0.55%'), fontWeight: '700', minWidth: globalWidth('2%'), textAlign: 'right' },
  teamTrendDown: { color: colors.danger },
  moreRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingTop: globalHeight('0.4%'),
  },
  moreText: { color: colors.textSecondary, fontSize: globalWidth('0.55%') },

  /* ── Empty state ── */
  emptyText: {
    color: colors.textMuted, fontSize: globalWidth('0.58%'),
    textAlign: 'center', paddingVertical: globalHeight('1.5%'), flex: 1,
  },

  /* ── Your Achievement (rep) ── */
  achWrap: { alignItems: 'center', paddingVertical: globalHeight('1.5%') },
  achBig: { color: colors.primary, fontSize: globalWidth('2.4%'), fontWeight: '800' },
  achCaption: { color: colors.textSecondary, fontSize: globalWidth('0.6%'), marginTop: globalHeight('0.5%') },
  achRow: {
    flexDirection: 'row', gap: globalWidth('2%'),
    marginTop: globalHeight('1.6%'), width: '100%', justifyContent: 'center',
  },
  achStat: { alignItems: 'center' },
  achStatLabel: { color: colors.textSecondary, fontSize: globalWidth('0.52%') },
  achStatValue: { color: colors.textPrimary, fontSize: globalWidth('0.85%'), fontWeight: '800', marginTop: globalHeight('0.3%') },

  /* ── Bottom Nav ── */
  bottomNav: {
    position: 'absolute', alignSelf: 'center',
    minWidth: globalWidth('22%'), maxWidth: globalWidth('36%'),
    bottom: globalHeight('1.2%'), height: globalHeight('7%'),
    borderWidth: 1, borderColor: colors.border, borderRadius: 28,
    backgroundColor: colors.surface,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around',
    paddingHorizontal: globalWidth('1.5%'),
    ...shadow,
  },
  bottomItem: { alignItems: 'center', gap: globalHeight('0.3%') },
  bottomLabel: { color: colors.textSecondary, fontSize: globalWidth('0.5%'), fontWeight: '600' },
  bottomLabelActive: { color: colors.primary },
  bottomBadge: {
    position: 'absolute', right: -globalWidth('0.35%'), top: -globalHeight('0.7%'),
    width: globalWidth('0.9%'), height: globalWidth('0.9%'),
    borderRadius: globalWidth('0.45%'), overflow: 'hidden',
    textAlign: 'center', color: colors.white,
    backgroundColor: colors.danger,
    fontSize: globalWidth('0.45%'), fontWeight: '800',
  },
});
