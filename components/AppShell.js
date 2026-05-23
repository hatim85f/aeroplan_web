import React from 'react';
import {
  Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { colors } from '../constants/colors';
import { globalHeight, globalWidth } from '../constants/globalWidth';
import { getProfileInitials, getProfilePicture } from '../constants/profile';

const fallbackLogo = require('../assets/icon.png');

/* ─── Sidebar sections — mirrors HomeScreen exactly ────────────────────── */

const SIDEBAR_SECTIONS = [
  {
    title: 'MAIN',
    items: [{ icon: 'home', label: 'Dashboard', route: 'Home' }],
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
    items: [{ icon: 'business', label: 'Accounts', route: 'Accounts' }],
  },
  {
    title: 'ACCOUNT',
    items: [{ icon: 'person-circle', label: 'Profile', route: 'Placeholder', params: { title: 'Profile' } }],
  },
];

/* ─── Helpers ───────────────────────────────────────────────────────────── */

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

/* ─── Sidebar ───────────────────────────────────────────────────────────── */

function Sidebar({ onSignOut, appMetadata, displayName, role, picture, activeRoute }) {
  const navigation = useNavigation();
  const remoteLogo = appMetadata?.logo || appMetadata?.appLogo || appMetadata?.darkLogo;
  const logoSource = remoteLogo ? { uri: remoteLogo } : fallbackLogo;

  const go = (route, params) => {
    if (route) navigation.navigate(route, params);
  };

  return (
    <View style={styles.sidebar}>
      <ScrollView contentContainerStyle={styles.sidebarScroll}>

        {/* Logo row */}
        <View style={styles.sidebarLogoRow}>
          <Image source={logoSource} style={styles.sidebarLogo} resizeMode="contain" />
          {!remoteLogo && <Text style={styles.logoText}>AeroPlan</Text>}
        </View>

        {/* Profile row */}
        <View style={styles.sidebarProfile}>
          <ProfileAvatar
            name={displayName}
            picture={picture}
            size={globalWidth('2.5%')}
            textStyle={styles.sidebarAvatarText}
          />
          <View>
            <Text style={styles.sidebarName} numberOfLines={1}>{displayName}</Text>
            <Text style={styles.sidebarRole} numberOfLines={1}>{formatRole(role)}</Text>
          </View>
        </View>

        {/* Section card */}
        <View style={styles.sidebarSectionCard}>
          {SIDEBAR_SECTIONS.map((section) => (
            <View key={section.title} style={styles.sidebarSection}>
              <Text style={styles.sidebarSectionTitle}>{section.title}</Text>
              {section.items.map(({ icon, label, route, params }) => {
                const active = activeRoute === route || activeRoute === label;
                return (
                  <Pressable
                    key={label}
                    onPress={() => go(route, params)}
                    style={[styles.sectionItem, active && styles.sectionItemActive]}
                  >
                    <Ionicons
                      name={icon}
                      size={globalWidth('1.15%')}
                      color={active ? colors.primary : colors.textPrimary}
                    />
                    <Text style={[styles.sectionItemText, active && styles.sectionItemTextActive]}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
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

/* ─── TopBar ────────────────────────────────────────────────────────────── */

function TopBar({ displayName, role, picture, pendingCount }) {
  const navigation = useNavigation();
  const currentDate = new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  }).format(new Date());

  return (
    <View style={styles.topbar}>
      <Pressable style={styles.iconBtn}>
        <Ionicons name="menu" size={globalWidth('1.25%')} color={colors.textPrimary} />
      </Pressable>

      <View style={styles.searchBox}>
        <Ionicons name="search" size={globalWidth('0.9%')} color={colors.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search customers, orders, teams..."
          placeholderTextColor={colors.textSecondary}
        />
        <Text style={styles.shortcutBadge}>Ctrl K</Text>
      </View>

      <View style={styles.datePill}>
        <Ionicons name="calendar-outline" size={globalWidth('0.9%')} color={colors.textPrimary} />
        <Text style={styles.dateText}>{currentDate}</Text>
        <Ionicons name="chevron-down" size={globalWidth('0.8%')} color={colors.textSecondary} />
      </View>

      <Pressable
        style={styles.notifWrap}
        onPress={() => navigation.navigate('TeamInvitations')}
      >
        <Ionicons name="notifications-outline" size={globalWidth('1.25%')} color={colors.textPrimary} />
        {pendingCount > 0 && (
          <Text style={styles.notifBadge}>{pendingCount > 9 ? '9+' : pendingCount}</Text>
        )}
      </Pressable>

      <View style={styles.profileBox}>
        <ProfileAvatar
          name={displayName}
          picture={picture}
          size={globalWidth('2.5%')}
          textStyle={styles.topbarAvatarText}
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

/* ─── AppShell ──────────────────────────────────────────────────────────── */

export default function AppShell({
  userDetails,
  appMetadata,
  onSignOut,
  activeRoute,
  children,
  scrollable = true,
  pendingCount = 0,
}) {
  const user = userDetails?.user || userDetails?.data?.user || userDetails || {};
  const displayName = user.displayName || user.fullName || user.name || user.userName || 'User';
  const role = user.role || user.title || 'Representative';
  const picture = getProfilePicture(user);

  const inner = scrollable ? (
    <ScrollView contentContainerStyle={styles.scrollContent}>{children}</ScrollView>
  ) : (
    <View style={styles.fillContent}>{children}</View>
  );

  return (
    <View style={styles.shell}>
      <Sidebar
        onSignOut={onSignOut}
        appMetadata={appMetadata}
        displayName={displayName}
        role={role}
        picture={picture}
        activeRoute={activeRoute}
      />
      <View style={styles.main}>
        <TopBar
          displayName={displayName}
          role={role}
          picture={picture}
          pendingCount={pendingCount}
        />
        {inner}
      </View>
    </View>
  );
}

/* ─── Styles ────────────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.backgroundColor,
    overflow: 'hidden',
  },

  /* ── Sidebar — identical to HomeScreen ── */
  sidebar: {
    width: globalWidth('15.5%'),
    minWidth: globalWidth('12.5%'),
    maxWidth: globalWidth('16.5%'),
    borderRightWidth: 1,
    borderRightColor: colors.border,
    backgroundColor: colors.surface,
  },
  sidebarScroll: {
    padding: globalWidth('1.05%'),
    paddingBottom: globalHeight('3%'),
  },
  sidebarLogoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: globalWidth('0.5%'),
    marginBottom: globalHeight('2%'),
  },
  sidebarLogo: { width: globalWidth('2.4%'), height: globalWidth('2.4%') },
  logoText: { color: colors.primary, fontSize: globalWidth('1.1%'), fontWeight: '800' },

  sidebarProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: globalWidth('0.6%'),
    marginBottom: globalHeight('1.8%'),
  },
  sidebarAvatarText: { color: colors.primary, fontSize: globalWidth('0.72%'), fontWeight: '800' },
  sidebarName: { color: colors.textPrimary, fontSize: globalWidth('0.68%'), fontWeight: '800' },
  sidebarRole: { color: colors.textSecondary, fontSize: globalWidth('0.56%'), marginTop: globalHeight('0.25%') },

  sidebarSectionCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: globalWidth('0.65%'),
  },
  sidebarSection: { marginBottom: globalHeight('1.25%') },
  sidebarSectionTitle: {
    color: colors.textMuted,
    fontSize: globalWidth('0.56%'),
    fontWeight: '800',
    marginBottom: globalHeight('0.7%'),
  },
  sectionItem: {
    minHeight: globalHeight('4.4%'),
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: globalWidth('0.65%'),
    paddingHorizontal: globalWidth('0.6%'),
  },
  sectionItemActive: { backgroundColor: colors.surfaceSoft },
  sectionItemText: { color: colors.textPrimary, fontSize: globalWidth('0.72%'), fontWeight: '800' },
  sectionItemTextActive: { color: colors.primary },

  sidebarDivider: {
    height: globalHeight('0.1%'),
    backgroundColor: colors.border,
    marginBottom: globalHeight('1%'),
  },
  logoutItem: {
    minHeight: globalHeight('4.4%'),
    flexDirection: 'row',
    alignItems: 'center',
    gap: globalWidth('0.65%'),
    paddingHorizontal: globalWidth('0.6%'),
  },
  logoutText: { color: colors.danger, fontSize: globalWidth('0.72%'), fontWeight: '800' },

  /* ── TopBar ── */
  main: { flex: 1, minWidth: 0, overflow: 'hidden' },
  topbar: {
    height: globalHeight('8%'),
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: globalWidth('0.8%'),
    paddingHorizontal: globalWidth('1.3%'),
    overflow: 'hidden',
  },
  iconBtn: {
    width: globalWidth('2.3%'),
    height: globalWidth('2.3%'),
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBox: {
    flex: 1,
    maxWidth: globalWidth('28%'),
    minWidth: globalWidth('12%'),
    height: globalHeight('4.6%'),
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: globalWidth('0.5%'),
    paddingHorizontal: globalWidth('0.8%'),
    backgroundColor: colors.surface,
  },
  searchInput: {
    flex: 1,
    fontSize: globalWidth('0.62%'),
    color: colors.textPrimary,
    outlineStyle: 'none',
    height: '100%',
  },
  shortcutBadge: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    color: colors.textSecondary,
    fontSize: globalWidth('0.5%'),
    paddingHorizontal: globalWidth('0.35%'),
    paddingVertical: globalHeight('0.25%'),
  },
  datePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: globalWidth('0.5%'),
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: globalWidth('0.7%'),
    height: globalHeight('4.6%'),
  },
  dateText: { flex: 1, color: colors.textPrimary, fontSize: globalWidth('0.62%'), fontWeight: '700' },
  notifWrap: {
    width: globalWidth('2.2%'),
    height: globalWidth('2.2%'),
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifBadge: {
    position: 'absolute',
    right: globalWidth('0.15%'),
    top: globalHeight('0.35%'),
    minWidth: globalWidth('0.9%'),
    height: globalWidth('0.9%'),
    borderRadius: globalWidth('0.45%'),
    backgroundColor: colors.danger,
    color: colors.white,
    textAlign: 'center',
    fontSize: globalWidth('0.45%'),
    fontWeight: '800',
    overflow: 'hidden',
  },
  profileBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: globalWidth('0.55%'),
    maxWidth: globalWidth('14%'),
    flexShrink: 1,
  },
  topbarAvatarText: { color: colors.white, fontSize: globalWidth('0.68%'), fontWeight: '800' },
  profileName: { color: colors.textPrimary, fontSize: globalWidth('0.62%'), fontWeight: '800' },
  profileRole: { color: colors.textSecondary, fontSize: globalWidth('0.5%'), marginTop: globalHeight('0.2%') },

  avatarImg: { backgroundColor: colors.primaryLight },
  avatarFallback: {
    backgroundColor: colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* ── Content ── */
  scrollContent: {
    padding: globalWidth('1.3%'),
    paddingBottom: globalHeight('5%'),
  },
  fillContent: { flex: 1 },
});
