import React from 'react';
import {
  Image, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { colors } from '../constants/colors';
import { globalHeight, globalWidth } from '../constants/globalWidth';
import { getProfileInitials } from '../constants/profile';

const fallbackLogo = require('../assets/icon.png');

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
    items: [
      { icon: 'business',          label: 'Accounts',       route: 'Accounts' },
      { icon: 'cube',              label: 'Products',       route: 'Products' },
      { icon: 'radio-button-on',   label: 'Sales Channels', route: 'SalesChannels' },
    ],
  },
  {
    title: 'ACCOUNT',
    items: [{ icon: 'person-circle', label: 'Profile', route: 'Profile' }],
  },
];

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
            picture={picture}
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

const styles = StyleSheet.create({
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

  avatarImg: { backgroundColor: colors.primaryLight },
  avatarFallback: {
    backgroundColor: colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
