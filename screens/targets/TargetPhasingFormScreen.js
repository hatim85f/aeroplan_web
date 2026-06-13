import React, { useState, useEffect } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AppShell from '../../components/AppShell';
import { colors } from '../../constants/colors';
import { globalHeight, globalWidth } from '../../constants/globalWidth';
import {
  createTargetPhasing,
  updateTargetPhasing,
  getTargetPhasingById,
} from '../../store/targets/targetPhasingActions';

const THIS_YEAR = new Date().getFullYear();
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const emptyMonths = () =>
  MONTH_NAMES.map((_, i) => ({ month: i + 1, percentage: '' }));

function Field({ label, required, error, hint, children }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>
        {label}{required && <Text style={styles.required}> *</Text>}
      </Text>
      {children}
      {hint  ? <Text style={styles.fieldHint}>{hint}</Text>   : null}
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

export default function TargetPhasingFormScreen({ navigation, route, userDetails, appMetadata, onSignOut }) {
  const mode     = route?.params?.mode || 'create';
  const phasingId = route?.params?.phasingId;
  const isEdit   = mode === 'edit' && !!phasingId;

  const token = userDetails?.token || userDetails?.data?.token || '';

  const [loadingInit, setLoadingInit] = useState(isEdit);
  const [saving, setSaving]           = useState(false);
  const [loadError, setLoadError]     = useState('');
  const [saveError, setSaveError]     = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [errors, setErrors]           = useState({});

  const [name, setName]         = useState('');
  const [year, setYear]         = useState(String(THIS_YEAR));
  const [isDefault, setIsDefault] = useState(false);
  const [status, setStatus]     = useState('active');
  const [months, setMonths]     = useState(emptyMonths());
  const [yearOpen, setYearOpen] = useState(false);

  const yearOpts = [THIS_YEAR - 1, THIS_YEAR, THIS_YEAR + 1].map((y) => String(y));

  /* prefill for edit */
  useEffect(() => {
    if (!isEdit) return;
    setLoadingInit(true);
    getTargetPhasingById(token, phasingId)
      .then((data) => {
        setName(data.name || '');
        setYear(String(data.year || THIS_YEAR));
        setIsDefault(!!data.isDefault);
        setStatus(data.status || 'active');
        if (Array.isArray(data.months) && data.months.length > 0) {
          const filled = emptyMonths().map((m) => {
            const found = data.months.find((dm) => dm.month === m.month);
            return found ? { ...m, percentage: found.percentage != null ? String(found.percentage) : '' } : m;
          });
          setMonths(filled);
        }
      })
      .catch((e) => setLoadError(e.message || 'Failed to load phasing'))
      .finally(() => setLoadingInit(false));
  }, [isEdit, phasingId, token]);

  const totalPct = months.reduce((s, m) => {
    const v = parseFloat(m.percentage);
    return s + (isNaN(v) ? 0 : v);
  }, 0);

  const updateMonth = (idx, val) => {
    setMonths((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], percentage: val };
      return next;
    });
  };

  const handleEqualDistribution = () => {
    const perMonth = (100 / 12).toFixed(4);
    const rounded  = months.map((m, i) => ({
      ...m,
      percentage: i < 11 ? String(parseFloat((100 / 12).toFixed(2))) : String((100 - parseFloat((100 / 12).toFixed(2)) * 11).toFixed(2)),
    }));
    setMonths(rounded);
  };

  const handleClear = () => {
    setMonths(emptyMonths());
  };

  const validate = () => {
    const errs = {};
    if (!name.trim()) errs.name = 'Name is required';
    if (!year)        errs.year = 'Year is required';

    const hasAny = months.some((m) => m.percentage !== '' && m.percentage !== null);
    if (!hasAny) {
      errs.months = 'At least one month must have a percentage';
    } else if (Math.abs(totalPct - 100) > 0.1) {
      errs.months = `Total percentage must equal 100% (currently ${totalPct.toFixed(2)}%)`;
    }

    const negatives = months.filter((m) => {
      const v = parseFloat(m.percentage);
      return !isNaN(v) && v < 0;
    });
    if (negatives.length > 0) errs.months = 'Percentages cannot be negative';

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    setSaveError('');
    setSaveMessage('');
    try {
      const monthsPayload = months
        .filter((m) => m.percentage !== '' && m.percentage !== null)
        .map((m) => ({ month: m.month, percentage: parseFloat(m.percentage) }));

      const payload = {
        name:      name.trim(),
        year:      Number(year),
        isDefault,
        status,
        months:    monthsPayload,
      };

      if (isEdit) {
        await updateTargetPhasing(token, phasingId, payload);
        setSaveMessage('Phasing plan updated.');
      } else {
        await createTargetPhasing(token, payload);
        setSaveMessage('Phasing plan created.');
      }
      setTimeout(() => navigation.navigate('TargetPhasing'), 900);
    } catch (e) {
      setSaveError(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const pctColor = Math.abs(totalPct - 100) < 0.1 ? colors.success : totalPct > 100 ? colors.danger : '#C2410C';

  return (
    <AppShell navigation={navigation} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} activeRoute="TargetPhasing">
      {/* Breadcrumb */}
      <View style={styles.breadcrumb}>
        <Pressable onPress={() => navigation.navigate('TargetPhasing')}>
          <Text style={styles.breadcrumbLink}>Target Phasing</Text>
        </Pressable>
        <Ionicons name="chevron-forward" size={13} color={colors.textMuted} />
        <Text style={styles.breadcrumbCurrent}>{isEdit ? 'Edit Phasing' : 'Add Phasing Plan'}</Text>
      </View>

      {loadingInit ? (
        <View style={styles.centered}><ActivityIndicator size="small" color={colors.primary} /></View>
      ) : loadError ? (
        <View style={styles.centered}><Text style={styles.errorText}>{loadError}</Text></View>
      ) : (
        <View style={styles.formCard}>
          <Text style={styles.cardTitle}>{isEdit ? 'Edit Phasing Plan' : 'New Phasing Plan'}</Text>
          <Text style={styles.cardSubtitle}>Define monthly percentage distribution. Total must equal 100%.</Text>

          <View style={styles.twoCol}>
            {/* Left: meta */}
            <View style={[styles.col, { zIndex: 5 }]}>
              <Field label="Plan Name" required error={errors.name}>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g. Default 2026 Phasing"
                  placeholderTextColor={colors.textMuted}
                />
              </Field>

              <Field label="Year" required error={errors.year}>
                <View style={{ position: 'relative', zIndex: 20 }}>
                  <Pressable style={styles.input} onPress={() => setYearOpen((v) => !v)}>
                    <Text style={{ flex: 1, fontSize: 13, color: colors.textPrimary }}>{year}</Text>
                    <Ionicons name={yearOpen ? 'chevron-up' : 'chevron-down'} size={13} color={colors.textSecondary} />
                  </Pressable>
                  {yearOpen && (
                    <View style={styles.dropdown}>
                      {yearOpts.map((y) => (
                        <Pressable
                          key={y}
                          style={[styles.dropOpt, y === year && styles.dropOptActive]}
                          onPress={() => { setYear(y); setYearOpen(false); }}
                        >
                          <Text style={[styles.dropOptText, y === year && styles.dropOptTextActive]}>{y}</Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                </View>
              </Field>

              {/* Is Default toggle */}
              <Pressable style={styles.toggleRow} onPress={() => setIsDefault((v) => !v)}>
                <View style={[styles.toggleBox, isDefault && styles.toggleBoxActive]}>
                  {isDefault && <Ionicons name="checkmark" size={14} color={colors.white} />}
                </View>
                <View>
                  <Text style={styles.toggleLabel}>Set as Default Phasing</Text>
                  <Text style={styles.toggleHint}>Default phasing is used when no phasing is explicitly selected.</Text>
                </View>
              </Pressable>

              {/* Status */}
              <Field label="Status">
                <View style={styles.statusButtons}>
                  {['active', 'inactive'].map((s) => (
                    <Pressable
                      key={s}
                      style={[styles.statusBtn, status === s && styles.statusBtnActive]}
                      onPress={() => setStatus(s)}
                    >
                      <Text style={[styles.statusBtnText, status === s && styles.statusBtnTextActive]}>
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </Field>

              {/* Total indicator */}
              <View style={[styles.totalIndicator, { borderColor: pctColor }]}>
                <Ionicons
                  name={Math.abs(totalPct - 100) < 0.1 ? 'checkmark-circle' : 'alert-circle'}
                  size={18}
                  color={pctColor}
                />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.totalPct, { color: pctColor }]}>{totalPct.toFixed(2)}% total</Text>
                  <Text style={styles.totalHint}>Must equal exactly 100%</Text>
                </View>
              </View>

              {/* Quick actions */}
              <View style={styles.quickActions}>
                <Pressable style={styles.quickBtn} onPress={handleEqualDistribution}>
                  <Ionicons name="grid-outline" size={13} color={colors.primary} />
                  <Text style={styles.quickBtnText}>Equal Distribution</Text>
                </Pressable>
                <Pressable style={[styles.quickBtn, styles.quickBtnDanger]} onPress={handleClear}>
                  <Ionicons name="refresh-outline" size={13} color={colors.danger} />
                  <Text style={[styles.quickBtnText, { color: colors.danger }]}>Clear</Text>
                </Pressable>
              </View>
            </View>

            {/* Right: months */}
            <View style={[styles.col, { zIndex: 1 }]}>
              <Text style={styles.monthsTitle}>Monthly Percentages</Text>
              {errors.months ? <Text style={styles.fieldError}>{errors.months}</Text> : null}

              <View style={styles.monthsGrid}>
                {months.map((m, idx) => (
                  <View key={m.month} style={styles.monthCell}>
                    <Text style={styles.monthName}>{MONTH_NAMES[idx].slice(0, 3)}</Text>
                    <View style={styles.monthInputWrap}>
                      <TextInput
                        style={[styles.monthInput, errors.months && m.percentage === '' && styles.monthInputError]}
                        value={m.percentage !== '' && m.percentage !== null ? String(m.percentage) : ''}
                        onChangeText={(v) => updateMonth(idx, v)}
                        placeholder="0"
                        placeholderTextColor={colors.textMuted}
                        keyboardType="decimal-pad"
                        textAlign="center"
                      />
                      <Text style={styles.monthPct}>%</Text>
                    </View>
                  </View>
                ))}
              </View>

              {saveError   ? <Text style={styles.errorText}>{saveError}</Text>   : null}
              {saveMessage ? <Text style={styles.successText}>{saveMessage}</Text> : null}

              <View style={styles.actionRow}>
                <Pressable style={styles.btnCancel} onPress={() => navigation.goBack()}>
                  <Text style={styles.btnCancelText}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.btnPrimary} onPress={handleSave} disabled={saving}>
                  {saving && <ActivityIndicator size={14} color={colors.white} />}
                  <Text style={styles.btnPrimaryText}>
                    {saving ? 'Saving...' : isEdit ? 'Update Phasing' : 'Save Phasing'}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      )}
    </AppShell>
  );
}

const shadow = { shadowColor: '#11224A', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 14, elevation: 3 };

const styles = StyleSheet.create({
  breadcrumb: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: globalHeight('1.2%') },
  breadcrumbLink: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  breadcrumbCurrent: { fontSize: 13, color: colors.textSecondary },
  centered: { alignItems: 'center', padding: 32, gap: 10 },
  errorText: { color: colors.danger, fontSize: 13 },
  successText: { color: colors.success, fontSize: 13, fontWeight: '700' },

  formCard: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 10,
    backgroundColor: colors.surface, padding: 24, ...shadow,
  },
  cardTitle: { fontSize: 17, fontWeight: '800', color: colors.textPrimary, marginBottom: 4 },
  cardSubtitle: { fontSize: 13, color: colors.textSecondary, marginBottom: 24 },

  twoCol: { flexDirection: 'row', gap: 24, alignItems: 'flex-start' },
  col: { flex: 1, gap: 16, minWidth: 0 },

  field: { gap: 6 },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  required: { color: colors.danger },
  fieldError: { fontSize: 12, color: colors.danger },
  fieldHint: { fontSize: 11, color: colors.textMuted },

  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    paddingHorizontal: 12, height: 40, fontSize: 13, color: colors.textPrimary,
    backgroundColor: colors.surface, outlineStyle: 'none',
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  dropdown: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    backgroundColor: colors.surface, marginTop: 2, ...shadow,
    zIndex: 100, position: 'absolute', left: 0, right: 0,
  },
  dropOpt: { paddingHorizontal: 12, paddingVertical: 10 },
  dropOptActive: { backgroundColor: colors.primary + '15' },
  dropOptText: { fontSize: 13, color: colors.textPrimary },
  dropOptTextActive: { color: colors.primary, fontWeight: '700' },

  toggleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 4 },
  toggleBox: {
    width: 20, height: 20, borderRadius: 4, borderWidth: 1.5,
    borderColor: colors.border, alignItems: 'center', justifyContent: 'center', marginTop: 1,
  },
  toggleBoxActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  toggleLabel: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  toggleHint: { fontSize: 11, color: colors.textMuted, marginTop: 2 },

  statusButtons: { flexDirection: 'row', gap: 8 },
  statusBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  statusBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  statusBtnText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  statusBtnTextActive: { color: colors.white },

  totalIndicator: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1.5, borderRadius: 8, padding: 12,
  },
  totalPct: { fontSize: 18, fontWeight: '800' },
  totalHint: { fontSize: 11, color: colors.textMuted },

  quickActions: { flexDirection: 'row', gap: 8 },
  quickBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8,
    borderWidth: 1, borderColor: colors.primary, backgroundColor: colors.surface,
  },
  quickBtnDanger: { borderColor: colors.danger },
  quickBtnText: { fontSize: 13, color: colors.primary, fontWeight: '700' },

  monthsTitle: { fontSize: 14, fontWeight: '800', color: colors.textPrimary, marginBottom: 4 },
  monthsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  monthCell: { width: 80, gap: 4 },
  monthName: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, textAlign: 'center' },
  monthInputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 8, overflow: 'hidden', backgroundColor: colors.surface },
  monthInput: {
    flex: 1, height: 40, fontSize: 14, fontWeight: '700',
    color: colors.textPrimary, outlineStyle: 'none', paddingHorizontal: 6,
  },
  monthInputError: { borderColor: colors.danger },
  monthPct: { fontSize: 12, color: colors.textMuted, paddingRight: 8 },

  actionRow: {
    flexDirection: 'row', justifyContent: 'flex-end', gap: 10,
    paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border, marginTop: 8,
  },
  btnPrimary: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.primary, paddingHorizontal: 18, paddingVertical: 9, borderRadius: 8,
  },
  btnPrimaryText: { color: colors.white, fontSize: 13, fontWeight: '700' },
  btnCancel: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  btnCancelText: { fontSize: 13, color: colors.textSecondary, fontWeight: '700' },
});
