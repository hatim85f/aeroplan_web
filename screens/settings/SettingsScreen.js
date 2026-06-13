import React, { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AppShell from '../../components/AppShell';
import { colors } from '../../constants/colors';
import { globalWidth } from '../../constants/globalWidth';
import { APP_VERSION, BUILD_NUMBER, COPYRIGHT, SUPPORT_EMAIL } from '../../constants/legal';
import { deleteMyAccount } from '../../store/auth/authActions';

const shadow = { shadowColor: '#11224A', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 14, elevation: 3 };
const PAD = globalWidth('1.2%');

/* ── Reusable tappable / static row ── */
function SettingRow({ icon, label, value, tag, danger, onPress, showChevron, divider }) {
  const interactive = typeof onPress === 'function';
  const iconColor = danger ? colors.danger : colors.primary;
  const labelColor = danger ? colors.danger : colors.textPrimary;

  return (
    <Pressable
      style={[styles.row, divider && styles.rowDivider, !interactive && styles.rowStatic]}
      onPress={onPress}
      disabled={!interactive}
    >
      {icon ? <Ionicons name={icon} size={18} color={iconColor} /> : null}
      <Text style={[styles.rowLabel, { color: labelColor }]}>{label}</Text>

      {value ? <Text style={styles.rowValue}>{value}</Text> : null}
      {tag ? (
        <View style={styles.tag}>
          <Text style={styles.tagText}>{tag}</Text>
        </View>
      ) : null}
      {showChevron && interactive ? (
        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
      ) : null}
    </Pressable>
  );
}

function SectionCard({ title, children }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      <View style={styles.rowGroup}>{children}</View>
    </View>
  );
}

export default function SettingsScreen({ navigation, userDetails, appMetadata, onSignOut }) {
  const token = userDetails?.token || userDetails?.data?.token || '';
  const [deleting, setDeleting] = useState(false);

  const handleDeleteAccount = async () => {
    if (deleting) return;
    const ok = window.confirm('This will deactivate your account and sign you out. Continue?');
    if (!ok) return;
    setDeleting(true);
    try {
      await deleteMyAccount(token);
      onSignOut?.();
    } catch (e) {
      window.alert(e?.message || 'Failed to delete account. Please try again.');
      setDeleting(false);
    }
  };

  const handleContactSupport = () => {
    Linking.openURL('mailto:' + SUPPORT_EMAIL);
  };

  return (
    <AppShell navigation={navigation} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} activeRoute="Settings">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.content}>
          <View style={styles.pageHeader}>
            <Text style={styles.pageTitle}>Settings</Text>
          </View>

          {/* ── Account ── */}
          <SectionCard title="Account">
            <SettingRow
              icon="lock-closed-outline"
              label="Change Password"
              showChevron
              divider
              onPress={() => navigation.navigate('ChangePassword')}
            />
            <SettingRow
              icon="trash-outline"
              label={deleting ? 'Deleting…' : 'Delete My Account'}
              danger
              showChevron
              onPress={handleDeleteAccount}
            />
          </SectionCard>

          {/* ── Preferences ── */}
          <SectionCard title="Preferences">
            <SettingRow
              icon="color-palette-outline"
              label="Theme"
              tag="Coming Soon"
            />
          </SectionCard>

          {/* ── Support ── */}
          <SectionCard title="Support">
            <SettingRow
              icon="mail-outline"
              label="Contact Support"
              showChevron
              divider
              onPress={handleContactSupport}
            />
            <SettingRow
              icon="bug-outline"
              label="Report a Problem"
              showChevron
              divider
              onPress={() => navigation.navigate('Feedback', { type: 'problem' })}
            />
            <SettingRow
              icon="chatbubble-ellipses-outline"
              label="Send Feedback"
              showChevron
              onPress={() => navigation.navigate('Feedback', { type: 'feedback' })}
            />
          </SectionCard>

          {/* ── About ── */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>About</Text>
            <View style={styles.rowGroup}>
              <SettingRow icon="information-circle-outline" label="App Version" value={APP_VERSION} divider />
              <SettingRow icon="construct-outline" label="Build Number" value={BUILD_NUMBER} />
            </View>

            <Text style={styles.subSectionTitle}>Legal</Text>
            <View style={styles.rowGroup}>
              <SettingRow
                icon="shield-checkmark-outline"
                label="Privacy Policy"
                showChevron
                divider
                onPress={() => navigation.navigate('PrivacyPolicy')}
              />
              <SettingRow
                icon="document-text-outline"
                label="Terms & Conditions"
                showChevron
                onPress={() => navigation.navigate('Terms')}
              />
            </View>
          </View>

          {/* ── Footer ── */}
          <View style={styles.footer}>
            <Text style={styles.copyright}>{COPYRIGHT}</Text>
            <Text style={styles.version}>AeroPlan · v{APP_VERSION} (build {BUILD_NUMBER})</Text>
          </View>
        </View>
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: PAD, paddingBottom: 48, alignItems: 'center' },
  content: { width: '100%', maxWidth: 820, gap: 14 },

  pageHeader: { gap: 4 },
  pageTitle: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },

  card: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, padding: 16, gap: 12, ...shadow,
  },
  cardTitle: { fontSize: 14, fontWeight: '800', color: colors.textPrimary },
  subSectionTitle: { fontSize: 12, fontWeight: '800', color: colors.textSecondary, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.4 },

  rowGroup: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    backgroundColor: colors.surface, overflow: 'hidden',
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 14, paddingVertical: 14,
  },
  rowStatic: { cursor: 'default' },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  rowLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  rowValue: { fontSize: 13, color: colors.textSecondary, fontWeight: '700' },

  tag: {
    backgroundColor: colors.surfaceSoft, borderWidth: 1, borderColor: colors.border,
    borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2,
  },
  tagText: { fontSize: 11, color: colors.textMuted, fontWeight: '700' },

  footer: { alignItems: 'center', gap: 4, marginTop: 6 },
  copyright: { fontSize: 12, color: colors.textMuted, fontWeight: '600', textAlign: 'center' },
  version: { fontSize: 11, color: colors.textMuted, fontWeight: '600', textAlign: 'center' },
});
