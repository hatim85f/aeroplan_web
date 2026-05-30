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
  getTargetAssignmentById,
  updateTargetAssignment,
} from '../../store/targets/targetAssignmentActions';
import { listProducts } from '../../store/products/productActions';
import { listSalesChannels } from '../../store/salesChannels/salesChannelActions';

const THIS_YEAR = new Date().getFullYear();

const TARGET_BASIS_LABELS = {
  cifUsd:       'CIF USD',
  wholesaleAed: 'Wholesale AED',
  retailAed:    'Retail AED',
};

/* ─── Helpers ───────────────────────────────────────────────────────────── */
const getChannelId   = (cp) =>
  typeof cp.channelId === 'string'
    ? cp.channelId
    : (cp.channelId?._id || cp.channelId?.channelId || '');

const getChannelName = (cp) =>
  typeof cp.channelId === 'object' && cp.channelId
    ? (cp.channelId.channelName || cp.channelId.channelKey || getChannelId(cp))
    : getChannelId(cp);

const getBasisPrice = (cp) => Number(cp[cp.targetValueBasis || 'cifUsd']) || 0;

const calcValue = (units, cp) => {
  const price = getBasisPrice(cp);
  if (!units || !price || isNaN(Number(units))) return null;
  return Math.round(Number(units) * price * 100) / 100;
};

