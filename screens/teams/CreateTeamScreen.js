import React, { useState, useEffect } from 'react';
import {
  ActivityIndicator, Image, Pressable, StyleSheet, Switch, Text, TextInput, View, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import AppShell from '../../components/AppShell';
import { colors } from '../../constants/colors';
import { globalHeight, globalWidth } from '../../constants/globalWidth';
import { getTeamById, createTeam, updateTeam } from '../../store/teams/teamsActions';
import { getLines } from '../../store/lines/linesActions';
import { uploadTeamLogo } from '../../store/cloudinary';

/* ─── Field wrapper ─────────────────────────────────────────────────────── */
function Field({ label, required, error, hint, children }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>
        {label}{required && <Text style={styles.required}> *</Text>}
      </Text>
      {children}
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

/* ─── Line selector row ─────────────────────────────────────────────────── */
function LineSelectorRow({ lines, selectedIds, onChange, navigation }) {
  const toggleLine = (lineId) => {
    if (selectedIds.includes(lineId)) {
      onChange(selectedIds.filter((id) => id !== lineId));
    } else {
      onChange([...selectedIds, lineId]);
    }
  };

  if (!lines.length) {
    return (
      <View style={styles.linesEmptyBox}>
        <Text style={styles.fieldHint}>No lines available. </Text>
        <Pressable onPress={() => navigation.navigate('CreateLine')}>
          <Text style={styles.linkText}>+ Create New Line</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.linesBox}>
      {lines.map((line) => {
        const id = line.lineId || line._id || line.id;
        const name = line.lineName || line.name || 'Unnamed';
        const selected = selectedIds.includes(id);
        return (
          <Pressable key={id} style={styles.lineCheckRow} onPress={() => toggleLine(id)}>
            <View style={[styles.checkbox, selected && styles.checkboxChecked]}>
              {selected && <Ionicons name="checkmark" size={12} color={colors.white} />}
            </View>
            <Text style={styles.lineCheckName}>{name}</Text>
          </Pressable>
        );
      })}
      <Pressable onPress={() => navigation.navigate('CreateLine')}>
        <Text style={[styles.linkText, { marginTop: 6 }]}>+ Create New Line</Text>
      </Pressable>
    </View>
  );
}

/* ─── Visibility Dropdown ───────────────────────────────────────────────── */
function VisibilityDropdown({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const OPTIONS = ['private', 'organization'];
  return (
    <View>
      <Pressable style={styles.dropdownTrigger} onPress={() => setOpen((v) => !v)}>
        <Text style={styles.dropdownValue}>{value.charAt(0).toUpperCase() + value.slice(1)}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={14} color={colors.textSecondary} />
      </Pressable>
      {open && (
        <View style={styles.dropdownMenu}>
          {OPTIONS.map((opt) => (
            <Pressable
              key={opt}
              style={[styles.dropdownOption, value === opt && styles.dropdownOptionActive]}
              onPress={() => { onChange(opt); setOpen(false); }}
            >
              <Text style={[styles.dropdownOptionText, value === opt && styles.dropdownOptionTextActive]}>
                {opt.charAt(0).toUpperCase() + opt.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

/* ─── Main ──────────────────────────────────────────────────────────────── */
export default function CreateTeamScreen({ navigation, route, userDetails, appMetadata, onSignOut }) {
  const teamId = route?.params?.teamId;
  const isEdit = !!teamId;
  const token = userDetails?.token || userDetails?.data?.token || '';

  const [loadingInit, setLoadingInit] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saveMessage, setSaveMessage] = useState('');

  const [availableLines, setAvailableLines] = useState([]);
  const [linesLoading, setLinesLoading] = useState(true);

  const [logoPreview, setLogoPreview] = useState(null);
  const [logoUrl, setLogoUrl] = useState('');
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState('');

  const [form, setForm] = useState({
    teamName: '',
    description: '',
    lineIds: [],
    territory: '',
    area: '',
    visibility: 'private',
    isActive: true,
  });
  const [errors, setErrors] = useState({});

  // Fetch available lines
  useEffect(() => {
    getLines(token)
      .then((data) => setAvailableLines(Array.isArray(data) ? data : []))
      .catch(() => setAvailableLines([]))
      .finally(() => setLinesLoading(false));
  }, [token]);

  // Fetch team data if editing
  useEffect(() => {
    if (!isEdit) return;
    setLoadingInit(true);
    setLoadError('');
    getTeamById(token, teamId)
      .then((data) => {
        // Normalize lineIds from whatever shape the backend returns
        let lineIds = [];
        if (Array.isArray(data?.lineIds) && data.lineIds.length) {
          lineIds = data.lineIds;
        } else if (Array.isArray(data?.lines) && data.lines.length) {
          lineIds = data.lines.map((l) => l.lineId || l._id || l.id).filter(Boolean);
        } else if (data?.line) {
          const id = data.line._id || data.line.id || data.line.lineId;
          if (id) lineIds = [id];
        } else if (data?.lineId) {
          lineIds = [data.lineId];
        }
        setForm({
          teamName: data?.teamName || data?.name || '',
          description: data?.description || '',
          lineIds,
          territory: data?.territory || '',
          area: data?.area || '',
          visibility: data?.visibility || 'private',
          isActive: data?.isActive !== false,
        });
        const existingLogo = data?.teamLogo || data?.logo || data?.logoUrl || '';
        if (existingLogo) {
          setLogoPreview(existingLogo);
          setLogoUrl(existingLogo);
        }
      })
      .catch((e) => setLoadError(e.message || 'Failed to load team'))
      .finally(() => setLoadingInit(false));
  }, [isEdit, teamId, token]);

  const set = (key) => (val) => setForm((f) => ({ ...f, [key]: val }));

  const validate = () => {
    const errs = {};
    if (!form.teamName.trim()) errs.teamName = 'Team Name is required';
    if (!form.lineIds.length) errs.lineIds = 'Select at least one line';
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
      const uploaded = await uploadTeamLogo(uri);
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
    setSaveMessage('');
    try {
      const lineNames = form.lineIds
        .map((id) => {
          const found = availableLines.find((l) => (l.lineId || l._id || l.id) === id);
          return found?.lineName || found?.name || '';
        })
        .filter(Boolean);
      const body = {
        teamName: form.teamName.trim(),
        lineIds: form.lineIds,
        ...(lineNames.length ? { lineNames } : {}),
        ...(form.description.trim() ? { description: form.description.trim() } : {}),
        ...(form.territory.trim() ? { territory: form.territory.trim() } : {}),
        ...(form.area.trim() ? { area: form.area.trim() } : {}),
        visibility: form.visibility,
        isActive: form.isActive,
        status: form.isActive ? 'active' : 'archived',
        ...(logoUrl ? { teamLogo: logoUrl } : {}),
      };
      let result;
      if (isEdit) {
        result = await updateTeam(token, teamId, body);
      } else {
        result = await createTeam(token, body);
      }
      const added = result?.added || result?.addedCount || 0;
      const skipped = result?.skipped || result?.skippedCount || 0;
      setSaveMessage(`Team saved.${added ? ` ${added} reps added.` : ''}${skipped ? ` ${skipped} skipped.` : ''}`);
      setTimeout(() => navigation.navigate('Teams'), 1200);
    } catch (e) {
      setSaveError(e.message || 'Failed to save team');
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
      activeRoute="Teams"
    >
      {/* Breadcrumb */}
      <View style={styles.breadcrumb}>
        <Pressable onPress={() => navigation.navigate('Teams')}>
          <Text style={styles.breadcrumbLink}>Teams</Text>
        </Pressable>
        <Ionicons name="chevron-forward" size={13} color={colors.textMuted} />
        <Text style={styles.breadcrumbCurrent}>{isEdit ? 'Edit Team' : 'Create Team'}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{isEdit ? 'Edit Team' : 'Create New Team'}</Text>
        <Text style={styles.cardSubtitle}>
          {isEdit ? 'Update the details for this team.' : 'Fill in the details to create a new team.'}
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
          <View style={styles.twoColForm}>
            {/* ── Left column ── */}
            <View style={styles.formCol}>
              <Field label="Team Logo" error={logoError}>
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

              <Field label="Team Name" required error={errors.teamName}>
                <TextInput
                  style={[styles.input, errors.teamName && styles.inputError]}
                  value={form.teamName}
                  onChangeText={set('teamName')}
                  placeholder="e.g. North Zone Alpha"
                  placeholderTextColor={colors.textMuted}
                />
              </Field>

              <Field label="Description">
                <TextInput
                  style={[styles.input, styles.inputMulti]}
                  value={form.description}
                  onChangeText={set('description')}
                  placeholder="Describe this team's focus..."
                  placeholderTextColor={colors.textMuted}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </Field>

              <Field label="Lines" required error={errors.lineIds} hint="Select all lines this team covers.">
                {linesLoading ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <LineSelectorRow
                    lines={availableLines}
                    selectedIds={form.lineIds}
                    onChange={set('lineIds')}
                    navigation={navigation}
                  />
                )}
              </Field>
            </View>

            {/* ── Right column ── */}
            <View style={styles.formCol}>
              <Field label="Territory" required error={errors.territory}>
                <TextInput
                  style={[styles.input, errors.territory && styles.inputError]}
                  value={form.territory}
                  onChangeText={set('territory')}
                  placeholder="e.g. North Region"
                  placeholderTextColor={colors.textMuted}
                />
              </Field>

              <Field label="Area" required error={errors.area}>
                <TextInput
                  style={[styles.input, errors.area && styles.inputError]}
                  value={form.area}
                  onChangeText={set('area')}
                  placeholder="e.g. North Zone"
                  placeholderTextColor={colors.textMuted}
                />
              </Field>

              <Field label="Visibility" required>
                <VisibilityDropdown value={form.visibility} onChange={set('visibility')} />
              </Field>

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
              {saveMessage ? <Text style={styles.successText}>{saveMessage}</Text> : null}

              <View style={styles.actionRow}>
                <Pressable style={styles.btnCancel} onPress={() => navigation.goBack()}>
                  <Text style={styles.btnCancelText}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.btnPrimary} onPress={handleSave} disabled={saving}>
                  {saving && <ActivityIndicator size={14} color={colors.white} />}
                  <Text style={styles.btnPrimaryText}>
                    {saving ? 'Saving...' : isEdit ? 'Update Team' : 'Save Team'}
                  </Text>
                </Pressable>
              </View>
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
  breadcrumb: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: globalHeight('1.5%') },
  breadcrumbLink: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  breadcrumbCurrent: { fontSize: 13, color: colors.textSecondary },

  card: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    backgroundColor: colors.surface, padding: 24, ...shadow,
  },
  cardTitle: { fontSize: 18, fontWeight: '800', color: colors.textPrimary, marginBottom: 4 },
  cardSubtitle: { fontSize: 13, color: colors.textSecondary, marginBottom: 24 },

  twoColForm: { flexDirection: 'row', gap: 24, alignItems: 'flex-start' },
  formCol: { flex: 1, gap: 18, minWidth: 0 },

  field: { gap: 6 },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  required: { color: colors.danger },
  fieldError: { fontSize: 12, color: colors.danger },
  fieldHint: { fontSize: 11, color: colors.textMuted },

  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    paddingHorizontal: 12, height: 40, fontSize: 13, color: colors.textPrimary,
    backgroundColor: colors.surface, outlineStyle: 'none',
  },
  inputError: { borderColor: colors.danger },
  inputMulti: { height: 88, paddingTop: 10 },

  logoPlaceholder: {
    borderWidth: 2, borderStyle: 'dashed', borderColor: colors.border, borderRadius: 8,
    padding: 16, alignItems: 'center', gap: 8, backgroundColor: colors.backgroundColor,
  },
  logoPreview: { width: 72, height: 72, borderRadius: 8 },
  logoLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  logoPlaceholderText: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  logoPlaceholderSub: { fontSize: 11, color: colors.textMuted },

  linesBox: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    padding: 12, gap: 8, backgroundColor: colors.backgroundColor,
  },
  linesEmptyBox: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 12,
  },
  lineCheckRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkbox: {
    width: 18, height: 18, borderRadius: 4, borderWidth: 2, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  lineCheckName: { fontSize: 13, color: colors.textPrimary, fontWeight: '600' },
  linkText: { fontSize: 13, color: colors.primary, fontWeight: '700' },

  dropdownTrigger: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    paddingHorizontal: 12, height: 40,
  },
  dropdownValue: { fontSize: 13, color: colors.textPrimary },
  dropdownMenu: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    backgroundColor: colors.surface, marginTop: 4, overflow: 'hidden', ...shadow,
    zIndex: 100,
  },
  dropdownOption: { paddingHorizontal: 12, paddingVertical: 10 },
  dropdownOptionActive: { backgroundColor: colors.primaryLight },
  dropdownOptionText: { fontSize: 13, color: colors.textPrimary },
  dropdownOptionTextActive: { color: colors.primary, fontWeight: '700' },

  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  switchLabel: { fontSize: 13, color: colors.textPrimary, fontWeight: '600' },

  actionRow: {
    flexDirection: 'row', justifyContent: 'flex-end', gap: 10,
    marginTop: 'auto', paddingTop: 18, borderTopWidth: 1, borderTopColor: colors.border,
  },
  btnCancel: {
    paddingHorizontal: 18, paddingVertical: 9, borderRadius: 8,
    borderWidth: 1, borderColor: colors.border,
  },
  btnCancelText: { fontSize: 13, color: colors.textSecondary, fontWeight: '700' },
  btnPrimary: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.primary, paddingHorizontal: 18, paddingVertical: 9, borderRadius: 8,
  },
  btnPrimaryText: { color: colors.white, fontSize: 13, fontWeight: '700' },

  centered: { alignItems: 'center', padding: 32 },
  errorText: { color: colors.danger, fontSize: 13 },
  successText: { color: colors.success, fontSize: 13, fontWeight: '700' },
});
