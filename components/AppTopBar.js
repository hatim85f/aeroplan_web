import React, { useMemo } from 'react';
import {
  Image, Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { colors } from '../constants/colors';
import { globalHeight, globalWidth } from '../constants/globalWidth';
import { getProfileInitials } from '../constants/profile';

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

export default function AppTopBar({ displayName, role, picture, pendingCount = 0 }) {
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
          textStyle={styles.avatarText}
        />
        <View>
          <Text style={styles.profileName} numberOfLines={1}>{displayName}</Text>
          <Text style={styles.profileRole} numberOfLines={1}>{formatRole(role)}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
  avatarText: { color: colors.white, fontSize: globalWidth('0.68%'), fontWeight: '800' },
  profileName: { color: colors.textPrimary, fontSize: globalWidth('0.62%'), fontWeight: '800' },
  profileRole: { color: colors.textSecondary, fontSize: globalWidth('0.5%'), marginTop: globalHeight('0.2%') },
  avatarImg: { backgroundColor: colors.primaryLight },
  avatarFallback: {
    backgroundColor: colors.primaryDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