const fmtMoney = (n, currency = 'USD') => {
  if (n == null) return '—';
  const sym = currency === 'AED' ? 'AED ' : '$';
  return `${sym}${Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
};

/* ─── Product dropdown ──────────────────────────────────────────────────── */
function ProductDropdown({ options, value, onChange }) {
  const [open, setOpen] = useState(false);
  const [q, setQ]       = useState('');
  const selected  = options.find((o) => o.value === value);
  const filtered  = q.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase()))
    : options;

  return (
    <View style={{ position: 'relative', zIndex: open ? 1000 : 1 }}>
      <Pressable style={styles.input} onPress={() => { setOpen((v) => !v); setQ(''); }}>
        <Text
          style={[{ flex: 1, fontSize: 13 }, selected ? { color: colors.textPrimary } : { color: colors.textMuted }]}
          numberOfLines={1}
        >
          {selected?.label || 'Select a product'}
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={13} color={colors.textSecondary} />
      </Pressable>
      {open && (
        <View style={styles.dropdown}>
          <TextInput
            style={styles.dropSearch}
            value={q}
            onChangeText={setQ}
            placeholder="Search products..."
            placeholderTextColor={colors.textMuted}
            autoFocus
          />
          <ScrollView style={{ maxHeight: 240 }} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
            {filtered.map((opt) => (
              <Pressable
                key={opt.value}
                style={[styles.dropOpt, opt.value === value && styles.dropOptActive]}
                onPress={() => { onChange(opt.value); setOpen(false); setQ(''); }}
              >
                <Text
                  style={[styles.dropOptText, opt.value === value && styles.dropOptTextActive]}
                  numberOfLines={1}
                >
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

/* ─── Year dropdown ─────────────────────────────────────────────────────── */
function YearDropdown({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const opts = [THIS_YEAR - 1, THIS_YEAR, THIS_YEAR + 1].map((y) => String(y));
  return (
    <View style={{ position: 'relative', zIndex: open ? 900 : 1 }}>
      <Pressable style={styles.input} onPress={() => setOpen((v) => !v)}>
        <Text style={{ flex: 1, fontSize: 13, color: colors.textPrimary }}>{value}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={13} color={colors.textSecondary} />
      </Pressable>
      {open && (
        <View style={styles.dropdown}>
          {opts.map((y) => (
            <Pressable
              key={y}
              style={[styles.dropOpt, y === value && styles.dropOptActive]}
              onPress={() => { onChange(y); setOpen(false); }}
            >
              <Text style={[styles.dropOptText, y === value && styles.dropOptTextActive]}>{y}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

/* ─── Channel row ───────────────────────────────────────────────────────── */
function ChannelRow({ cp, units, onChange, channelMap }) {
  const cid      = getChannelId(cp);
  const name     = channelMap?.[String(cid)] || getChannelName(cp) || cid;
  const basis    = cp.targetValueBasis || 'cifUsd';
  const price    = getBasisPrice(cp);
  const currency = cp.targetCurrency || 'USD';
  const value    = calcValue(units, cp);
  const hasUnits = units !== '' && !isNaN(Number(units)) && Number(units) > 0;

  return (
    <View style={[styles.channelRow, hasUnits && styles.channelRowActive]}>
      {/* Left: name + prices */}
      <View style={styles.channelLeft}>
        <Text style={styles.channelName}>{name}</Text>
        <View style={styles.priceTags}>
          <View style={styles.priceTag}>
            <Text style={styles.priceTagLabel}>{TARGET_BASIS_LABELS[basis] || basis}</Text>
            <Text style={styles.priceTagValue}>{fmtMoney(price, currency)}</Text>
          </View>
          {cp.cifUsd      != null && basis !== 'cifUsd'       && (
            <View style={styles.priceTag}>
              <Text style={styles.priceTagLabel}>CIF USD</Text>
              <Text style={styles.priceTagValue}>${cp.cifUsd}</Text>
            </View>
          )}
          {cp.wholesaleAed != null && basis !== 'wholesaleAed' && (
            <View style={styles.priceTag}>
              <Text style={styles.priceTagLabel}>WS AED</Text>
              <Text style={styles.priceTagValue}>{cp.wholesaleAed}</Text>
            </View>
          )}
          {cp.retailAed   != null && basis !== 'retailAed'    && (
            <View style={styles.priceTag}>
              <Text style={styles.priceTagLabel}>RP AED</Text>
              <Text style={styles.priceTagValue}>{cp.retailAed}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Right: units input + auto value */}
      <View style={styles.channelRight}>
        <View style={styles.unitsWrap}>
          <Text style={styles.unitsLabel}>Units</Text>
          <TextInput
            style={styles.unitsInput}
            value={units}
            onChangeText={onChange}
            placeholder="0"
            placeholderTextColor={colors.textMuted}
            keyboardType="numeric"
            textAlign="right"
          />
        </View>
        <View style={styles.valueWrap}>
          <Text style={styles.unitsLabel}>Value ({currency})</Text>
          <View style={styles.valueDisplay}>
            <Text style={[styles.valueText, hasUnits && value != null && { color: colors.success }]}>
              {hasUnits && value != null ? fmtMoney(value, currency) : '—'}
            </Text>
            {hasUnits && price > 0 && (
              <Text style={styles.valueFormula}>
                {Number(units).toLocaleString()} × {fmtMoney(price, currency)}
              </Text>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

/* ─── Main ──────────────────────────────────────────────────────────────── */
export default function TargetAssignmentFormScreen({
  navigation, route, userDetails, appMetadata, onSignOut,
}) {
  const mode         = route?.params?.mode || 'create';
  const assignmentId = route?.params?.assignmentId;
  const isEdit       = mode === 'edit'      && !!assignmentId;
  const isDuplicate  = mode === 'duplicate' && !!assignmentId;

  const token = userDetails?.token || userDetails?.data?.token || '';

  const [products,     setProducts]     = useState([]);
  const [channelMap,   setChannelMap]   = useState({});  // { [channelId]: channelName }
  const [loadingInit,  setLoadingInit]  = useState(isEdit || isDuplicate);
  const [saving,       setSaving]       = useState(false);
  const [loadError,    setLoadError]    = useState('');
  const [saveError,    setSaveError]    = useState('');
  const [saveMessage,  setSaveMessage]  = useState('');
  const [errors,       setErrors]       = useState({});

  const [productId,       setProductId]       = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [year,            setYear]            = useState(String(THIS_YEAR));
  const [channelUnits,    setChannelUnits]    = useState({});   // { [channelId]: string }

  /* Load products + channels (for name lookup) */
  useEffect(() => {
    listProducts(token, { limit: 300, status: 'active' })
      .then(({ products: p }) => setProducts(p))
      .catch(() => {});

    listSalesChannels(token, {})
      .then(({ channels }) => {
        const map = {};
        (channels || []).forEach((ch) => {
          const id = ch._id || ch.channelId;
          if (id) map[String(id)] = ch.channelName || ch.channelKey || String(id);
        });
        setChannelMap(map);
      })
      .catch(() => {});
  }, [token]);

  /* Sync selectedProduct */
  useEffect(() => {
    if (!productId) { setSelectedProduct(null); setChannelUnits({}); return; }
    const prod = products.find((p) => (p._id || p.productId) === productId);
    setSelectedProduct(prod || null);
    if (!isEdit) setChannelUnits({});
  }, [productId, products]);

  /* Prefill for edit / duplicate */
  useEffect(() => {
    if (!isEdit && !isDuplicate) return;
    setLoadingInit(true);
    getTargetAssignmentById(token, assignmentId)
      .then((data) => {
        const prod  = data.productId || {};
        const pid   = typeof prod === 'string' ? prod : (prod._id || prod.productId || '');
        setProductId(pid);
        setYear(String(data.year || THIS_YEAR));

        /* prefill channel units from channelTargets or single channelId */
        if (Array.isArray(data.channelTargets) && data.channelTargets.length > 0) {
          const cu = {};
          data.channelTargets.forEach((ct) => {
            const cid = ct.channelId || ct._id || '';
            if (cid) cu[cid] = String(ct.units ?? '');
          });
          setChannelUnits(cu);
        } else if (data.channelId && data.totalTargetUnits != null) {
          const cid = typeof data.channelId === 'string' ? data.channelId : data.channelId._id;
          if (cid) setChannelUnits({ [cid]: String(data.totalTargetUnits) });
        }
      })
      .catch((e) => setLoadError(e.message || 'Failed to load assignment'))
      .finally(() => setLoadingInit(false));
  }, [isEdit, isDuplicate, assignmentId, token]);

  /* Channel pricing rows */
  const channelPricingList = selectedProduct && Array.isArray(selectedProduct.channelPricing)
    ? selectedProduct.channelPricing.filter((cp) => getChannelId(cp))
    : [];

  /* Totals */
  const totals = channelPricingList.reduce(
    (acc, cp) => {
      const cid   = getChannelId(cp);
      const u     = channelUnits[cid];
      if (!u || isNaN(Number(u)) || Number(u) <= 0) return acc;
      return {
        units: acc.units + Number(u),
        value: acc.value + (calcValue(u, cp) || 0),
        count: acc.count + 1,
      };
    },
    { units: 0, value: 0, count: 0 },
  );

  const validate = () => {
    const errs = {};
    if (!productId)     errs.productId = 'Product is required';
    if (!year)          errs.year      = 'Year is required';
    if (totals.count === 0) errs.channels = 'Enter target units for at least one channel';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    setSaveError('');
    setSaveMessage('');
    try {
      const channelTargets = channelPricingList
        .filter((cp) => {
          const u = channelUnits[getChannelId(cp)];
          return u && !isNaN(Number(u)) && Number(u) > 0;
        })
        .map((cp) => ({
          channelId: getChannelId(cp),
          units:     Number(channelUnits[getChannelId(cp)]),
        }));

      const payload = {
        productId,
        year:           Number(year),
        channelTargets,
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

  const productOptions = products.map((p) => ({
    value: p._id || p.productId || '',
    label: `${p.productName || p.name || ''}${p.productNickname ? ` · ${p.productNickname}` : ''}`,
  }));

  const titleMap = {
    create:    'Add Target Assignment',
    edit:      'Edit Target Assignment',
    duplicate: 'Duplicate Assignment',
  };

  return (
    <AppShell
      navigation={navigation}
      userDetails={userDetails}
      appMetadata={appMetadata}
      onSignOut={onSignOut}
      activeRoute="TargetAssignments"
    >
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
            Select a product and enter target units per channel. Values are calculated automatically from channel pricing.
          </Text>

          {/* Top row: product + year side by side */}
          <View style={styles.topRow}>
            <View style={[styles.topField, { zIndex: 50 }]}>
              <Text style={styles.fieldLabel}>Product <Text style={styles.required}>*</Text></Text>
              <ProductDropdown
                options={productOptions}
                value={productId}
                onChange={setProductId}
              />
              {errors.productId ? <Text style={styles.fieldError}>{errors.productId}</Text> : null}
            </View>
            <View style={[styles.topField, { maxWidth: 140, zIndex: 40 }]}>
              <Text style={styles.fieldLabel}>Year <Text style={styles.required}>*</Text></Text>
              <YearDropdown value={year} onChange={setYear} />
              {errors.year ? <Text style={styles.fieldError}>{errors.year}</Text> : null}
            </View>
          </View>

          {/* Channel rows */}
          <View style={styles.channelsSection}>
            <Text style={styles.channelsSectionTitle}>
              {productId
                ? channelPricingList.length === 0
                  ? 'No channel pricing found for this product'
                  : `Channel Targets — ${channelPricingList.length} channel${channelPricingList.length > 1 ? 's' : ''}`
                : 'Select a product to see its channels'}
            </Text>
            {errors.channels ? <Text style={styles.fieldError}>{errors.channels}</Text> : null}

            {channelPricingList.map((cp) => {
              const cid = getChannelId(cp);
              return (
                <ChannelRow
                  key={cid}
                  cp={cp}
                  channelMap={channelMap}
                  units={channelUnits[cid] ?? ''}
                  onChange={(v) => setChannelUnits((prev) => ({ ...prev, [cid]: v }))}
                />
              );
            })}

            {/* Totals */}
            {totals.count > 0 && (
              <View style={styles.totalsCard}>
                <Text style={styles.totalsTitle}>
                  Total · {totals.count} channel{totals.count > 1 ? 's' : ''}
                </Text>
                <View style={styles.totalsRow}>
                  <View style={styles.totalsItem}>
                    <Text style={styles.totalsLabel}>Total Units</Text>
                    <Text style={styles.totalsValue}>{totals.units.toLocaleString()}</Text>
                  </View>
                  <View style={styles.totalsDivider} />
                  <View style={styles.totalsItem}>
                    <Text style={styles.totalsLabel}>Total Value</Text>
                    <Text style={styles.totalsValue}>
                      {totals.value.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </View>

          {saveError   ? <Text style={styles.errorText}>{saveError}</Text>   : null}
          {saveMessage ? <Text style={styles.successText}>{saveMessage}</Text> : null}

          {/* Actions */}
          <View style={styles.actionRow}>
            <Pressable style={styles.btnCancel} onPress={() => navigation.goBack()}>
              <Text style={styles.btnCancelText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.btnPrimary} onPress={handleSave} disabled={saving}>
              {saving && <ActivityIndicator size={14} color={colors.white} />}
              <Text style={styles.btnPrimaryText}>
                {saving
                  ? 'Saving...'
                  : isEdit
                  ? 'Update Assignment'
                  : isDuplicate
                  ? 'Create Duplicate'
                  : 'Save Assignment'}
              </Text>
            </Pressable>
          </View>
        </View>
      )}
    </AppShell>
  );
}

/* ─── Styles ────────────────────────────────────────────────────────────── */
const shadow = {
  shadowColor: '#0B2B66', shadowOpacity: 0.06, shadowRadius: 8,
  shadowOffset: { width: 0, height: 2 },
};

const styles = StyleSheet.create({
  breadcrumb: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: globalHeight('1.2%') },
  breadcrumbLink: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  breadcrumbCurrent: { fontSize: 13, color: colors.textSecondary },
  centered: { alignItems: 'center', padding: 32, gap: 10 },
  errorText: { color: colors.danger, fontSize: 13 },
  successText: { color: colors.success, fontSize: 13, fontWeight: '700' },

  formCard: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 10,
    backgroundColor: colors.surface, padding: 24, gap: 20, ...shadow,
  },
  cardTitle: { fontSize: 17, fontWeight: '800', color: colors.textPrimary },
  cardSubtitle: { fontSize: 13, color: colors.textSecondary, marginTop: -12 },

  topRow: { flexDirection: 'row', gap: 16, alignItems: 'flex-start', zIndex: 100 },
  topField: { flex: 1, gap: 6 },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  required: { color: colors.danger },
  fieldError: { fontSize: 12, color: colors.danger, marginTop: 2 },

  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    paddingHorizontal: 12, height: 40, fontSize: 13, color: colors.textPrimary,
    backgroundColor: colors.surface, outlineStyle: 'none',
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  dropdown: {
    position: 'absolute', top: 44, left: 0, right: 0,
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    backgroundColor: '#FFFFFF', zIndex: 9999,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
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

  /* Channels section */
  channelsSection: { gap: 10, zIndex: 1 },
  channelsSectionTitle: { fontSize: 14, fontWeight: '800', color: colors.textPrimary },

  channelRow: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 10,
    backgroundColor: colors.surface, padding: 14,
    flexDirection: 'row', gap: 16, alignItems: 'center',
  },
  channelRowActive: { borderColor: colors.primary, backgroundColor: colors.primary + '05' },
  channelLeft: { flex: 3, gap: 8 },
  channelRight: { flex: 2, flexDirection: 'row', gap: 10, alignItems: 'flex-end' },

  channelName: { fontSize: 14, fontWeight: '800', color: colors.textPrimary },
  priceTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  priceTag: {
    backgroundColor: colors.backgroundColor, borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  priceTagLabel: { fontSize: 10, color: colors.textMuted, fontWeight: '700' },
  priceTagValue: { fontSize: 12, fontWeight: '800', color: colors.textPrimary },

  unitsWrap: { flex: 1, gap: 4 },
  unitsLabel: { fontSize: 11, fontWeight: '700', color: colors.textSecondary },
  unitsInput: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    paddingHorizontal: 10, height: 40, fontSize: 15, fontWeight: '700',
    color: colors.textPrimary, backgroundColor: colors.surface, outlineStyle: 'none',
    textAlign: 'right',
  },
  valueWrap: { flex: 1, gap: 4 },
  valueDisplay: {
    backgroundColor: colors.backgroundColor, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 8, minHeight: 40, justifyContent: 'center',
  },
  valueText: { fontSize: 14, fontWeight: '800', color: colors.textMuted },
  valueFormula: { fontSize: 10, color: colors.textMuted, marginTop: 1 },

  /* Totals */
  totalsCard: {
    backgroundColor: colors.primary + '08', borderWidth: 1, borderColor: colors.primary + '30',
    borderRadius: 10, padding: 16, gap: 10,
  },
  totalsTitle: { fontSize: 12, fontWeight: '800', color: colors.primary },
  totalsRow: { flexDirection: 'row', alignItems: 'center', gap: 0 },
  totalsItem: { flex: 1, alignItems: 'center', gap: 2 },
  totalsDivider: { width: 1, height: 36, backgroundColor: colors.primary + '30' },
  totalsLabel: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },
  totalsValue: { fontSize: 22, fontWeight: '800', color: colors.textPrimary },

  actionRow: {
    flexDirection: 'row', justifyContent: 'flex-end', gap: 10,
    paddingTop: 4, borderTopWidth: 1, borderTopColor: colors.border,
  },
  btnPrimary: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.primary, paddingHorizontal: 18, paddingVertical: 9, borderRadius: 8,
  },
  btnPrimaryText: { color: colors.white, fontSize: 13, fontWeight: '700' },
  btnCancel: {
    paddingHorizontal: 18, paddingVertical: 9, borderRadius: 8,
    borderWidth: 1, borderColor: colors.border,
  },
  btnCancelText: { fontSize: 13, color: colors.textSecondary, fontWeight: '700' },
});
