import React, { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  Image, Pressable, ScrollView,
  StyleSheet, Text, View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Svg, {
  Path, Circle, Rect, Defs,
  LinearGradient, Stop,
  Line as SvgLine, Text as SvgText,
} from 'react-native-svg';

import { colors } from '../../constants/colors';
import { globalHeight, globalWidth } from '../../constants/globalWidth';
import { getProfileInitials, getProfilePicture } from '../../constants/profile';

const landingImage = require('../../assets/images/landing_image.png');
const fallbackLogo = require('../../assets/icon.png');

/* ─── Static data ─────────────────────────────────────────────────────── */

const SIDEBAR_SECTIONS = [
  {
    title: 'MAIN',
    items: [{ icon: 'home', label: 'Dashboard', route: 'Home', active: true }],
  },
  {
    title: 'TEAMS & LINES',
    items: [
      { icon: 'people-circle', label: 'Teams', route: 'Teams' },
      { icon: 'layers', label: 'Lines', route: 'Lines' },
    ],
  },
  {
    title: 'PLANNING',
    items: [{ icon: 'business', label: 'Accounts', route: 'Accounts' }],
  },
  {
    title: 'ACCOUNT',
    items: [{ icon: 'person-circle', label: 'Profile', route: 'Placeholder', params: { title: 'Profile' } }],
  },
];

const PLAN_ROWS = [
  {
    color: '#8B5CF6', initials: 'DS', name: 'Dr. Sarah Clinic',
    sub: 'Visit & Discussion', region: 'North Region', area: 'North Zone',
    time: '10:30 AM', status: 'Scheduled', isFirst: true,
  },
  {
    color: '#1677FF', initials: 'CM', name: 'City Medical Center',
    sub: 'Doctor Visit', region: 'East Zone', area: 'Central Area',
    time: '12:00 PM', status: 'Planned',
  },
  {
    color: '#22C55E', initials: 'AN', name: 'Al Noor Pharmacy',
    sub: 'Order Follow-up', region: 'West Zone', area: 'West Area',
    time: '02:30 PM', status: 'Planned',
  },
  {
    color: '#F97316', initials: 'LC', name: 'Life Care Hospital',
    sub: 'Product Presentation', region: 'South Region', area: 'South Area',
    time: '04:00 PM', status: 'Planned',
  },
];

const QUICK_ACTIONS = [
  { icon: 'cart', label: 'Add Order', color: '#F97316', bg: '#FFF4EE' },
  { icon: 'stats-chart', label: 'Modify Forecast', color: '#0F6FFF', bg: '#EEF4FF' },
  { icon: 'calendar', label: 'New Daily Plan', color: '#8B5CF6', bg: '#F3EEFF' },
  { icon: 'document-text', label: 'Check Sales\nDetails', color: '#0F6FFF', bg: '#EEF4FF' },
];

const ACTIVITY_ROWS = [
  { icon: 'checkmark-circle', iconColor: '#22C55E', title: 'Order #SO-1256 completed', sub: 'City Medical Center', time: '10:15 AM' },
  { icon: 'calendar', iconColor: colors.primary, title: 'New plan created', sub: '8 activities planned for today', time: '09:30 AM' },
  { icon: 'person-circle', iconColor: '#6B46FF', title: 'New customer added', sub: 'Health Plus Pharmacy', time: 'Yesterday' },
];

const TEAM_MEMBERS = [
  { name: 'Mona Khaled', role: 'Manager', score: 85, trend: '+12%', up: true },
  { name: 'Omar Farooq', role: 'SR. Representative', score: 72, trend: '+8%', up: true },
  { name: 'Yasir Ali', role: 'Representative', score: 68, trend: '-4%', up: false },
];

const CHART_POINTS = [
  { label: 'May 1', v: 4 },
  { label: 'May 5', v: 9 },
  { label: 'May 9', v: 11 },
  { label: 'May 13', v: 16 },
  { label: 'May 17', v: 12 },
  { label: 'May 21', v: 19 },
  { label: 'May 25', v: 25 },
  { label: 'May 31', v: 18.45 },
];

const BOTTOM_NAV = [
  { icon: 'home', label: 'Home', active: true },
  { icon: 'people-outline', label: 'Customers' },
  { icon: 'receipt-outline', label: 'Orders' },
  { icon: 'notifications-outline', label: 'Notifications', badge: '3' },
  { icon: 'grid-outline', label: 'More' },
];

/* ─── Root ────────────────────────────────────────────────────────────── */

export default function HomeScreen({ navigation, userDetails, appMetadata, onSignOut }) {
  const user = userDetails?.user || userDetails?.data?.user || userDetails || {};
  const displayName = user.displayName || user.fullName || user.name || user.userName || 'Ahmed Hassan';
  const role = user.role || user.title || 'Medical Representative';
  const profilePicture = getProfilePicture(user);

  return (
    <View style={styles.shell}>
      <Sidebar
        onSignOut={onSignOut}
        appMetadata={appMetadata}
        displayName={displayName}
        role={role}
        profilePicture={profilePicture}
      />
      <View style={styles.main}>
        <TopBar displayName={displayName} role={role} profilePicture={profilePicture} />
        <ScrollView contentContainerStyle={styles.content}>

          {/* ── Greeting ─────────────────────────────────────────────── */}
          <View style={styles.greeting}>
            <Text style={styles.greetingTitle}>Good Morning, {displayName}</Text>
            <Text style={styles.greetingText}>Ready to plan your sales day?</Text>
          </View>

          {/* ── Hero Row ─────────────────────────────────────────────── */}
          <View style={styles.heroRow}>
            <View style={styles.aiCard}>
              <View style={styles.aiContent}>
                <Text style={styles.aiTitle}>AI Sales Plan</Text>
                <Text style={styles.aiBold}>8 activities planned for today</Text>
                <Text style={styles.aiBody}>Start with North Zone to maximize your coverage.</Text>
                <Pressable style={styles.aiBtn}>
                  <Text style={styles.aiBtnText}>View Plan</Text>
                </Pressable>
              </View>
              <Image
                source={landingImage}
                style={styles.aiImage}
                resizeMode="contain"
              />
            </View>

            <MetricCard icon="cash-outline"     title="MTD Sales"        value="$18,450" sub="This Month"    trend="+ 12.6% vs Last Month" />
            <MetricCard icon="bar-chart-outline" title="Forecast"         value="$24,900" sub="This Month"    trend="+ 8.4% vs Last Month" />
            <MetricCard icon="disc-outline"      title="MTD Achievement"  value="72%"     sub="vs Target 80%" trend="+ 5.2% vs Last Month" />
            <MetricCard icon="calendar-outline"  title="Accounts to Visit" value="12"     sub="Planned Today" link="View Accounts" />
          </View>

          {/* ── Body ─────────────────────────────────────────────────── */}
          <View style={styles.bodyGrid}>

            {/* Left column */}
            <View style={styles.leftCol}>
              <Panel title="Today's Plan" action={<Text style={styles.link}>View All</Text>}>
                <PlanTable />
              </Panel>

              <View style={styles.lowerRow}>
                <Panel title="Quick Actions" style={styles.qaPanel}>
                  <View style={styles.qaGrid}>
                    {QUICK_ACTIONS.map((a) => (
                      <Pressable key={a.label} style={styles.qaItem}>
                        <View style={[styles.qaIconBox, { backgroundColor: a.bg }]}>
                          <Ionicons name={a.icon} size={globalWidth('1.3%')} color={a.color} />
                        </View>
                        <Text style={styles.qaLabel}>{a.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                </Panel>

                <Panel title="Recent Activity" action={<Text style={styles.link}>View All</Text>} style={styles.raPanel}>
                  <View style={styles.activityList}>
                    {ACTIVITY_ROWS.map((r) => (
                      <View key={r.title} style={styles.activityRow}>
                        <Ionicons name={r.icon} size={globalWidth('1.1%')} color={r.iconColor} />
                        <View style={styles.activityCopy}>
                          <Text style={styles.activityTitle}>{r.title}</Text>
                          <Text style={styles.activitySub}>{r.sub}</Text>
                        </View>
                        <Text style={styles.activityTime}>{r.time}</Text>
                      </View>
                    ))}
                  </View>
                </Panel>
              </View>
            </View>

            {/* Right column */}
            <View style={styles.rightCol}>
              <Panel
                title="Sales Trend (MTD)"
                action={
                  <View style={styles.trendActions}>
                    <View style={styles.monthPill}>
                      <Text style={styles.monthPillText}>This Month</Text>
                      <Ionicons name="chevron-down" size={globalWidth('0.65%')} color={colors.textSecondary} />
                    </View>
                    <Ionicons name="ellipsis-horizontal" size={globalWidth('0.9%')} color={colors.textSecondary} />
                  </View>
                }
              >
                <SalesTrendChart />
              </Panel>

              <Panel title="Team Performance" action={<Text style={styles.link}>View All</Text>}>
                {TEAM_MEMBERS.map((m) => <TeamRow key={m.name} member={m} />)}
                <View style={styles.moreRow}>
                  <Text style={styles.moreText}>+5 more team members</Text>
                  <Text style={styles.link}>View All</Text>
                </View>
              </Panel>
            </View>

          </View>
        </ScrollView>
        <BottomNav />
      </View>
    </View>
  );
}

/* ─── Sidebar (unchanged) ─────────────────────────────────────────────── */

function Sidebar({ onSignOut, appMetadata, displayName, role, profilePicture }) {
  const navigation = useNavigation();
  const remoteLogo = appMetadata?.logo || appMetadata?.appLogo || appMetadata?.darkLogo;
  const logoSource = remoteLogo ? { uri: remoteLogo } : fallbackLogo;

  const go = (route, params) => {
    if (route) navigation.navigate(route, params);
  };

  return (
    <View style={styles.sidebar}>
      <ScrollView contentContainerStyle={styles.sidebarScroll}>
        <View style={styles.sidebarLogoRow}>
          <Image source={logoSource} style={styles.sidebarLogo} resizeMode="contain" />
          {!remoteLogo && <Text style={styles.logoText}>AeroPlan</Text>}
        </View>
        <View style={styles.sidebarProfile}>
          <ProfileAvatar
            name={displayName}
            picture={profilePicture}
            size={globalWidth('2.5%')}
            textStyle={styles.sidebarAvatarText}
          />
          <View>
            <Text style={styles.sidebarName} numberOfLines={1}>{displayName}</Text>
            <Text style={styles.sidebarRole} numberOfLines={1}>{formatRole(role)}</Text>
          </View>
        </View>
        <View style={styles.sidebarSectionCard}>
          {SIDEBAR_SECTIONS.map((section) => (
            <View key={section.title} style={styles.sidebarSection}>
              <Text style={styles.sidebarSectionTitle}>{section.title}</Text>
              {section.items.map(({ icon, label, active, route, params }) => (
                <Pressable
                  key={label}
                  onPress={() => go(route, params)}
                  style={[styles.sectionItem, active && styles.sectionItemActive]}
                >
                  <Ionicons name={icon} size={globalWidth('1.15%')} color={active ? colors.primary : colors.textPrimary} />
                  <Text style={[styles.sectionItemText, active && styles.sectionItemTextActive]}>{label}</Text>
                </Pressable>
              ))}
            </View>
          ))}
          <View style={styles.sidebarDivider} />
          <Pressable onPress={onSignOut} style={styles.logoutItem}>
            <Ionicons name="log-out-outline" size={globalWidth('1.15%')} color={colors.danger} />
            <Text style={styles.logoutText}>Log Out</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

/* ─── TopBar (unchanged) ──────────────────────────────────────────────── */

function TopBar({ displayName, role, profilePicture }) {
  const currentDate = new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  }).format(new Date());

  return (
    <View style={styles.topbar}>
      <Pressable style={styles.iconButton}>
        <Ionicons name="menu" size={globalWidth('1.25%')} color={colors.textPrimary} />
      </Pressable>
      <View style={styles.searchBox}>
        <Ionicons name="search" size={globalWidth('0.9%')} color={colors.textSecondary} />
        <Text style={styles.searchText}>Search customers, orders, teams...</Text>
        <Text style={styles.shortcut}>Ctrl K</Text>
      </View>
      <View style={styles.dateBox}>
        <Ionicons name="calendar-outline" size={globalWidth('0.9%')} color={colors.textPrimary} />
        <Text style={styles.dateText}>{currentDate}</Text>
        <Ionicons name="chevron-down" size={globalWidth('0.8%')} color={colors.textSecondary} />
      </View>
      <View style={styles.notificationWrap}>
        <Ionicons name="notifications-outline" size={globalWidth('1.25%')} color={colors.textPrimary} />
        <Text style={styles.topBadge}>3</Text>
      </View>
      <View style={styles.profileBox}>
        <ProfileAvatar
          name={displayName}
          picture={profilePicture}
          size={globalWidth('2.5%')}
          textStyle={styles.avatarText}
        />
        <View>
          <Text style={styles.profileName} numberOfLines={1}>{displayName}</Text>
          <Text style={styles.profileRole} numberOfLines={1}>{formatRole(role)}</Text>
        </View>
        <Ionicons name="chevron-down" size={globalWidth('0.8%')} color={colors.textSecondary} />
      </View>
    </View>
  );
}

/* ─── ProfileAvatar (unchanged) ──────────────────────────────────────── */

function ProfileAvatar({ name, picture, size, textStyle }) {
  const avatarSize = Math.max(size, globalWidth('1.8%'));
  if (picture) {
    return (
      <Image
        source={{ uri: picture }}
        style={[styles.avatarImage, { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 }]}
        resizeMode="cover"
      />
    );
  }
  return (
    <View style={[styles.avatarFallback, { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 }]}>
      <Text style={textStyle}>{getProfileInitials({ fullName: name })}</Text>
    </View>
  );
}

function formatRole(role) {
  return String(role || 'Medical Representative')
    .split(/[_-]/)
    .map((p) => `${p.slice(0, 1).toUpperCase()}${p.slice(1)}`)
    .join(' ');
}

/* ─── MetricCard ──────────────────────────────────────────────────────── */

function MetricCard({ icon, title, value, sub, trend, link }) {
  return (
    <View style={styles.metricCard}>
      <View style={styles.metricIconBox}>
        <Ionicons name={icon} size={globalWidth('1.05%')} color={colors.white} />
      </View>
      <Text style={styles.metricTitle}>{title}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricSub}>{sub}</Text>
      {trend && <Text style={styles.metricTrend}>{trend}</Text>}
      {link && <Text style={styles.metricLink}>{link}</Text>}
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

function PlanTable() {
  return (
    <View style={styles.table}>
      {/* Header */}
      <View style={styles.tableHead}>
        <Text style={[styles.headCell, styles.colAccount]}>Account / Activity</Text>
        <Text style={[styles.headCell, styles.colTerritory]}>Territory / Area</Text>
        <Text style={[styles.headCell, styles.colTime]}>Time</Text>
        <Text style={[styles.headCell, styles.colStatus]}>Status</Text>
        <Text style={[styles.headCell, styles.colAction]}>Action</Text>
      </View>

      {PLAN_ROWS.map((row) => (
        <View key={row.name} style={styles.tableRow}>
          {/* Account */}
          <View style={[styles.rowCell, styles.colAccount]}>
            <View style={[styles.accountCircle, { backgroundColor: row.color }]}>
              <Text style={styles.accountInitials}>{row.initials}</Text>
            </View>
            <View>
              <Text style={styles.accountName}>{row.name}</Text>
              <Text style={styles.accountSub}>{row.sub}</Text>
            </View>
          </View>

          {/* Territory */}
          <View style={[styles.rowCell, styles.colTerritory]}>
            <Text style={styles.cellMain}>{row.region}</Text>
            <Text style={styles.cellSub}>{row.area}</Text>
          </View>

          {/* Time */}
          <View style={[styles.rowCellInline, styles.colTime]}>
            <Ionicons name="time-outline" size={globalWidth('0.8%')} color={colors.textSecondary} />
            <Text style={styles.cellMain}>{row.time}</Text>
          </View>

          {/* Status */}
          <View style={[styles.rowCell, styles.colStatus]}>
            <Text style={[styles.statusPill, row.isFirst ? styles.statusBlue : styles.statusGreen]}>
              {row.status}
            </Text>
          </View>

          {/* Action */}
          <View style={[styles.rowCellInline, styles.colAction]}>
            <Pressable style={row.isFirst ? styles.btnPrimary : styles.btnOutline}>
              <Text style={row.isFirst ? styles.btnPrimaryText : styles.btnOutlineText}>
                {row.isFirst ? 'Start Plan' : 'View Plan'}
              </Text>
            </Pressable>
            <Ionicons name="ellipsis-vertical" size={globalWidth('0.85%')} color={colors.textSecondary} />
          </View>
        </View>
      ))}
    </View>
  );
}

/* ─── Sales Trend SVG Chart ───────────────────────────────────────────── */

function SalesTrendChart() {
  const [cw, setCw] = useState(0);
  const totalH = globalHeight('17%');
  const PL = 36, PR = 10, PT = 22, PB = 22;
  const chartW = Math.max(cw - PL - PR, 0);
  const chartH = Math.max(totalH - PT - PB, 0);
  const MAX = 30;
  const n = CHART_POINTS.length;

  const pts = CHART_POINTS.map((d, i) => ({
    x: PL + (i / (n - 1)) * chartW,
    y: PT + (1 - d.v / MAX) * chartH,
    label: d.label,
  }));

  const lineD = pts.map((p, i) =>
    `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`
  ).join(' ');

  const areaD = cw > 0
    ? `${lineD} L${pts[n - 1].x.toFixed(1)},${(PT + chartH).toFixed(1)} L${PL},${(PT + chartH).toFixed(1)} Z`
    : '';

  const yTicks = [30, 20, 10, 0];
  const tooltipPt = pts[6]; // May 25 — peak

  return (
    <View onLayout={(e) => setCw(e.nativeEvent.layout.width)} style={{ height: totalH }}>
      {cw > 0 && (
        <Svg width={cw} height={totalH}>
          <Defs>
            <LinearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor={colors.primary} stopOpacity="0.15" />
              <Stop offset="100%" stopColor={colors.primary} stopOpacity="0" />
            </LinearGradient>
          </Defs>

          {/* Y-axis grid lines + labels */}
          {yTicks.map((val) => {
            const gy = PT + (1 - val / MAX) * chartH;
            return (
              <React.Fragment key={val}>
                <SvgLine
                  x1={PL} y1={gy} x2={PL + chartW} y2={gy}
                  stroke={colors.border} strokeWidth={0.8}
                />
                <SvgText
                  x={PL - 4} y={gy + 3.5}
                  fontSize={8} fill={colors.textSecondary} textAnchor="end"
                >
                  {val === 0 ? '$0k' : `$${val}k`}
                </SvgText>
              </React.Fragment>
            );
          })}

          {/* Area */}
          <Path d={areaD} fill="url(#grad)" />

          {/* Line */}
          <Path
            d={lineD}
            stroke={colors.primary} strokeWidth={2}
            fill="none" strokeLinecap="round" strokeLinejoin="round"
          />

          {/* Dots */}
          {pts.map((p, i) => (
            <Circle key={i} cx={p.x} cy={p.y} r={3} fill="white" stroke={colors.primary} strokeWidth={2} />
          ))}

          {/* Tooltip at peak */}
          {tooltipPt && (
            <>
              <Rect
                x={tooltipPt.x - 26} y={tooltipPt.y - 22}
                width={52} height={16} rx={4}
                fill={colors.textPrimary}
              />
              <SvgText
                x={tooltipPt.x} y={tooltipPt.y - 10.5}
                fontSize={8} fill="white" textAnchor="middle" fontWeight="bold"
              >
                $18,450
              </SvgText>
            </>
          )}

          {/* X-axis labels */}
          {pts.map((p) => (
            <SvgText
              key={p.label}
              x={p.x} y={totalH - 5}
              fontSize={7.5} fill={colors.textSecondary} textAnchor="middle"
            >
              {p.label}
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
  const { name, role, score, trend, up } = member;
  const initials = name.split(' ').map((p) => p[0]).join('');
  const avatarBg = AVATAR_COLORS[TEAM_MEMBERS.indexOf(member)] || colors.primary;

  return (
    <View style={styles.teamRow}>
      <View style={[styles.teamAvatar, { backgroundColor: avatarBg + '22' }]}>
        <Text style={[styles.teamAvatarText, { color: avatarBg }]}>{initials}</Text>
      </View>
      <View style={styles.teamInfo}>
        <Text style={styles.teamName}>{name}</Text>
        <Text style={styles.teamRole}>{role}</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${score}%` }]} />
      </View>
      <Text style={styles.scoreText}>{score}%</Text>
      <Text style={[styles.teamTrend, !up && styles.teamTrendDown]}>{trend}</Text>
    </View>
  );
}

/* ─── Bottom Nav ──────────────────────────────────────────────────────── */

function BottomNav() {
  return (
    <View style={styles.bottomNav}>
      {BOTTOM_NAV.map(({ icon, label, active, badge }) => (
        <View key={label} style={styles.bottomItem}>
          <View>
            <Ionicons name={icon} size={globalWidth('1.15%')} color={active ? colors.primary : colors.textPrimary} />
            {badge && <Text style={styles.bottomBadge}>{badge}</Text>}
          </View>
          <Text style={[styles.bottomLabel, active && styles.bottomLabelActive]}>{label}</Text>
        </View>
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
    overflow: 'hidden',
  },

  /* ── Sidebar ── */
  sidebar: {
    width: globalWidth('15.5%'),
    minWidth: globalWidth('12.5%'),
    maxWidth: globalWidth('16.5%'),
    borderRightWidth: 1,
    borderRightColor: colors.border,
    backgroundColor: colors.surface,
  },
  sidebarScroll: { padding: globalWidth('1.05%'), paddingBottom: globalHeight('3%') },
  sidebarLogoRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: globalWidth('0.5%'), marginBottom: globalHeight('2%'),
  },
  sidebarLogo: { width: globalWidth('2.4%'), height: globalWidth('2.4%') },
  logoText: { color: colors.primary, fontSize: globalWidth('1.1%'), fontWeight: '800' },
  sidebarProfile: {
    flexDirection: 'row', alignItems: 'center',
    gap: globalWidth('0.6%'), marginBottom: globalHeight('1.8%'),
  },
  sidebarAvatarText: { color: colors.primary, fontSize: globalWidth('0.72%'), fontWeight: '800' },
  sidebarName: { color: colors.textPrimary, fontSize: globalWidth('0.68%'), fontWeight: '800' },
  sidebarRole: { color: colors.textSecondary, fontSize: globalWidth('0.56%'), marginTop: globalHeight('0.25%') },
  sidebarSectionCard: {
    borderRadius: 8, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.surface, padding: globalWidth('0.65%'),
  },
  sidebarSection: { marginBottom: globalHeight('1.25%') },
  sidebarSectionTitle: {
    color: colors.textMuted, fontSize: globalWidth('0.56%'),
    fontWeight: '800', marginBottom: globalHeight('0.7%'),
  },
  sectionItem: {
    minHeight: globalHeight('4.4%'), borderRadius: 8,
    flexDirection: 'row', alignItems: 'center',
    gap: globalWidth('0.65%'), paddingHorizontal: globalWidth('0.6%'),
  },
  sectionItemActive: { backgroundColor: colors.surfaceSoft },
  sectionItemText: { color: colors.textPrimary, fontSize: globalWidth('0.72%'), fontWeight: '800' },
  sectionItemTextActive: { color: colors.primary },
  sidebarDivider: { height: globalHeight('0.1%'), backgroundColor: colors.border, marginBottom: globalHeight('1%') },
  logoutItem: {
    minHeight: globalHeight('4.4%'), flexDirection: 'row',
    alignItems: 'center', gap: globalWidth('0.65%'), paddingHorizontal: globalWidth('0.6%'),
  },
  logoutText: { color: colors.danger, fontSize: globalWidth('0.72%'), fontWeight: '800' },

  /* ── Main ── */
  main: { flex: 1, minWidth: 0, overflow: 'hidden' },

  /* ── TopBar ── */
  topbar: {
    height: globalHeight('8%'),
    borderBottomWidth: 1, borderBottomColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row', alignItems: 'center',
    gap: globalWidth('0.8%'), paddingHorizontal: globalWidth('1.3%'),
    overflow: 'hidden',
  },
  iconButton: {
    width: globalWidth('2.3%'), height: globalWidth('2.3%'),
    alignItems: 'center', justifyContent: 'center',
  },
  searchBox: {
    flex: 1, maxWidth: globalWidth('28%'), minWidth: globalWidth('12%'),
    height: globalHeight('4.6%'), borderWidth: 1, borderColor: colors.border,
    borderRadius: 8, flexDirection: 'row', alignItems: 'center',
    gap: globalWidth('0.5%'), paddingHorizontal: globalWidth('0.8%'),
    backgroundColor: colors.surface,
  },
  searchText: { flex: 1, color: colors.textSecondary, fontSize: globalWidth('0.62%') },
  shortcut: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 6,
    color: colors.textSecondary, fontSize: globalWidth('0.5%'),
    paddingHorizontal: globalWidth('0.35%'), paddingVertical: globalHeight('0.25%'),
  },
  dateBox: {
    width: globalWidth('11%'), height: globalHeight('4.6%'),
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    flexDirection: 'row', alignItems: 'center',
    gap: globalWidth('0.5%'), paddingHorizontal: globalWidth('0.7%'),
  },
  dateText: { flex: 1, color: colors.textPrimary, fontSize: globalWidth('0.62%'), fontWeight: '700' },
  notificationWrap: {
    width: globalWidth('2.2%'), height: globalWidth('2.2%'),
    alignItems: 'center', justifyContent: 'center',
  },
  topBadge: {
    position: 'absolute', right: globalWidth('0.15%'), top: globalHeight('0.35%'),
    width: globalWidth('0.9%'), height: globalWidth('0.9%'),
    borderRadius: globalWidth('0.45%'), backgroundColor: colors.danger,
    color: colors.white, textAlign: 'center',
    fontSize: globalWidth('0.45%'), fontWeight: '800', overflow: 'hidden',
  },
  profileBox: {
    flexDirection: 'row', alignItems: 'center',
    gap: globalWidth('0.55%'), maxWidth: globalWidth('14%'), flexShrink: 1,
  },
  avatarText: { color: colors.white, fontSize: globalWidth('0.68%'), fontWeight: '800' },
  avatarImage: { backgroundColor: colors.primaryLight },
  avatarFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primaryDark },
  profileName: { color: colors.textPrimary, fontSize: globalWidth('0.62%'), fontWeight: '800' },
  profileRole: { color: colors.textSecondary, fontSize: globalWidth('0.5%'), marginTop: globalHeight('0.2%') },

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
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#2D5BE3',
    flexDirection: 'row',
    alignItems: 'center',
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
  aiBtnText: { color: '#2D5BE3', fontSize: globalWidth('0.6%'), fontWeight: '800' },

  /* ── Metric Card ── */
  metricCard: {
    ...shadow,
    flex: 1,
    height: globalHeight('19%'),
    borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, backgroundColor: colors.surface,
    padding: globalWidth('0.9%'),
  },
  metricIconBox: {
    width: globalWidth('2.1%'), height: globalWidth('2.1%'),
    borderRadius: globalWidth('1.05%'),
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
    ...shadow,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, backgroundColor: colors.surface,
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
  colAccount: { flex: 2, flexDirection: 'row', alignItems: 'center', gap: globalWidth('0.55%') },
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
