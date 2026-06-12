import React, { useMemo } from 'react';
import { Platform, ScrollView, StyleSheet, View } from 'react-native';

import { getProfilePicture } from '../constants/profile';
import { globalHeight, globalWidth } from '../constants/globalWidth';
import { colors } from '../constants/colors';
import AppSidebar from './AppSidebar';
import AppTopBar from './AppTopBar';

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
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
      {children}
    </ScrollView>
  ) : (
    <View style={styles.fillContent}>{children}</View>
  );

  return (
    <View style={styles.shell}>
      <AppSidebar
        onSignOut={onSignOut}
        appMetadata={appMetadata}
        displayName={displayName}
        role={role}
        picture={picture}
        activeRoute={activeRoute}
      />
      <View style={styles.main}>
        <AppTopBar
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

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.backgroundColor,
    overflow: 'hidden',
  },
  main: { flex: 1, minWidth: 0, minHeight: 0, overflow: 'hidden' },
  scrollView: {
    flex: 1,
    minHeight: 0,
    ...(Platform.OS === 'web' ? { overflowY: 'auto' } : null),
  },
  scrollContent: {
    flexGrow: 1,
    padding: globalWidth('1.3%'),
    paddingBottom: globalHeight('5%'),
  },
  fillContent: { flex: 1, minHeight: 0 },
});
