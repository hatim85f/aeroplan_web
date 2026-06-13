import React, { useEffect, useMemo, useState } from 'react';
import {
  Image, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { colors } from '../constants/colors';
import { globalHeight, globalWidth } from '../constants/globalWidth';
import { getProfileInitials } from '../constants/profile';
import { APP_VERSION } from '../constants/legal';

const fallbackLogo = require('../assets/icon.png');

const isManagerRole = (role) =>
  ['admin', 'manager', 'senior_manager'].includes(String(role || '').toLowerCase());

// Admin or manager only — excludes senior_manager (manager-of-manager).
const canManageOps = (role) =>
  ['admin', 'manager'].includes(String(role || '').toLowerCase());

const BASE_SECTIONS = [
  {
    title: 'MAIN',
    items: [
      { icon: 'home', label: 'Dashboard', route: 'Home' },
      { icon: 'person-circle', label: 'Profile', route: 'Profile' },
      { icon: 'notifications-outline', label: 'Notifications', route: 'Notifications' },
      { icon: 'settings-outline', label: 'Settings', route: 'Settings' },
    ],
  },
  {
    title: 'TEAMS & LINES',
    items: [
      { icon: 'people-circle', label: 'Teams', route: 'Teams' },
      { icon: 'layers',        label: 'Lines', route: 'Lines' },
    ],
  },
  {
    title: 'PLANNING',
    items: [
      { icon: 'business',          label: 'Accounts',       route: 'Accounts' },
      { icon: 'cube-outline',      label: 'Accounts Stocks', route: 'StockAccounts' },
      { icon: 'cube',              label: 'Products',       route: 'Products' },
      { icon: 'radio-button-on',   label: 'Sales Channels', route: 'SalesChannels' },
    ],
  },
  {
    title: 'MANAGEMENT',
    items: [
      { icon: 'people-circle-outline', label: 'Sales Team Members', route: 'SalesTeam' },
    ],
  },
  {
    title: 'ORDERS',
    items: [
      { icon: 'receipt-outline',       label: 'All Orders',     route: 'Orders' },
      { icon: 'add-circle-outline',    label: 'Create Order',   route: 'CreateOrder' },
      { icon: 'time-outline',          label: 'Order History',  route: 'OrderHistory' },
      { icon: 'pricetag-outline',      label: 'FOC Overrides',  route: 'FocOverridesList' },
      { icon: 'search-circle-outline', label: 'FOC Lookup',     route: 'FocLookup' },
    ],
  },
];

const getSidebarSections = (role) => {
  const salesSection = {
    title: 'SALES',
    items: isManagerRole(role)
      ? [
          { icon: 'bar-chart-outline',    label: 'Sales Overview', route: 'SalesOverview' },
          { icon: 'grid-outline',         label: 'Sales Table',    route: 'SalesTable'    },
          { icon: 'cloud-upload-outline', label: 'Upload Sales',   route: 'SalesUpload'   },
          { icon: 'list-outline',         label: 'Sales Records',  route: 'SalesRecords'  },
          { icon: 'albums-outline',       label: 'Upload Batches', route: 'SalesBatches'  },
          { icon: 'git-merge-outline',    label: 'Sheet Mappings', route: 'SalesMappings' },
          { icon: 'map-outline',          label: 'Areas',          route: 'SalesAreas'    },
          { icon: 'share-social-outline', label: 'Shared Rules',   route: 'SharedSalesRules' },
          { icon: 'create-outline',       label: 'Manual Entry',   route: 'ManualSalesEntry' },
        ]
      : [
          { icon: 'bar-chart-outline', label: 'Sales Overview', route: 'SalesOverview' },
          { icon: 'grid-outline',      label: 'Sales Table',    route: 'SalesTable'    },
          { icon: 'list-outline',      label: 'Sales Records',  route: 'SalesRecords'  },
        ],
  };
  const targetingSection = {
    title: 'TARGETING & FORECAST',
    items: isManagerRole(role)
      ? [
          { icon: 'analytics-outline', label: 'Target Dashboard',   route: 'TargetDashboard' },
          { icon: 'flag-outline',      label: 'Target Assignments', route: 'TargetAssignments' },
          { icon: 'git-branch-outline', label: 'Target Phasing',    route: 'TargetPhasing' },
          { icon: 'stats-chart-outline', label: 'Forecast Dashboard', route: 'ForecastTeam' },
          { icon: 'git-compare-outline', label: 'Forecast vs Sales', route: 'ForecastMatching' },
          { icon: 'trophy-outline',      label: 'Achievement', route: 'Achievement' },
        ]
      : [
          { icon: 'analytics-outline', label: 'My Targets', route: 'MyTargetDashboard' },
          { icon: 'cube-outline',      label: 'My Products', route: 'MyProducts' },
          { icon: 'stats-chart-outline', label: 'My Forecast', route: 'MyForecast' },
          { icon: 'git-compare-outline', label: 'Forecast vs Sales', route: 'ForecastMatching' },
          { icon: 'trophy-outline',      label: 'My Achievement', route: 'Achievement' },
        ],
  };
  const sections = BASE_SECTIONS.map((section) => {
    // Rep Coverage is for admin/manager only (not senior_manager).
    if (section.title === 'MANAGEMENT' && canManageOps(role)) {
      return {
        ...section,
        items: [
          ...section.items,
          { icon: 'calendar-number-outline', label: 'Rep Coverage', route: 'RepCoverage' },
        ],
      };
    }
    // Sales Channels: visible to managers + senior managers, hidden for reps.
    if (section.title === 'PLANNING') {
      return {
        ...section,
        items: section.items.filter((item) => item.route !== 'SalesChannels' || isManagerRole(role)),
      };
    }
    return section;
  });
  const planningSection = {
    title: 'VISIT PLANNING',
    items: isManagerRole(role)
      ? [
          { icon: 'today-outline',    label: 'Today Team Plan',  route: 'PlanningDashboard' },
          { icon: 'calendar-outline', label: 'Planning Calendar', route: 'PlanningCalendar' },
          { icon: 'business-outline', label: 'Planning Accounts', route: 'PlanningAccounts' },
          { icon: 'bar-chart-outline', label: 'Planning Reports', route: 'PlanningReports' },
        ]
      : [
          { icon: 'calendar-outline', label: 'Planning Calendar', route: 'PlanningCalendar' },
          { icon: 'business-outline', label: 'Planning Accounts', route: 'PlanningAccounts' },
          { icon: 'bar-chart-outline', label: 'Planning Reports', route: 'PlanningReports' },
        ],
  };
  const tasksSection = {
    title: 'TASKS',
    items: isManagerRole(role)
      ? [
          { icon: 'list-circle-outline', label: 'My Tasks',   route: 'MyTasks' },
          { icon: 'people-outline',      label: 'Team Tasks', route: 'TeamTasks' },
          { icon: 'bar-chart-outline',   label: 'Task Reports', route: 'TaskReports' },
        ]
      : [
          { icon: 'list-circle-outline', label: 'My Tasks', route: 'MyTasks' },
          { icon: 'bar-chart-outline', label: 'Task Reports', route: 'TaskReports' },
        ],
  };
  // Planning goes right after MAIN (Dashboard + Profile); Tasks right after Planning.
  // Tasks are hidden from senior managers (manager-of-manager).
  const isSenior = String(role || '').toLowerCase() === 'senior_manager';
  const [mainSection, ...restSections] = sections;
  return [
    mainSection,
    planningSection,
    ...(isSenior ? [] : [tasksSection]),
    ...restSections,
    salesSection,
    targetingSection,
  ];
};

function formatRole(role) {
  return String(role || 'Representative')
    .split(/[_-]/)
    .map((p) => `${p.slice(0, 1).toUpperCase()}${p.slice(1)}`)
    .join(' ');
}

function ProfileAvatar({ name, picture, size, textStyle }) {
  const sz = Math.max(size, globalWidth('1.8%'));
  if (picture) {
    return (
      <Image
        source={{ uri: picture }}
        style={[styles.avatarImg, { width: sz, height: sz, borderRadius: sz / 2 }]}
        resizeMode="cover"
      />
    );
  }
  return (
    <View style={[styles.avatarFallback, { width: sz, height: sz, borderRadius: sz / 2 }]}>
      <Text style={textStyle}>{getProfileInitials({ fullName: name })}</Text>
    </View>
  );
}

export default function AppSidebar({ onSignOut, appMetadata, displayName, role, picture, activeRoute }) {
  const navigation = useNavigation();
  const remoteLogo = appMetadata?.logo || appMetadata?.appLogo || appMetadata?.darkLogo;
  const appName    = appMetadata?.appName || appMetadata?.companyName || appMetadata?.name || 'AeroPlan';
  const appInitial = String(appName).charAt(0).toUpperCase();

  const go = (route, params) => {
    if (route) navigation.navigate(route, params);
  };

  // Accordion: each section collapses to just its title + chevron. The section
  // containing the active route starts expanded; if none match, MAIN is opened.
  const sections = useMemo(() => getSidebarSections(role), [role]);
  const initialOpen = useMemo(() => {
    const map = {};
    sections.forEach((s) => {
      map[s.title] = s.items.some((it) => activeRoute === it.route || activeRoute === it.label);
    });
    if (!Object.values(map).some(Boolean) && sections[0]) map[sections[0].title] = true;
    return map;
  }, [sections, activeRoute]);
  const [openSections, setOpenSections] = useState(initialOpen);
  useEffect(() => { setOpenSections(initialOpen); }, [initialOpen]);
  const toggleSection = (title) =>
    setOpenSections((prev) => ({ ...prev, [title]: !prev[title] }));

  return (
    <View style={styles.sidebar}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Company / logo row */}
        <View style={styles.logoRow}>
          {remoteLogo ? (
            <Image source={{ uri: remoteLogo }} style={styles.logoImg} resizeMode="contain" />
          ) : (
            <View style={styles.logoAvatar}>
              <Text style={styles.logoAvatarText}>{appInitial}</Text>
            </View>
          )}
          <Text style={styles.logoName} numberOfLines={1}>{appName}</Text>
        </View>

        {/* User profile */}
        <View style={styles.profileRow}>
          <ProfileAvatar
            name={displayName}
            picture={picture}
            size={globalWidth('2.2%')}
            textStyle={styles.avatarText}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.profileName} numberOfLines={1}>{displayName}</Text>
            <Text style={styles.profileRole} numberOfLines={1}>{formatRole(role)}</Text>
          </View>
        </View>

        {/* Nav sections (accordion) */}
        {sections.map((section) => {
          const isOpen = !!openSections[section.title];
          return (
            <View key={section.title} style={styles.section}>
              <Pressable
                onPress={() => toggleSection(section.title)}
                style={({ hovered }) => [styles.sectionHeader, hovered && styles.sectionHeaderHover]}
              >
                <Text style={[styles.sectionTitle, isOpen && styles.sectionTitleOpen]}>{section.title}</Text>
                <Ionicons
                  name="chevron-forward"
                  size={globalWidth('0.85%')}
                  color={isOpen ? colors.primary : colors.textMuted}
                  style={[styles.chevron, { transform: [{ rotate: isOpen ? '90deg' : '0deg' }] }]}
                />
              </Pressable>
              {isOpen && (
                <View style={styles.itemsWrap}>
                  {section.items.map(({ icon, label, route, params }) => {
                    const active = activeRoute === route || activeRoute === label;
                    return (
                      <Pressable
                        key={label}
                        onPress={() => go(route, params)}
                        style={[styles.navItem, active && styles.navItemActive]}
                      >
                        <Ionicons
                          name={icon}
                          size={globalWidth('1.05%')}
                          color={active ? '#fff' : colors.textSecondary}
                        />
                        <Text style={[styles.navItemText, active && styles.navItemTextActive]}>
                          {label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}

        {/* Logout */}
        <View style={styles.divider} />
        <Pressable onPress={onSignOut} style={styles.navItem}>
          <Ionicons name="exit-outline" size={globalWidth('1.05%')} color={colors.danger} />
          <Text style={styles.logoutText}>Log Out</Text>
        </Pressable>

        <Text style={styles.versionText}>v{APP_VERSION}</Text>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: globalWidth('15.5%'),
    minWidth: globalWidth('13%'),
    maxWidth: globalWidth('17%'),
    backgroundColor: colors.surface,
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  scroll: {
    paddingHorizontal: globalWidth('0.9%'),
    paddingVertical: globalHeight('2.2%'),
    paddingBottom: globalHeight('3%'),
  },

  /* Company row */
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: globalWidth('0.55%'),
    marginBottom: globalHeight('2.4%'),
    paddingHorizontal: globalWidth('0.3%'),
  },
  logoAvatar: {
    width: globalWidth('2%'),
    height: globalWidth('2%'),
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoAvatarText: {
    color: '#fff',
    fontSize: globalWidth('0.78%'),
    fontWeight: '800',
  },
  logoImg: {
    width: globalWidth('2%'),
    height: globalWidth('2%'),
    borderRadius: 8,
  },
  logoName: {
    color: colors.textPrimary,
    fontSize: globalWidth('0.82%'),
    fontWeight: '800',
    flex: 1,
  },

  /* Profile row */
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: globalWidth('0.55%'),
    marginBottom: globalHeight('2.8%'),
    paddingHorizontal: globalWidth('0.3%'),
  },
  avatarText: {
    color: '#fff',
    fontSize: globalWidth('0.68%'),
    fontWeight: '800',
  },
  profileName: {
    color: colors.textPrimary,
    fontSize: globalWidth('0.7%'),
    fontWeight: '700',
  },
  profileRole: {
    color: colors.textSecondary,
    fontSize: globalWidth('0.57%'),
    marginTop: 2,
  },

  /* Sections */
  section: {
    marginBottom: globalHeight('0.8%'),
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: globalWidth('0.6%'),
    paddingVertical: globalHeight('0.7%'),
    marginBottom: globalHeight('0.2%'),
    borderRadius: 8,
    cursor: 'pointer',
    transitionProperty: 'background-color',
    transitionDuration: '160ms',
  },
  sectionHeaderHover: {
    backgroundColor: colors.surfaceSoft,
  },
  sectionTitle: {
    color: colors.textSecondary,
    fontSize: globalWidth('0.66%'),
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  sectionTitleOpen: {
    color: colors.textPrimary,
  },
  chevron: {
    transitionProperty: 'transform',
    transitionDuration: '220ms',
    transitionTimingFunction: 'ease',
  },
  itemsWrap: {
    overflow: 'hidden',
    animationKeyframes: {
      '0%': { opacity: 0, transform: [{ translateY: -8 }] },
      '100%': { opacity: 1, transform: [{ translateY: 0 }] },
    },
    animationDuration: '240ms',
    animationTimingFunction: 'ease-out',
  },

  /* Nav items */
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: globalWidth('0.6%'),
    paddingHorizontal: globalWidth('0.65%'),
    paddingVertical: globalHeight('0.9%'),
    borderRadius: 10,
    minHeight: globalHeight('4%'),
  },
  navItemActive: {
    backgroundColor: colors.primary,
  },
  navItemText: {
    color: colors.textSecondary,
    fontSize: globalWidth('0.68%'),
    fontWeight: '600',
    flex: 1,
  },
  navItemTextActive: {
    color: '#fff',
    fontWeight: '700',
  },

  /* Divider & logout */
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: globalHeight('1%'),
  },
  logoutText: {
    color: colors.danger,
    fontSize: globalWidth('0.68%'),
    fontWeight: '600',
  },
  versionText: {
    color: colors.textMuted,
    fontSize: globalWidth('0.55%'),
    fontWeight: '600',
    paddingHorizontal: globalWidth('0.65%'),
    marginTop: globalHeight('0.6%'),
  },

  /* Avatar helpers */
  avatarImg: { backgroundColor: colors.primaryLight },
  avatarFallback: {
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
