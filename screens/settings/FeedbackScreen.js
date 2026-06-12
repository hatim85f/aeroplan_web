import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AppShell from '../../components/AppShell';
import { colors } from '../../constants/colors';
import { globalWidth } from '../../constants/globalWidth';
import { APP_VERSION, BUILD_NUMBER } from '../../constants/legal';
import { submitFeedback } from '../../store/feedback/feedbackActions';

const shadow = { shadowColor: '#0B2B66', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } };
const PAD = globalWidth('1.2%');

const COPY = {
  problem: {
    title: 'Report a Problem',
    subtitle: 'Tell us what went wrong. Include as much detail as you can so we can fix it quickly.',
    placeholder: 'Describe the problem you ran into...',
    icon: 'bug-outline',
    button: 'Submit Report',
  },
  feedback: {
    title: 'Send Feedback',
    subtitle: "Share your ideas, suggestions, or anything you'd like us to improve.",
    placeholder: 'Share your thoughts...',
    icon: 'chatbubble-ellipses-outline',
    button: 'Send Feedback',
  },
};

export default function FeedbackScreen({ navigation, route, userDetails, appMetadata, onSignOut }) {
  const type = route?.params?.type === 'problem' ? 'problem' : 'feedback';
  const copy = COPY[type];

  const token = userDetails?.token || userDetails?.data?.token || '';

  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async () => {
    setError('');
    setSuccess('');

    if (!message.trim()) {
      setError('Please enter a message before submitting.');
      return;
    }

    setSaving(true);
    try {
      const res = await submitFeedback(token, {
        type,
        message: message.trim(),
        appVersion: APP_VERSION,
        buildNumber: BUILD_NUMBER,
        platform: 'web',
      });
      setSuccess(res?.message || 'Thank you! Your message has been submitted.');
      setMessage('');
    } catch (e) {
      setError(e?.message || 'Failed to submit. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell navigation={navigation} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} activeRoute="Settings">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={styles.content}>
          <View style={styles.pageHeader}>
            <Text style={styles.pageTitle}>{copy.title}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>{copy.title}</Text>
            <Text style={styles.cardSubtitle}>{copy.subtitle}</Text>

            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Message</Text>
              <TextInput
                style={[styles.input, styles.inputMulti]}
                value={message}
                onChangeText={setMessage}
                placeholder={copy.placeholder}
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
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
                <Ionicons name={copy.icon} size={14} color={colors.white} />
                <Text style={styles.btnPrimaryText}>{saving ? 'Submitting...' : copy.button}</Text>
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
    borderRadius: 12, padding: 20, gap: 14, ...shadow,
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
  inputMulti: { height: 140, paddingTop: 10 },

  errorText: { color: colors.danger, fontSize: 13 },
  successText: { color: colors.success, fontSize: 13, fontWeight: '700' },

  actionRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 4 },
  btnPrimary: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary, paddingHorizontal: 18, paddingVertical: 9, borderRadius: 8 },
  btnPrimaryText: { color: colors.white, fontSize: 13, fontWeight: '700' },
  btnDisabled: { opacity: 0.6 },
  btnCancel: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  btnCancelText: { fontSize: 13, color: colors.textSecondary, fontWeight: '700' },
});
