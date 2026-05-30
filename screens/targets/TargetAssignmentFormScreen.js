import React, { useState, useEffect } from 'react';
import {
  ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AppShell from '../../components/AppShell';
import { colors } from '../../constants/colors';
import { globalHeight, globalWidth } from '../../constants/globalWidth';
import {
  createTargetAssignment,
  updateTargetAssignment,
  getTargetAssignmentById,
} from '../../store/targets/targetAssignmentActions';
import { listSalesTeamMembers } from '../../store/salesTeam/salesTeamActions';
import { listProducts } from '../../store/products/productActions';

const THIS_YEAR = new Date().getFullYear();

const TARGET_BASIS_LABELS = {
  cifUsd:       'CIF USD',
  wholesaleAed: 'Wholesale AED',
  retailAed:    'Retail AED',
};

function Field({ label, required, error, hint, children, style }) {
  return (
    <View style={[styles.field, style]}>
      <Text style={styles.fieldLabel}>
        {label}{required && <Text style={styles.required}> *</Text>}
      </Text>
      {children}
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

function SearchableDropdown({ label, options, value, onChange, placeholder }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const selected = options.find((o) => o.value === value);
  const filtered = q.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase()))
    : options;

  return (
    <View style={{ position: 'relative', zIndex: open ? 50 : 1 }}>
      <Pressable style={styles.input} onPress={() => { setOpen((v) => !v); setQ(''); }}>
        <Text style={[{ flex: 1, fontSize: 13 }, selected ? { color: colors.textPrimary } : { color: colors.textMuted }]} numberOfLines={1}>
          {selected?.label || placeholder || `Select ${label}`}
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={13} color={colors.textSecondary} />
      </Pressable>
      {open && (
        <View style={styles.dropdown}>
          <TextInput
            style={styles.dropSearch}
            value={q}
            onChangeText={setQ}
            placeholder="Search..."
            placeholderTextColor={colors.textMuted}
            autoFocus
          />
          <ScrollView style={{ maxHeight: 200 }}>
            <Pressable style={styles.dropOpt} onPress={() => { onChange(''); setOpen(false); setQ(''); }}>
              <Text style={[styles.dropOptText, !value && styles.dropOptTextActive]}>— None —</Text>
            </Pressable>
            {filtered.map((opt) => (
              <Pressable
                key={opt.value}
                style={[styles.dropOpt, opt.value === value && styles.dropOptActive]}
                onPress={() => { onChange(opt.value); setOpen(false); setQ(''); }}
              >
                <Text style={[styles.dropOptText, opt.value === value && styles.dropOptTextActive]} numberOfLines={1}>
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

function SimpleDropdown({ options, value, onChange }) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  return (
    <View style={{ position: 'relative', zIndex: open ? 40 : 1 }}>
      <Pressable style={styles.input} onPress={() => setOpen((v) => !v)}>
        <Text style={[{ flex: 1, fontSize: 13 }, selected ? { color: colors.textPrimary } : { color: colors.textMuted }]}>
          {selected?.label || 'Select'}
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={13} color={colors.textSecondary} />
      </Pressable>
      {open && (
        <View style={styles.dropdown}>
          {options.map((opt) => (
            <Pressable
              key={opt.value}
              style={[styles.dropOpt, opt.value === value && styles.dropOptActive]}
              onPress={() => { onChange(opt.value); setOpen(false); }}
            >
              <Text style={[styles.dropOptText, opt.value === value && styles.dropOptTextActive]}>{opt.label}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

function DateInput({ value, onChange, min, max }) {
  if (Platform.OS === 'web') {
    return (
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        min={min}
        max={max}
        style={{
          borderWidth: 1, borderColor: colors.border, borderRadius: 8, borderStyle: 'solid',
          paddingLeft: 12, paddingRight: 12, height: 40, fontSize: 13,
          color: value ? colors.textPrimary : colors.textMuted,
          backgroundColor: colors.surface, outline: 'none', width: '100%', boxSizing: 'border-box',
        }}
      />
    );
  }
  return (
    <TextInput
      style={styles.input}
      value={value}
      onChangeText={onChange}
      placeholder="YYYY-MM-DD"
      placeholderTextColor={colors.textMuted}
    />
  );
}

function InfoRow({ label, value }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value || '—'}</Text>
    </View>
  );
}

export default function TargetAssignmentFormScreen({ navigation, route, userDetails, appMetadata, onSignOut }) {
  const mode         = route?.params?.mode || 'create';
  const assignmentId = route?.params?.assignmentId;
  const isEdit       = mode === 'edit' && !!assignmentId;
  const isDuplicate  = mode === 'duplicate' && !!assignmentId;

  const token = userDetails?.token || userDetails?.data?.token || '';

  const [loadingInit, setLoadingInit] = useState(isEdit || isDuplicate);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [errors, setErrors] = useState({});

  const [reps, setReps] = useState([]);
  const [products, setProducts] = useState([]);

  /* form state */
  const [repId, setRepId] = useState('');
  const [productId, setProductId] = useState('');
  const [channelId, setChannelId] = useState('');
  const [year, setYear] = useState(String(THIS_YEAR));
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [totalTargetUnits, setTotalTargetUnits] = useState('');
  const [totalTargetValue, setTotalTargetValue] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('active');

  /* derived from selected product channel */
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [channelPricingInfo, setChannelPricingInfo] = useState(null);

  /* load reps + products */
  useEffect(() => {
    listSalesTeamMembers(token, { limit: 300 }).then(({ data }) => setReps(data)).catch(() => {});
    listProducts(token, { limit: 300, status: 'active' }).then(({ products: p }) => setProducts(p)).catch(() => {});
  }, [token]);

  /* when productId changes, find the product object */
  useEffect(() => {
    if (!productId) { setSelectedProduct(null); setChannelId(''); setChannelPricingInfo(null); return; }
    const prod = products.find((p) => (p._id || p.productId) === productId);
    setSelectedProduct(prod || null);
    setChannelId('');
    setChannelPricingInfo(null);
  }, [productId, products]);

  /* when channelId changes, find channel pricing info */
  useEffect(() => {
    if (!channelId || !selectedProduct) { setChannelPricingInfo(null); return; }
    const cp = Array.isArray(selectedProduct.channelPricing)
      ? selectedProduct.channelPricing.find((c) => (c.channelId === channelId || c.channelId?._id === channelId))
      : null;
    setChannelPricingInfo(cp || null);
  }, [channelId, selectedProduct]);

  /* prefill for edit/duplicate */
  useEffect(() => {
    if (!isEdit && !isDuplicate) return;
    setLoadingInit(true);
    getTargetAssignmentById(token, assignmentId)
      .then((data) => {
        const prod = data.productId || {};
        const chan = data.channelId || {};
        setRepId(data.userId?._id || data.userId?.id || data.userId || '');
        setProductId(prod._id || prod.productId || data.productId || '');
        setChannelId(chan._id || chan.channelId || data.channelId || '');
        setYear(String(data.year || THIS_YEAR));
        setStartDate(data.startDate?.slice(0, 10) || '');
        setEndDate(data.endDate?.slice(0, 10) || '');
        setTotalTargetUnits(data.totalTargetUnits != null ? String(data.totalTargetUnits) : '');
        setTotalTargetValue(data.totalTargetValue != null ? String(data.totalTargetValue) : '');
        setNotes(data.notes || '');
        setStatus(isDuplicate ? 'active' : (data.status || 'active'));
      })
      .catch((e) => setLoadError(e.message || 'Failed to load assignment'))
      .finally(() => setLoadingInit(false));
  }, [isEdit, isDuplicate, assignmentId, token]);

  const validate = () => {
    const errs = {};
    if (!repId)      errs.repId      = 'Medical rep is required';
    if (!productId)  errs.productId  = 'Product is required';
    if (!channelId)  errs.channelId  = 'Sales channel is required';
    if (!year)       errs.year       = 'Year is required';
    if (!startDate)  errs.startDate  = 'Start date is required';
    if (!endDate)    errs.endDate    = 'End date is required';
    if (startDate && endDate && endDate <= startDate) errs.endDate = 'End date must be after start date';
    if (!totalTargetUnits && !totalTargetValue) errs.totalTargetUnits = 'Provide at least target units or value';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    setSaveError('');
    setSaveMessage('');
    try {
      const payload = {
        userId:            repId,
        productId,
        channelId,
        year:              Number(year),
        startDate,
        endDate,
        totalTargetUnits:  totalTargetUnits ? Number(totalTargetUnits) : undefined,
        totalTargetValue:  totalTargetValue ? Number(totalTargetValue) : undefined,
        notes:             notes.trim() || undefined,
        status,
      };
      if (isEdit) {
        await updateTargetAssignment(token, assignmentId, payload);
        setSaveMessage('Target assignment updated.');
      } else {
        await createTargetAssignment(token, payload);
        setSaveMessage(isDuplicate ? 'Assignment duplicated.' : 'Target assignment created.');
      }
      setTimeout(() => navigation.navigate('TargetAssignments'), 900);
    } catch (e) {
      setSaveError(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  /* build channel options from selected product */
  const channelOptions = selectedProduct && Array.isArray(selectedProduct.channelPricing)
    ? selectedProduct.channelPricing.map((cp) => {
        const ch = cp.channelId || {};
        const chId = typeof cp.channelId === 'string' ? cp.channelId : (ch._id || ch.channelId || '');
        const chName = ch.channelName || ch.channelKey || chId;
        return { value: chId, label: chName };
      }).filter((o) => o.value)
    : [];

  const repOptions     = reps.map((r) => ({ value: r.userId || r._id, label: r.fullName || r.name || r.email }));
  const productOptions = products.map((p) => ({ value: p._id || p.productId, label: `${p.productName || p.name}${p.productNickname ? ` · ${p.productNickname}` : ''}` }));
  const yearOptions    = [THIS_YEAR - 1, THIS_YEAR, THIS_YEAR + 1].map((y) => ({ value: String(y), label: String(y) }));
  const statusOptions  = [
    { value: 'active', label: 'Active' },
    { value: 'inactive', label: 'Inactive' },
  ];

  const titleMap = { create: 'Add Target Assignment', edit: 'Edit Target Assignment', duplicate: 'Duplicate Assignment' };

  return (
    <AppShell navigation={navigation} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} activeRoute="TargetAssignments">
      {/* Breadcrumb */}
      <View style={styles.breadcrumb}>
        <Pressable onPress={() => navigation.navigate('TargetAssignments')}>
          <Text style={styles.breadcrumbLink}>Target Assignments</Text>
        </Pressable>
        <Ionicons name="chevron-forward" size={13} color={colors.textMuted} />
        <Text style={styles.breadcrumbCurrent}>{titleMap[mode] || 'Assignment'}</Text>
      </View>

      {loadingInit ? (
        <View style={styles.centered}><ActivityIndicator size="small" color={colors.primary} /></View>
      ) : loadError ? (
        <View style={styles.centered}><Text style={styles.errorText}>{loadError}</Text></View>
      ) : (
        <View style={styles.formCard}>
          <Text style={styles.cardTitle}>{titleMap[mode]}</Text>
          <Text style={styles.cardSubtitle}>
            {isDuplicate ? 'Creating a copy of the selected assignment.' : isEdit ? 'Update assignment details.' : 'Assign a target to a medical rep for a product and channel.'}
          </Text>

          <View style={styles.twoCol}>
            {/* Left column */}
            <View style={[styles.col, { zIndex: 10 }]}>
              <Field label="Medical Rep" required error={errors.repId} style={{ zIndex: 50 }}>
                <SearchableDropdown
                  label="Medical Rep"
                  options={repOptions}
                  value={repId}
                  onChange={setRepId}
                  placeholder="Select a rep"
                />
              </Field>

              <Field label="Product" required error={errors.productId} style={{ zIndex: 45 }}>
                <SearchableDropdown
                  label="Product"
                  options={productOptions}
                  value={productId}
                  onChange={setProductId}
                  placeholder="Select a product"
                />
              </Field>

              <Field label="Sales Channel" required error={errors.channelId} style={{ zIndex: 40 }}>
                {!productId ? (
                  <View style={styles.inputDisabled}>
                    <Text style={{ fontSize: 13, color: colors.textMuted }}>Select a product first</Text>
                  </View>
                ) : channelOptions.length === 0 ? (
                  <View style={styles.inputDisabled}>
                    <Text style={{ fontSize: 13, color: colors.textMuted }}>No channels in this product</Text>
                  </View>
                ) : (
                  <SimpleDropdown options={channelOptions} value={channelId} onChange={setChannelId} />
                )}
              </Field>

              {/* Channel pricing info (read-only) */}
              {channelPricingInfo && (
                <View style={styles.infoBox}>
                  <Text style={styles.infoBoxTitle}>Channel Pricing Info</Text>
                  <InfoRow label="Target Value Basis" value={TARGET_BASIS_LABELS[channelPricingInfo.targetValueBasis] || channelPricingInfo.targetValueBasis || '—'} />
                  <InfoRow label="Target Currency"    value={channelPricingInfo.targetCurrency || '—'} />
                  {channelPricingInfo.cifUsd     != null && <InfoRow label="CIF USD"       value={`$${Number(channelPricingInfo.cifUsd).toFixed(2)}`} />}
                  {channelPricingInfo.wholesaleAed != null && <InfoRow label="Wholesale AED" value={Number(channelPricingInfo.wholesaleAed).toFixed(2)} />}
                  {channelPricingInfo.retailAed   != null && <InfoRow label="Retail AED"    value={Number(channelPricingInfo.retailAed).toFixed(2)} />}
                </View>
              )}

              <Field label="Status" style={{ zIndex: 30 }}>
                <SimpleDropdown options={statusOptions} value={status} onChange={setStatus} />
              </Field>
            </View>

            {/* Right column */}
            <View style={[styles.col, { zIndex: 5 }]}>
              <Field label="Year" required error={errors.year} style={{ zIndex: 20 }}>
                <SimpleDropdown options={yearOptions} value={year} onChange={setYear} />
              </Field>

              <Field label="Start Date" required error={errors.startDate}>
                <DateInput value={startDate} onChange={setStartDate} />
              </Field>

              <Field label="End Date" required error={errors.endDate}>
                <DateInput value={endDate} onChange={setEndDate} min={startDate} />
              </Field>

              <Field label="Total Target Units" error={errors.totalTargetUnits} hint="Number of units target for the period">
                <TextInput
                  style={styles.input}
                  value={totalTargetUnits}
                  onChangeText={setTotalTargetUnits}
                  placeholder="e.g. 5000"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                />
              </Field>

              <Field label="Total Target Value" hint={`Monetary value${channelPricingInfo?.targetCurrency ? ` in ${channelPricingInfo.targetCurrency}` : ''}`}>
                <TextInput
                  style={styles.input}
                  value={totalTargetValue}
                  onChangeText={setTotalTargetValue}
                  placeholder="e.g. 50000"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                />
              </Field>

              <Field label="Notes">
                <TextInput
                  style={[styles.input, styles.inputMulti]}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Optional notes..."
                  placeholderTextColor={colors.textMuted}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </Field>

              {saveError   ? <Text style={styles.errorText}>{saveError}</Text>   : null}
              {saveMessage ? <Text style={styles.successText}>{saveMessage}</Text> : null}

              <View style={styles.actionRow}>
                <Pressable style={styles.btnCancel} onPress={() => navigation.goBack()}>
                  <Text style={styles.btnCancelText}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.btnPrimary} onPress={handleSave} disabled={saving}>
                  {saving && <ActivityIndicator size={14} color={colors.white} />}
                  <Text style={styles.btnPrimaryText}>
                    {saving ? 'Saving...' : isEdit ? 'Update Assignment' : isDuplicate ? 'Create Duplicate' : 'Save Assignment'}
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

const shadow = { shadowColor: '#0B2B66', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } };

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
  inputDisabled: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    paddingHorizontal: 12, height: 40, justifyContent: 'center',
    backgroundColor: colors.backgroundColor,
  },
  inputMulti: { height: 80, paddingTop: 10 },

  dropdown: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    backgroundColor: colors.surface, marginTop: 2, ...shadow,
    zIndex: 100, position: 'absolute', left: 0, right: 0,
  },
  dropSearch: {
    borderBottomWidth: 1, borderBottomColor: colors.border,
    paddingHorizontal: 12, paddingVertical: 8, fontSize: 13,
    color: colors.textPrimary, outlineStyle: 'none',
  },
  dropOpt: { paddingHorizontal: 12, paddingVertical: 10 },
  dropOptActive: { backgroundColor: colors.primary + '15' },
  dropOptText: { fontSize: 13, color: colors.textPrimary },
  dropOptTextActive: { color: colors.primary, fontWeight: '700' },

  infoBox: {
    backgroundColor: colors.backgroundColor, borderRadius: 8,
    padding: 14, gap: 8, borderWidth: 1, borderColor: colors.border,
  },
  infoBoxTitle: { fontSize: 12, fontWeight: '800', color: colors.textSecondary, marginBottom: 2 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  infoLabel: { fontSize: 12, color: colors.textSecondary },
  infoValue: { fontSize: 12, fontWeight: '700', color: colors.textPrimary },

  actionRow: {
    flexDirection: 'row', justifyContent: 'flex-end', gap: 10,
    paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border,
  },
  btnPrimary: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.primary, paddingHorizontal: 18, paddingVertical: 9, borderRadius: 8,
  },
  btnPrimaryText: { color: colors.white, fontSize: 13, fontWeight: '700' },
  btnCancel: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  btnCancelText: { fontSize: 13, color: colors.textSecondary, fontWeight: '700' },
});
