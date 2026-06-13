import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import AppShell from '../../components/AppShell';
import { colors } from '../../constants/colors';
import { globalWidth } from '../../constants/globalWidth';
import { LEGAL_UPDATED, PRIVACY_POLICY } from '../../constants/legal';

const shadow = { shadowColor: '#0B2B66', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } };
const PAD = globalWidth('1.2%');

export default function PrivacyPolicyScreen({ navigation, userDetails, appMetadata, onSignOut }) {
  const body = (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
      <View style={styles.content}>
        <View style={styles.pageHeader}>
          <Text style={styles.pageTitle}>Privacy Policy</Text>
          <Text style={styles.updated}>Last updated: {LEGAL_UPDATED}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.intro}>{PRIVACY_POLICY.intro}</Text>

          {PRIVACY_POLICY.sections.map((section) => (
            <View key={section.heading} style={styles.section}>
              <Text style={styles.heading}>{section.heading}</Text>
              <Text style={styles.body}>{section.body}</Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );

  // Public view (no authenticated user): a clean standalone page so the
  // store-required /privacy-policy URL works without logging in.
  if (!userDetails) {
    return (
      <View style={styles.publicRoot}>
        <View style={styles.publicBar}>
          <Text style={styles.publicBrand}>{appMetadata?.appName || 'AeroPlan'}</Text>
        </View>
        {body}
      </View>
    );
  }

  return (
    <AppShell navigation={navigation} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} activeRoute="Settings">
      {body}
    </AppShell>
  );
}

const styles = StyleSheet.create({
  publicRoot: { flex: 1, backgroundColor: colors.backgroundColor },
  publicBar: { paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.surface },
  publicBrand: { fontSize: 18, fontWeight: '800', color: colors.primary },
  scroll: { padding: PAD, paddingBottom: 48, alignItems: 'center' },
  content: { width: '100%', maxWidth: 820, gap: 14 },

  pageHeader: { gap: 4 },
  pageTitle: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  updated: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },

  card: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, padding: 20, gap: 16, ...shadow,
  },
  intro: { fontSize: 14, lineHeight: 22, color: colors.textSecondary },

  section: { gap: 6 },
  heading: { fontSize: 14, fontWeight: '800', color: colors.textPrimary },
  body: { fontSize: 13.5, lineHeight: 22, color: colors.textSecondary },
});
