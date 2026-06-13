import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AppShell from '../../components/AppShell';
import { colors } from '../../constants/colors';
import { globalWidth } from '../../constants/globalWidth';
import { changePassword } from '../../store/auth/authActions';

const shadow = { shadowColor: '#11224A', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 14, elevation: 3 };
const PAD = globalWidth('1.2%');

export default function ChangePasswordScreen({ navigation, userDetails, appMetadata, onSignOut }) {
  const token = userDetails?.token || userDetails?.data?.token || '';

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async () => {
    setError('');
    setSuccess('');

    if (!current.trim() || !next.trim() || !confirm.trim()) {
      setError('Please fill in all fields.');
      return;
    }
    if (next.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }
    if (next !== confirm) {
      setError('New password and confirmation do not match.');
      return;
    }

    setSaving(true);
    try {
      const res = await changePassword(token, { currentPassword: current, newPassword: next });
      setSuccess(res?.message || 'Password updated successfully.');
      setCurrent('');
      setNext('');
      setConfirm('');
      setTimeout(() => navigation.navigate('Settings'), 1200);
    } catch (e) {
      setError(e?.message || 'Failed to change password. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell navigation={navigation} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} activeRoute="Settings">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.content}>
          <View style={styles.pageHeader}>
            <Text style={styles.pageTitle}>Change Password</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Change Password</Text>
            <Text style={styles.cardSubtitle}>Enter your current password and choose a new one.</Text>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Current Password</Text>
              <TextInput
                style={styles.input}
                value={current}
                onChangeText={setCurrent}
                placeholder="Enter current password"
                placeholderTextColor={colors.textMuted}
                secureTextEntry
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>New Password</Text>
              <TextInput
                style={styles.input}
                value={next}
                onChangeText={setNext}
                placeholder="At least 8 characters"
                placeholderTextColor={colors.textMuted}
                secureTextEntry
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Confirm New Password</Text>
              <TextInput
                style={styles.input}
                value={confirm}
                onChangeText={setConfirm}
                placeholder="Re-enter new password"
                placeholderTextColor={colors.textMuted}
                secureTextEntry
              />
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}
            {success ? <Text style={styles.successText}>{success}</Text> : null}

            <View style={styles.actionRow}>
              <Pressable style={styles.btnCancel} onPress={() => navigation.navigate('Settings')}>
                <Text style={styles.btnCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.btnPrimary, saving && styles.btnDisabled]} onPress={handleSubmit} disabled={saving}>
                {saving && <ActivityIndicator size={14} color={colors.white} />}
                <Ionicons name="lock-closed-outline" size={14} color={colors.white} />
                <Text style={styles.btnPrimaryText}>{saving ? 'Saving...' : 'Update Password'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </ScrollView>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: PAD, paddingBottom: 48, alignItems: 'center' },
  content: { width: '100%', maxWidth: 520, gap: 14 },

  pageHeader: { gap: 4 },
  pageTitle: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },

  card: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 14, padding: 20, gap: 14, ...shadow,
  },
  cardTitle: { fontSize: 17, fontWeight: '800', color: colors.textPrimary },
  cardSubtitle: { fontSize: 13, color: colors.textSecondary, marginBottom: 4 },

  field: { gap: 6 },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    paddingHorizontal: 12, height: 40, fontSize: 13, color: colors.textPrimary,
    backgroundColor: colors.surface, outlineStyle: 'none',
  },

  errorText: { color: colors.danger, fontSize: 13 },
  successText: { color: colors.success, fontSize: 13, fontWeight: '700' },

  actionRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 4 },
  btnPrimary: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary, paddingHorizontal: 18, paddingVertical: 9, borderRadius: 8 },
  btnPrimaryText: { color: colors.white, fontSize: 13, fontWeight: '700' },
  btnDisabled: { opacity: 0.6 },
  btnCancel: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  btnCancelText: { fontSize: 13, color: colors.textSecondary, fontWeight: '700' },
});
