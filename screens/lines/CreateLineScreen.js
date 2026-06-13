import React, { useState, useEffect } from 'react';
import {
  ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import AppShell from '../../components/AppShell';
import { colors } from '../../constants/colors';
import { globalHeight, globalWidth } from '../../constants/globalWidth';
import { getLineById, createLine, updateLine } from '../../store/lines/linesActions';
import { uploadLineLogo } from '../../store/cloudinary';

/* ─── Field wrapper ─────────────────────────────────────────────────────── */
function Field({ label, required, error, children }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>
        {label}
        {required && <Text style={styles.required}> *</Text>}
      </Text>
      {children}
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

/* ─── Main ──────────────────────────────────────────────────────────────── */
export default function CreateLineScreen({ navigation, route, userDetails, appMetadata, onSignOut }) {
  const lineId = route?.params?.lineId;
  const isEdit = !!lineId;

  const token = userDetails?.token || userDetails?.data?.token || '';

  const [loadingInit, setLoadingInit] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');

  const [logoPreview, setLogoPreview] = useState(null);
  const [logoUrl, setLogoUrl] = useState('');
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState('');

  const [form, setForm] = useState({
    lineId: '',
    lineName: '',
    description: '',
    isActive: true,
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!isEdit) return;
    setLoadingInit(true);
    setLoadError('');
    getLineById(token, lineId)
      .then((data) => {
        setForm({
          lineId: data?.lineId || data?._id || lineId,
          lineName: data?.lineName || data?.name || '',
          description: data?.description || '',
          isActive: data?.isActive !== false,
        });
        const existingLogo = data?.lineLogo || data?.logo || data?.logoUrl || '';
        if (existingLogo) {
          setLogoPreview(existingLogo);
          setLogoUrl(existingLogo);
        }
      })
      .catch((e) => setLoadError(e.message || 'Failed to load line'))
      .finally(() => setLoadingInit(false));
  }, [isEdit, lineId, token]);

  const set = (key) => (val) => setForm((f) => ({ ...f, [key]: val }));

  const validate = () => {
    const errs = {};
    if (!isEdit && !form.lineId.trim()) errs.lineId = 'Line ID is required';
    if (!form.lineName.trim()) errs.lineName = 'Line Name is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handlePickLogo = async () => {
    setLogoError('');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (result.canceled) return;
    const uri = result.assets?.[0]?.uri;
    if (!uri) return;
    setLogoPreview(uri);
    setLogoUploading(true);
    try {
      const uploaded = await uploadLineLogo(uri);
      setLogoUrl(uploaded.secureUrl || uploaded.url);
    } catch (e) {
      setLogoError(e.message || 'Logo upload failed');
    } finally {
      setLogoUploading(false);
    }
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    setSaveError('');
    try {
      const body = {
        lineName: form.lineName.trim(),
        isActive: form.isActive,
        ...(!isEdit ? { lineId: form.lineId.trim() } : {}),
        ...(form.description.trim() ? { description: form.description.trim() } : {}),
        ...(logoUrl ? { lineLogo: logoUrl } : {}),
      };
      if (isEdit) {
        await updateLine(token, lineId, body);
      } else {
        await createLine(token, body);
      }
      navigation.navigate('Lines');
    } catch (e) {
      setSaveError(e.message || 'Failed to save line');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell
      navigation={navigation}
      userDetails={userDetails}
      appMetadata={appMetadata}
      onSignOut={onSignOut}
      activeRoute="Lines"
    >
      {/* Breadcrumb */}
      <View style={styles.breadcrumb}>
        <Pressable onPress={() => navigation.navigate('Lines')}>
          <Text style={styles.breadcrumbLink}>Lines</Text>
        </Pressable>
        <Ionicons name="chevron-forward" size={13} color={colors.textMuted} />
        <Text style={styles.breadcrumbCurrent}>{isEdit ? 'Edit Line' : 'Create Line'}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{isEdit ? 'Edit Line' : 'Create New Line'}</Text>
        <Text style={styles.cardSubtitle}>
          {isEdit ? 'Update the details for this product line.' : 'Fill in the details to create a new product line.'}
        </Text>

        {loadingInit ? (
          <View style={styles.centered}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : loadError ? (
          <View style={styles.centered}>
            <Text style={styles.errorText}>{loadError}</Text>
          </View>
        ) : (
          <View style={styles.form}>
            {/* Logo upload */}
            <Field label="Line Logo" error={logoError}>
              <Pressable style={styles.logoPlaceholder} onPress={handlePickLogo} disabled={logoUploading}>
                {logoPreview ? (
                  <Image source={{ uri: logoPreview }} style={styles.logoPreview} resizeMode="cover" />
                ) : (
                  <Ionicons name="image-outline" size={28} color={colors.textMuted} />
                )}
                <View style={styles.logoLabelRow}>
                  {logoUploading ? (
                    <>
                      <ActivityIndicator size={14} color={colors.primary} />
                      <Text style={styles.logoPlaceholderText}>Uploading...</Text>
                    </>
                  ) : logoPreview ? (
                    <>
                      <Ionicons name="refresh-outline" size={14} color={colors.primary} />
                      <Text style={[styles.logoPlaceholderText, { color: colors.primary }]}>Change Logo</Text>
                    </>
                  ) : (
                    <>
                      <Text style={styles.logoPlaceholderText}>Upload Logo</Text>
                      <Text style={styles.logoPlaceholderSub}>PNG, JPG up to 2MB</Text>
                    </>
                  )}
                </View>
              </Pressable>
            </Field>

            {/* Line ID */}
            <Field label="Line ID" required error={errors.lineId}>
              <TextInput
                style={[styles.input, isEdit && styles.inputReadOnly, errors.lineId && styles.inputError]}
                value={form.lineId}
                onChangeText={set('lineId')}
                placeholder="e.g. CARDIO-01"
                placeholderTextColor={colors.textMuted}
                editable={!isEdit}
              />
              {isEdit && (
                <Text style={styles.fieldHint}>Line ID cannot be changed after creation.</Text>
              )}
            </Field>

            {/* Line Name */}
            <Field label="Line Name" required error={errors.lineName}>
              <TextInput
                style={[styles.input, errors.lineName && styles.inputError]}
                value={form.lineName}
                onChangeText={set('lineName')}
                placeholder="e.g. Cardiology Line"
                placeholderTextColor={colors.textMuted}
              />
            </Field>

            {/* Description */}
            <Field label="Description">
              <TextInput
                style={[styles.input, styles.inputMulti]}
                value={form.description}
                onChangeText={set('description')}
                placeholder="Describe the purpose of this line..."
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </Field>

            {/* Status */}
            <Field label="Status">
              <View style={styles.switchRow}>
                <Switch
                  value={form.isActive}
                  onValueChange={set('isActive')}
                  thumbColor={form.isActive ? colors.primary : colors.textMuted}
                  trackColor={{ false: colors.border, true: colors.primaryLight }}
                />
                <Text style={styles.switchLabel}>{form.isActive ? 'Active' : 'Inactive'}</Text>
              </View>
            </Field>

            {saveError ? <Text style={styles.errorText}>{saveError}</Text> : null}

            {/* Actions */}
            <View style={styles.actionRow}>
              <Pressable style={styles.btnCancel} onPress={() => navigation.goBack()}>
                <Text style={styles.btnCancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.btnPrimary} onPress={handleSave} disabled={saving}>
                {saving
                  ? <ActivityIndicator size={14} color={colors.white} />
                  : <Ionicons name="checkmark" size={15} color={colors.white} />}
                <Text style={styles.btnPrimaryText}>
                  {saving ? 'Saving...' : isEdit ? 'Update Line' : 'Save Line'}
                </Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </AppShell>
  );
}

/* ─── Styles ────────────────────────────────────────────────────────────── */
const shadow = { shadowColor: '#11224A', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 14, elevation: 3 };

const styles = StyleSheet.create({
  breadcrumb: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: globalHeight('1.5%'),
  },
  breadcrumbLink: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  breadcrumbCurrent: { fontSize: 13, color: colors.textSecondary },

  card: {
    maxWidth: 680,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    backgroundColor: colors.surface,
    padding: 24,
    ...shadow,
  },
  cardTitle: { fontSize: 18, fontWeight: '800', color: colors.textPrimary, marginBottom: 4 },
  cardSubtitle: { fontSize: 13, color: colors.textSecondary, marginBottom: 24 },

  form: { gap: 18 },

  field: { gap: 6 },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  required: { color: colors.danger },
  fieldError: { fontSize: 12, color: colors.danger },
  fieldHint: { fontSize: 11, color: colors.textMuted, marginTop: 2 },

  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40,
    fontSize: 13,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
    outlineStyle: 'none',
  },
  inputReadOnly: { backgroundColor: colors.backgroundColor, color: colors.textMuted },
  inputError: { borderColor: colors.danger },
  inputMulti: { height: 100, paddingTop: 10 },

  logoPlaceholder: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.backgroundColor,
  },
  logoPreview: { width: 72, height: 72, borderRadius: 8 },
  logoLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  logoPlaceholderText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  logoPlaceholderSub: { fontSize: 11, color: colors.textMuted },

  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  switchLabel: { fontSize: 13, color: colors.textPrimary, fontWeight: '600' },

  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 8,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  btnCancel: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btnCancelText: { fontSize: 13, color: colors.textSecondary, fontWeight: '700' },
  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 8,
    opacity: 1,
  },
  btnPrimaryText: { color: colors.white, fontSize: 13, fontWeight: '700' },

  centered: { alignItems: 'center', padding: 32 },
  errorText: { color: colors.danger, fontSize: 13, textAlign: 'center' },
});
