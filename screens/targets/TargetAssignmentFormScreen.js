import React, { useState, useEffect, useCallback } from 'react';
import {
  ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AppShell from '../../components/AppShell';
import { colors } from '../../constants/colors';
import { globalHeight, globalWidth } from '../../constants/globalWidth';
import {
  createTargetAssignment,
  bulkCreateTargetAssignments,
  updateTargetAssignment,
  getTargetAssignmentById,
} from '../../store/targets/targetAssignmentActions';
import { listAllMedicalReps } from '../../store/teams/teamsActions';
import { listProducts } from '../../store/products/productActions';

const THIS_YEAR = new Date().getFullYear();

const TARGET_BASIS_LABELS = {
  cifUsd:       'CIF USD',
  wholesaleAed: 'Wholesale AED',
  retailAed:    'Retail AED',
};

/* ─── Helpers ───────────────────────────────────────────────────────────── */
const getChannelId   = (cp) => typeof cp.channelId === 'string' ? cp.channelId : (cp.channelId?._id || cp.channelId?.channelId || '');
const getChannelName = (cp) => typeof cp.channelId === 'object' && cp.channelId ? (cp.channelId.channelName || cp.channelId.channelKey || getChannelId(cp)) : getChannelId(cp);

const getBasisPrice = (cp) => {
  const basis = cp.targetValueBasis || 'cifUsd';
  return Number(cp[basis]) || 0;
};

const calcValue = (units, cp) => {
  const price = getBasisPrice(cp);
  if (!units || !price || isNaN(Number(units))) return null;
  return Math.round(Number(units) * price * 100) / 100;
};

const fmtNum = (n) => n != null ? Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—';

/* ─── Sub-components ────────────────────────────────────────────────────── */
function Field({ label, required, error, hint, children, style }) {
  return (
    <View style={[styles.field, style]}>
      <Text style={styles.fieldLabel}>
        {label}{required && <Text style={styles.required}> *</Text>}
      </Text>
      {children}
      {hint  ? <Text style={styles.fieldHint}>{hint}</Text>   : null}
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
          <ScrollView style={{ maxHeight: 220 }}>
            <Pressable style={styles.dropOpt} onPress={() => { onChange(''); setOpen(false); setQ(''); }}>
              <Text style={[styles.dropOptText, !value && styles.dropOptTextActive]}>— None —</Text>
            </Pressable>
            {filtered.map((opt) => (
              <Pressable key={opt.value} style={[styles.dropOpt, opt.value === value && styles.dropOptActive]}
                onPress={() => { onChange(opt.value); setOpen(false); setQ(''); }}>
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
            <Pressable key={opt.value} style={[styles.dropOpt, opt.value === value && styles.dropOptActive]}
              onPress={() => { onChange(opt.value); setOpen(false); }}>
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
      <input type="date" value={value} min={min} max={max}
        onChange={(e) => onChange(e.target.value)}
        style={{
          border: `1px solid ${colors.border}`, borderRadius: 8,
          paddingLeft: 12, paddingRight: 12, height: 40, fontSize: 13,
          color: value ? colors.textPrimary : colors.textMuted,
          backgroundColor: colors.surface, outline: 'none', width: '100%', boxSizing: 'border-box',
        }}
      />
    );
  }
  return (
    <TextInput style={styles.input} value={value} onChangeText={onChange}
      placeholder="YYYY-MM-DD" placeholderTextColor={colors.textMuted} />
  );
}

/* ─── Channel target row ─────────────────────────────────────────────────── */
function ChannelRow({ cp, units, onUnitsChange, editMode }) {
  const chName  = getChannelName(cp);
  const price   = getBasisPrice(cp);
  const basis   = cp.targetValueBasis || 'cifUsd';
  const currency = cp.targetCurrency || 'USD';
  const sym     = currency === 'AED' ? 'AED ' : '$';
  const value   = calcValue(units, cp);
  const hasUnits = units !== '' && !isNaN(Number(units)) && Number(units) > 0;

  return (
    <View style={[styles.channelRow, hasUnits && styles.channelRowActive]}>
      {/* Channel name + pricing info */}
      <View style={styles.channelRowLeft}>
        <Text style={styles.channelRowName}>{chName}</Text>
        <View style={styles.channelPriceInfo}>
          <View style={styles.priceTag}>
            <Text style={styles.priceTagLabel}>{TARGET_BASIS_LABELS[basis] || basis}</Text>
            <Text style={styles.priceTagValue}>{sym}{fmtNum(price)}</Text>
          </View>
          <View style={styles.priceTag}>
            <Text style={styles.priceTagLabel}>CIF USD</Text>
            <Text style={styles.priceTagValue}>${fmtNum(cp.cifUsd)}</Text>
          </View>
          {cp.wholesaleAed != null && (
            <View style={styles.priceTag}>
              <Text style={styles.priceTagLabel}>WS AED</Text>
              <Text style={styles.priceTagValue}>{fmtNum(cp.wholesaleAed)}</Text>
            </View>
          )}
          {cp.retailAed != null && (
            <View style={styles.priceTag}>
              <Text style={styles.priceTagLabel}>RP AED</Text>
              <Text style={styles.priceTagValue}>{fmtNum(cp.retailAed)}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Units + auto-value */}
      <View style={styles.channelRowRight}>
        <View style={styles.channelUnitsWrap}>
          <Text style={styles.channelUnitsLabel}>Target Units</Text>
          <TextInput
            style={[styles.channelUnitsInput, editMode && styles.channelUnitsInputEdit]}
            value={units}
            onChangeText={onUnitsChange}
            placeholder="0"
            placeholderTextColor={colors.textMuted}
            keyboardType="numeric"
            editable={!editMode || true}
          />
        </View>
        <View style={styles.channelValueWrap}>
          <Text style={styles.channelUnitsLabel}>Target Value ({currency})</Text>
          <View style={styles.channelValueDisplay}>
            <Text style={[styles.channelValueText, hasUnits && value != null && { color: colors.success }]}>
              {hasUnits && value != null ? `${sym}${fmtNum(value)}` : '—'}
            </Text>
            {hasUnits && price > 0 && (
              <Text style={styles.channelValueFormula}>
                {Number(units).toLocaleString()} × {sym}{fmtNum(price)}
              </Text>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

/* ─── Main screen ───────────────────────────────────────────────────────── */
export default function TargetAssignmentFormScreen({ navigation, route, userDetails, appMetadata, onSignOut }) {
  const mode         = route?.params?.mode || 'create';
  const assignmentId = route?.params?.assignmentId;
  const isEdit       = mode === 'edit' && !!assignmentId;
  const isDuplicate  = mode === 'duplicate' && !!assignmentId;

  const token = userDetails?.token || userDetails?.data?.token || '';

  const [loadingInit, setLoadingInit] = useState(isEdit || isDuplicate);
  const [saving, setSaving]           = useState(false);
  const [loadError, setLoadError]     = useState('');
  const [saveError, setSaveError]     = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [errors, setErrors]           = useState({});

  const [reps, setReps]         = useState([]);
  const [products, setProducts] = useState([]);

  /* form state */
  const [repId, setRepId]           = useState('');     // selected rep value key
  const [selectedRep, setSelectedRep] = useState(null); // full rep object
  const [productId, setProductId]   = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [year, setYear]             = useState(String(THIS_YEAR));
  const [startDate, setStartDate]   = useState('');
  const [endDate, setEndDate]       = useState('');
  const [notes, setNotes]           = useState('');
  const [status, setStatus]         = useState('active');

  /* channel targets: { [channelId]: unitsString } */
  const [channelUnits, setChannelUnits] = useState({});

  /* for edit mode: which specific channelId is being edited */
  const [editChannelId, setEditChannelId] = useState('');

  /* load reps + products */
  useEffect(() => {
    listAllMedicalReps(token)
      .then((data) => setReps(Array.isArray(data) ? data : []))
      .catch(() => {});
    listProducts(token, { limit: 300, status: 'active' })
      .then(({ products: p }) => setProducts(p))
      .catch(() => {});
  }, [token]);

  /* sync selectedRep when repId or reps changes */
  useEffect(() => {
    if (!repId) { setSelectedRep(null); return; }
    const rep = reps.find((r) =>
      (r.userId || r.medicalRepId || r._id || r.id) === repId
    );
    setSelectedRep(rep || null);
  }, [repId, reps]);

  /* sync selectedProduct and reset channel units when productId changes */
  useEffect(() => {
    if (!productId) { setSelectedProduct(null); setChannelUnits({}); return; }
    const prod = products.find((p) => (p._id || p.productId) === productId);
    setSelectedProduct(prod || null);
    if (!isEdit) setChannelUnits({});
  }, [productId, products]);

  /* prefill for edit / duplicate */
  useEffect(() => {
    if (!isEdit && !isDuplicate) return;
    setLoadingInit(true);
    getTargetAssignmentById(token, assignmentId)
      .then((data) => {
        const prod = data.productId || {};
        const chan = data.channelId || {};
        const pid = prod._id || prod.productId || (typeof data.productId === 'string' ? data.productId : '');
        const cid = chan._id || chan.channelId || (typeof data.channelId === 'string' ? data.channelId : '');

        /* medical rep */
        const repObj = data.medicalRep || data.userId || {};
        const rid = data.medicalRepId || repObj._id || repObj.id || '';
        setRepId(rid);

        setProductId(pid);
        setYear(String(data.year || THIS_YEAR));
        setStartDate(data.startDate?.slice(0, 10) || '');
        setEndDate(data.endDate?.slice(0, 10) || '');
        setNotes(data.notes || '');
        setStatus(isDuplicate ? 'active' : (data.status || 'active'));

        if (cid && data.totalTargetUnits != null) {
          setChannelUnits({ [cid]: String(data.totalTargetUnits) });
        }
        if (isEdit) setEditChannelId(cid);
      })
      .catch((e) => setLoadError(e.message || 'Failed to load'))
      .finally(() => setLoadingInit(false));
  }, [isEdit, isDuplicate, assignmentId, token]);

  /* channel pricing rows to show */
  const channelPricingList = selectedProduct && Array.isArray(selectedProduct.channelPricing)
    ? selectedProduct.channelPricing.filter((cp) => getChannelId(cp))
    : [];

  /* in edit mode, show only the channel being edited */
  const visibleChannels = isEdit && editChannelId
    ? channelPricingList.filter((cp) => getChannelId(cp) === editChannelId)
    : channelPricingList;

  /* totals across all channels with units */
  const totals = channelPricingList.reduce(
    (acc, cp) => {
      const cid   = getChannelId(cp);
      const units = channelUnits[cid];
      if (!units || isNaN(Number(units)) || Number(units) <= 0) return acc;
      const val = calcValue(units, cp);
      return {
        units: acc.units + Number(units),
        value: acc.value + (val || 0),
        count: acc.count + 1,
      };
    },
    { units: 0, value: 0, count: 0 }
  );

  const validate = () => {
    const errs = {};
    if (!repId)         errs.repId      = 'Medical rep is required';
    if (!productId)     errs.productId  = 'Product is required';
    if (!year)          errs.year       = 'Year is required';
    if (!startDate)     errs.startDate  = 'Start date is required';
    if (!endDate)       errs.endDate    = 'End date is required';
    if (startDate && endDate && endDate <= startDate) errs.endDate = 'End date must be after start date';
    if (totals.count === 0) errs.channels = 'Enter target units for at least one channel';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const buildRepPayload = () => {
    if (!selectedRep) return {};
    return {
      medicalRepId:   selectedRep.medicalRepId || selectedRep._id || selectedRep.id || repId,
      medicalRepName: selectedRep.fullName || selectedRep.name || '',
      medicalRep: {
        _id:      selectedRep._id || selectedRep.id || selectedRep.medicalRepId || repId,
        fullName: selectedRep.fullName || selectedRep.name || '',
        appId:    selectedRep.appId || selectedRep.userId || '',
        role:     'representative',
      },
    };
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    setSaveError('');
    setSaveMessage('');

    try {
      const repPayload = buildRepPayload();
      const basePart = {
        ...repPayload,
        productId,
        year:      Number(year),
        startDate,
        endDate,
        notes:     notes.trim() || undefined,
        status,
      };

      if (isEdit) {
        /* editing one specific assignment — update units + value for that channel */
        const cp  = channelPricingList.find((c) => getChannelId(c) === editChannelId);
        const units = channelUnits[editChannelId] || '0';
        const val   = cp ? calcValue(units, cp) : undefined;
        await updateTargetAssignment(token, assignmentId, {
          ...basePart,
          channelId:        editChannelId,
          totalTargetUnits: Number(units),
          totalTargetValue: val ?? undefined,
        });
        setSaveMessage('Target assignment updated.');
      } else {
        /* create one assignment per channel that has units */
        const targets = channelPricingList
          .filter((cp) => {
            const cid = getChannelId(cp);
            const u = channelUnits[cid];
            return u && !isNaN(Number(u)) && Number(u) > 0;
          })
          .map((cp) => {
            const cid  = getChannelId(cp);
            const units = channelUnits[cid];
            const val   = calcValue(units, cp);
            return {
              ...basePart,
              channelId:        cid,
              totalTargetUnits: Number(units),
              totalTargetValue: val ?? undefined,
            };
          });

        if (targets.length === 1) {
          await createTargetAssignment(token, targets[0]);
        } else {
          await bulkCreateTargetAssignments(token, { targets });
        }
        setSaveMessage(isDuplicate ? 'Assignment duplicated.' : `${targets.length} target assignment(s) created.`);
      }
      setTimeout(() => navigation.navigate('TargetAssignments'), 1000);
    } catch (e) {
      setSaveError(e.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const repOptions  = reps.map((r) => ({
    value: r.userId || r.medicalRepId || r._id || r.id || '',
    label: `${r.fullName || r.name || r.email || 'Unknown'}${r._teamName ? ` · ${r._teamName}` : ''}`,
  }));
  const prodOptions = products.map((p) => ({
    value: p._id || p.productId || '',
    label: `${p.productName || p.name || ''}${p.productNickname ? ` · ${p.productNickname}` : ''}`,
  }));
  const yearOptions = [THIS_YEAR - 1, THIS_YEAR, THIS_YEAR + 1].map((y) => ({ value: String(y), label: String(y) }));
  const statusOpts  = [{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }];

  const titleMap = { create: 'Add Target Assignment', edit: 'Edit Target Assignment', duplicate: 'Duplicate Assignment' };

  return (
    <AppShell navigation={navigation} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} activeRoute="TargetAssignments">
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
            {isEdit ? 'Update this target assignment.' : 'Set targets per sales channel. Values are auto-calculated from channel pricing.'}
          </Text>

          <View style={styles.twoCol}>
            {/* ── Left: meta fields ── */}
            <View style={[styles.col, { zIndex: 10 }]}>

              <Field label="Medical Rep" required error={errors.repId} style={{ zIndex: 55 }}>
                <SearchableDropdown
                  label="Medical Rep"
                  options={repOptions}
                  value={repId}
                  onChange={setRepId}
                  placeholder="Select a medical rep"
                />
              </Field>

              {/* Rep info pill */}
              {selectedRep && (
                <View style={styles.repInfoPill}>
                  <Ionicons name="person-circle-outline" size={16} color={colors.primary} />
                  <View>
                    <Text style={styles.repInfoName}>{selectedRep.fullName || selectedRep.name}</Text>
                    {selectedRep._teamName
                      ? <Text style={styles.repInfoTeam}>{selectedRep._teamName}</Text>
                      : null}
                  </View>
                </View>
              )}

              <Field label="Product" required error={errors.productId} style={{ zIndex: 50 }}>
                <SearchableDropdown
                  label="Product"
                  options={prodOptions}
                  value={productId}
                  onChange={setProductId}
                  placeholder="Select a product"
                />
              </Field>

              <Field label="Year" required error={errors.year} style={{ zIndex: 30 }}>
                <SimpleDropdown options={yearOptions} value={year} onChange={setYear} />
              </Field>

              <Field label="Start Date" required error={errors.startDate}>
                <DateInput value={startDate} onChange={setStartDate} />
              </Field>

              <Field label="End Date" required error={errors.endDate}>
                <DateInput value={endDate} onChange={setEndDate} min={startDate} />
              </Field>

              <Field label="Status" style={{ zIndex: 20 }}>
                <SimpleDropdown options={statusOpts} value={status} onChange={setStatus} />
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
            </View>

            {/* ── Right: channel targets ── */}
            <View style={[styles.col, { zIndex: 1, gap: 12 }]}>
              <View style={styles.channelsHeader}>
                <Text style={styles.channelsTitle}>
                  {isEdit ? 'Edit Channel Target' : 'Channel Targets'}
                </Text>
                {!productId && (
                  <Text style={styles.channelsHint}>Select a product to see its available sales channels</Text>
                )}
                {productId && visibleChannels.length === 0 && (
                  <Text style={styles.channelsHint}>No channel pricing found for this product</Text>
                )}
              </View>

              {errors.channels ? <Text style={styles.fieldError}>{errors.channels}</Text> : null}

              {visibleChannels.map((cp) => {
                const cid = getChannelId(cp);
                return (
                  <ChannelRow
                    key={cid}
                    cp={cp}
                    units={channelUnits[cid] ?? ''}
                    onUnitsChange={(v) => setChannelUnits((prev) => ({ ...prev, [cid]: v }))}
                    editMode={isEdit}
                  />
                );
              })}

              {/* Totals summary */}
              {totals.count > 0 && (
                <View style={styles.totalsCard}>
                  <Text style={styles.totalsTitle}>
                    Total across {totals.count} channel{totals.count > 1 ? 's' : ''}
                  </Text>
                  <View style={styles.totalsRow}>
                    <View style={styles.totalsItem}>
                      <Text style={styles.totalsLabel}>Total Units</Text>
                      <Text style={styles.totalsValue}>{totals.units.toLocaleString()}</Text>
                    </View>
                    <View style={styles.totalsItem}>
                      <Text style={styles.totalsLabel}>Total Value</Text>
                      <Text style={styles.totalsValue}>{totals.value.toLocaleString('en-US', { maximumFractionDigits: 0 })}</Text>
                    </View>
                  </View>
                </View>
              )}

              {saveError   ? <Text style={styles.errorText}>{saveError}</Text>   : null}
              {saveMessage ? <Text style={styles.successText}>{saveMessage}</Text> : null}

              <View style={styles.actionRow}>
                <Pressable style={styles.btnCancel} onPress={() => navigation.goBack()}>
                  <Text style={styles.btnCancelText}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.btnPrimary} onPress={handleSave} disabled={saving}>
                  {saving && <ActivityIndicator size={14} color={colors.white} />}
                  <Text style={styles.btnPrimaryText}>
                    {saving ? 'Saving...'
                      : isEdit ? 'Update Assignment'
                      : isDuplicate ? 'Create Duplicate'
                      : totals.count > 1 ? `Save ${totals.count} Assignments` : 'Save Assignment'}
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

  repInfoPill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.primary + '0D', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: colors.primary + '30',
  },
  repInfoName: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  repInfoTeam: { fontSize: 11, color: colors.textMuted, marginTop: 1 },

  channelsHeader: { gap: 4 },
  channelsTitle: { fontSize: 15, fontWeight: '800', color: colors.textPrimary },
  channelsHint: { fontSize: 12, color: colors.textMuted },

  /* Channel row */
  channelRow: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 10,
    backgroundColor: colors.surface, padding: 14,
    flexDirection: 'row', gap: 16, alignItems: 'flex-start',
  },
  channelRowActive: { borderColor: colors.primary, backgroundColor: colors.primary + '05' },
  channelRowLeft: { flex: 2, gap: 8 },
  channelRowRight: { flex: 2, gap: 10 },

  channelRowName: { fontSize: 14, fontWeight: '800', color: colors.textPrimary },
  channelPriceInfo: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  priceTag: {
    backgroundColor: colors.backgroundColor, borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 4, gap: 1,
  },
  priceTagLabel: { fontSize: 10, color: colors.textMuted, fontWeight: '700' },
  priceTagValue: { fontSize: 12, color: colors.textPrimary, fontWeight: '800' },

  channelUnitsWrap: { gap: 4 },
  channelUnitsLabel: { fontSize: 11, color: colors.textSecondary, fontWeight: '700' },
  channelUnitsInput: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    paddingHorizontal: 12, height: 40, fontSize: 15, fontWeight: '700',
    color: colors.textPrimary, backgroundColor: colors.surface, outlineStyle: 'none',
  },
  channelUnitsInputEdit: { borderColor: colors.primary },
  channelValueWrap: { gap: 4 },
  channelValueDisplay: {
    backgroundColor: colors.backgroundColor, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 8, gap: 2,
  },
  channelValueText: { fontSize: 15, fontWeight: '800', color: colors.textMuted },
  channelValueFormula: { fontSize: 10, color: colors.textMuted },

  /* Totals */
  totalsCard: {
    backgroundColor: colors.primary + '08', borderWidth: 1, borderColor: colors.primary + '30',
    borderRadius: 10, padding: 14, gap: 10,
  },
  totalsTitle: { fontSize: 12, fontWeight: '800', color: colors.primary },
  totalsRow: { flexDirection: 'row', gap: 16 },
  totalsItem: { flex: 1, gap: 2 },
  totalsLabel: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },
  totalsValue: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },

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
