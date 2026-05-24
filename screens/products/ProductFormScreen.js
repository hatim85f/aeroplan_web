import React, { useState, useEffect, useRef } from 'react';
import {
  ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AppShell from '../../components/AppShell';
import { colors } from '../../constants/colors';
import { globalHeight, globalWidth } from '../../constants/globalWidth';
import { getProductById, createProduct, updateProduct } from '../../store/products/productActions';
import { listSalesChannels } from '../../store/salesChannels/salesChannelActions';
import { getLines } from '../../store/lines/linesActions';
import { uploadProductImage } from '../../store/cloudinary';

/* ─── Color palette for dynamic channels ──────────────────────────────────── */
const ACCENT_PALETTE = [
  { accent: '#1D4ED8', bg: '#EFF6FF', border: '#BFDBFE' },
  { accent: '#15803D', bg: '#F0FDF4', border: '#BBF7D0' },
  { accent: '#C2410C', bg: '#FFF7ED', border: '#FED7AA' },
  { accent: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE' },
  { accent: '#0E7490', bg: '#ECFEFF', border: '#A5F3FC' },
  { accent: '#B45309', bg: '#FFFBEB', border: '#FDE68A' },
];
const paletteFor = (idx) => ACCENT_PALETTE[idx % ACCENT_PALETTE.length];

const emptyChannelPricing = () => ({
  cifUsd: '', wholesaleAed: '', retailAed: '', defaultFocPercentage: '', focNotes: '',
});

/* ─── Helpers ───────────────────────────────────────────────────────────── */
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

function SectionHeader({ title }) {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

function LineDropdown({ lines, value, onChange }) {
  const [open, setOpen] = useState(false);
  const selected = lines.find((l) => (l.lineId || l._id) === value);
  return (
    <View>
      <Pressable style={styles.input} onPress={() => setOpen((v) => !v)}>
        <Ionicons name="layers-outline" size={14} color={colors.textSecondary} />
        <Text
          style={[{ flex: 1, fontSize: 13 }, selected ? { color: colors.textPrimary } : { color: colors.textMuted }]}
          numberOfLines={1}
        >
          {selected ? (selected.lineName || selected.name || selected.lineId) : 'Select a line'}
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={13} color={colors.textSecondary} />
      </Pressable>
      {open && (
        <View style={styles.dropdown}>
          <Pressable style={styles.dropOpt} onPress={() => { onChange(''); setOpen(false); }}>
            <Text style={[styles.dropOptText, !value && styles.dropOptTextActive]}>None</Text>
          </Pressable>
          {lines.map((l) => {
            const id = l.lineId || l._id;
            const label = l.lineName || l.name || id;
            const sel = value === id;
            return (
              <Pressable key={id} style={[styles.dropOpt, sel && styles.dropOptActive]} onPress={() => { onChange(id); setOpen(false); }}>
                <Text style={[styles.dropOptText, sel && styles.dropOptTextActive]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

function StatusToggle({ value, onChange }) {
  const opts = [
    { key: 'active',   label: 'Active',   icon: 'checkmark-circle-outline' },
    { key: 'inactive', label: 'Inactive', icon: 'close-circle-outline' },
  ];
  return (
    <View style={styles.typeButtons}>
      {opts.map(({ key, label, icon }) => {
        const active = value === key;
        return (
          <Pressable key={key} style={[styles.typeBtn, active && styles.typeBtnActive]} onPress={() => onChange(key)}>
            <Ionicons name={icon} size={15} color={active ? colors.white : colors.textSecondary} />
            <Text style={[styles.typeBtnText, active && styles.typeBtnTextActive]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ─── Dynamic channel pricing section ─────────────────────────────────────── */
function ChannelPricingSection({ channel, color, pricing, onChange }) {
  const [open, setOpen] = useState(true);
  const update = (key) => (val) => onChange({ ...pricing, [key]: val });

  return (
    <View style={[styles.pricingSection, { borderColor: color.border }]}>
      <Pressable
        style={[styles.pricingSectionHeader, { backgroundColor: color.bg }]}
        onPress={() => setOpen((v) => !v)}
      >
        <Text style={[styles.pricingSectionLabel, { color: color.accent }]}>
          {channel.channelName}
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={15} color={color.accent} />
      </Pressable>
      {open && (
        <View style={styles.pricingSectionBody}>
          <View style={styles.priceGrid}>
            {[
              { key: 'cifUsd',       label: 'CIF USD' },
              { key: 'wholesaleAed', label: 'WS AED'  },
              { key: 'retailAed',    label: 'RP AED'  },
            ].map(({ key, label }) => (
              <View key={key} style={styles.priceFieldWrap}>
                <Text style={styles.priceFieldLabel}>{label}</Text>
                <TextInput
                  style={styles.priceInput}
                  value={pricing?.[key] != null ? String(pricing[key]) : ''}
                  onChangeText={update(key)}
                  placeholder="0.00"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="decimal-pad"
                />
              </View>
            ))}
          </View>
          {channel.focEnabled && (
            <View style={styles.focRow}>
              <View style={styles.priceFieldWrap}>
                <Text style={styles.priceFieldLabel}>Default FOC %</Text>
                <TextInput
                  style={[styles.priceInput, { width: 110 }]}
                  value={pricing?.defaultFocPercentage != null ? String(pricing.defaultFocPercentage) : ''}
                  onChangeText={update('defaultFocPercentage')}
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={{ flex: 2 }}>
                <Text style={styles.priceFieldLabel}>FOC Notes</Text>
                <TextInput
                  style={styles.priceInput}
                  value={pricing?.focNotes || ''}
                  onChangeText={update('focNotes')}
                  placeholder="Optional notes"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

/* ─── Main ──────────────────────────────────────────────────────────────── */
export default function ProductFormScreen({ navigation, route, userDetails, appMetadata, onSignOut }) {
  const mode = route?.params?.mode || 'create';
  const productId = route?.params?.productId;
  const isEdit = mode === 'edit' && !!productId;

  const token = userDetails?.token || userDetails?.data?.token || '';

  const [loadingInit, setLoadingInit] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [lines, setLines] = useState([]);
  const [channels, setChannels] = useState([]);
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef(null);

  /* form state */
  const [form, setForm] = useState({
    productName: '',
    productNickname: '',
    description: '',
    imageUrl: '',
    lineId: '',
    status: 'active',
  });
  const [errors, setErrors] = useState({});

  /* channel selections */
  const [selectedChannelIds, setSelectedChannelIds] = useState(new Set());
  const [channelPricing, setChannelPricing] = useState({});  // { [id]: emptyChannelPricing() }

  const set = (key) => (val) => setForm((f) => ({ ...f, [key]: val }));

  const toggleChannel = (id) => {
    setSelectedChannelIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
    setChannelPricing((prev) => ({
      ...prev,
      [id]: prev[id] || emptyChannelPricing(),
    }));
  };

  const updateChannelPricing = (id) => (newPricing) => {
    setChannelPricing((prev) => ({ ...prev, [id]: newPricing }));
  };

  /* fetch lines */
  useEffect(() => {
    getLines(token).then((res) => {
      setLines(Array.isArray(res) ? res : res?.lines || res?.data || []);
    }).catch(() => {});
  }, [token]);

  /* fetch active channels */
  useEffect(() => {
    setLoadingChannels(true);
    listSalesChannels(token, { status: 'active', isActive: true })
      .then(({ channels: list }) => setChannels(list))
      .catch(() => {})
      .finally(() => setLoadingChannels(false));
  }, [token]);

  /* edit: prefill form + channel pricing */
  useEffect(() => {
    if (!isEdit) return;
    setLoadingInit(true);
    const toStr = (v) => (v != null ? String(v) : '');
    getProductById(token, productId)
      .then((data) => {
        setForm({
          productName:     data?.productName || data?.name || '',
          productNickname: data?.productNickname || data?.nickname || '',
          description:     data?.description || '',
          imageUrl:        data?.imageUrl || '',
          lineId:          data?.lineId || data?.line?.lineId || '',
          status:          data?.status || (data?.isActive === false ? 'inactive' : 'active'),
        });

        /* prefill channel pricing from channelPricing array */
        const cpList = Array.isArray(data?.channelPricing) ? data.channelPricing : [];
        const ids = new Set(cpList.map((cp) => cp.channelId).filter(Boolean));
        const pricing = {};
        cpList.forEach((cp) => {
          if (cp.channelId) {
            pricing[cp.channelId] = {
              cifUsd:                toStr(cp.cifUsd),
              wholesaleAed:          toStr(cp.wholesaleAed),
              retailAed:             toStr(cp.retailAed),
              defaultFocPercentage:  toStr(cp.defaultFocPercentage),
              focNotes:              cp.focNotes || '',
            };
          }
        });
        setSelectedChannelIds(ids);
        setChannelPricing(pricing);
      })
      .catch((e) => setLoadError(e.message || 'Failed to load product'))
      .finally(() => setLoadingInit(false));
  }, [isEdit, productId, token]);

  const validate = () => {
    const errs = {};
    if (!form.productName.trim()) errs.productName = 'Product name is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const toNum = (v) => (v === '' || v == null ? undefined : Number(v));

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    setSaveError('');
    setSaveMessage('');
    try {
      const cpPayload = Array.from(selectedChannelIds).map((id) => {
        const ch = channels.find((c) => (c._id || c.channelId) === id);
        const p = channelPricing[id] || {};
        const entry = {
          channelId:    id,
          cifUsd:       toNum(p.cifUsd),
          wholesaleAed: toNum(p.wholesaleAed),
          retailAed:    toNum(p.retailAed),
        };
        if (ch?.focEnabled) {
          entry.defaultFocPercentage = toNum(p.defaultFocPercentage) ?? 0;
          if (p.focNotes?.trim()) entry.focNotes = p.focNotes.trim();
        } else {
          entry.defaultFocPercentage = 0;
        }
        return entry;
      });

      const body = {
        productName:     form.productName.trim(),
        productNickname: form.productNickname.trim(),
        description:     form.description.trim(),
        imageUrl:        form.imageUrl.trim(),
        lineId:          form.lineId,
        status:          form.status,
        isActive:        form.status === 'active',
        channelPricing:  cpPayload,
      };

      if (isEdit) {
        await updateProduct(token, productId, body);
        setSaveMessage('Product updated successfully.');
      } else {
        await createProduct(token, body);
        setSaveMessage('Product created successfully.');
      }
      setTimeout(() => navigation.navigate('Products'), 1000);
    } catch (e) {
      setSaveError(e.message || 'Failed to save product');
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const uri = URL.createObjectURL(file);
      const result = await uploadProductImage(uri);
      set('imageUrl')(result.url || result.secureUrl || '');
    } catch (err) {
      alert(err.message || 'Image upload failed');
    } finally {
      setUploadingImage(false);
    }
  };

  return (
    <AppShell navigation={navigation} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} activeRoute="Products">
      {/* Breadcrumb */}
      <View style={styles.breadcrumb}>
        <Pressable onPress={() => navigation.navigate('Products')}>
          <Text style={styles.breadcrumbLink}>Products</Text>
        </Pressable>
        <Ionicons name="chevron-forward" size={13} color={colors.textMuted} />
        <Text style={styles.breadcrumbCurrent}>{isEdit ? 'Edit Product' : 'Add Product'}</Text>
      </View>

      {loadingInit ? (
        <View style={styles.centered}><ActivityIndicator size="small" color={colors.primary} /></View>
      ) : loadError ? (
        <View style={styles.centered}><Text style={styles.errorText}>{loadError}</Text></View>
      ) : (
        <View style={styles.formCard}>
          <Text style={styles.cardTitle}>{isEdit ? 'Edit Product' : 'Product Information'}</Text>
          <Text style={styles.cardSubtitle}>
            {isEdit ? 'Update the product details below.' : 'Fill in the details to create a new product.'}
          </Text>

          <View style={styles.twoColForm}>
            {/* Left: Basic info */}
            <View style={[styles.formCol, { zIndex: 2 }]}>
              <Field label="Product Name" required error={errors.productName}>
                <TextInput
                  style={[styles.input, errors.productName && styles.inputError]}
                  value={form.productName}
                  onChangeText={set('productName')}
                  placeholder="Enter product name"
                  placeholderTextColor={colors.textMuted}
                />
              </Field>

              <Field label="Nickname">
                <TextInput
                  style={styles.input}
                  value={form.productNickname}
                  onChangeText={set('productNickname')}
                  placeholder="Short code or nickname"
                  placeholderTextColor={colors.textMuted}
                />
              </Field>

              <Field label="Description">
                <TextInput
                  style={[styles.input, styles.inputMulti]}
                  value={form.description}
                  onChangeText={set('description')}
                  placeholder="Product description..."
                  placeholderTextColor={colors.textMuted}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </Field>

              <Field label="Line" style={{ zIndex: 20 }}>
                <LineDropdown lines={lines} value={form.lineId} onChange={set('lineId')} />
              </Field>

              <Field label="Status">
                <StatusToggle value={form.status} onChange={set('status')} />
              </Field>

              <Field label="Product Image">
                <View style={styles.imageUploadWrap}>
                  {form.imageUrl ? (
                    <Image source={{ uri: form.imageUrl }} style={styles.imagePreview} resizeMode="cover" />
                  ) : (
                    <View style={styles.imagePlaceholder}>
                      <Ionicons name="image-outline" size={28} color={colors.textMuted} />
                    </View>
                  )}
                  <View style={{ flex: 1, gap: 8 }}>
                    <label style={{ cursor: 'pointer' }}>
                      <View style={styles.btnOutline}>
                        {uploadingImage
                          ? <ActivityIndicator size={13} color={colors.primary} />
                          : <Ionicons name="cloud-upload-outline" size={14} color={colors.primary} />}
                        <Text style={styles.btnOutlineText}>{uploadingImage ? 'Uploading...' : 'Upload Image'}</Text>
                      </View>
                      <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} disabled={uploadingImage} />
                    </label>
                    <TextInput
                      style={styles.input}
                      value={form.imageUrl}
                      onChangeText={set('imageUrl')}
                      placeholder="Or paste image URL..."
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>
                </View>
              </Field>
            </View>

            {/* Right: Channel selection + pricing */}
            <View style={[styles.formCol, { zIndex: 1 }]}>
              <SectionHeader title="Sales Channels & Pricing" />
              <Text style={styles.fieldHint}>
                Select the channels this product is available in, then enter pricing for each.
              </Text>

              {/* Channel checkboxes */}
              {loadingChannels ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : channels.length === 0 ? (
                <View style={styles.noChannels}>
                  <Ionicons name="information-circle-outline" size={16} color={colors.textMuted} />
                  <Text style={styles.noChannelsText}>No active sales channels. Create channels first.</Text>
                </View>
              ) : (
                <View style={styles.channelCheckList}>
                  {channels.map((ch) => {
                    const id = ch._id || ch.channelId;
                    const selected = selectedChannelIds.has(id);
                    return (
                      <Pressable key={id} style={[styles.channelCheckItem, selected && styles.channelCheckItemSelected]} onPress={() => toggleChannel(id)}>
                        <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                          {selected && <Ionicons name="checkmark" size={12} color={colors.white} />}
                        </View>
                        <Text style={[styles.channelCheckLabel, selected && styles.channelCheckLabelSelected]}>
                          {ch.channelName}
                        </Text>
                        {ch.focEnabled && (
                          <View style={styles.focPill}>
                            <Text style={styles.focPillText}>FOC</Text>
                          </View>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              )}

              {/* Pricing sections for each selected channel */}
              {channels
                .filter((ch) => selectedChannelIds.has(ch._id || ch.channelId))
                .map((ch, idx) => {
                  const id = ch._id || ch.channelId;
                  return (
                    <ChannelPricingSection
                      key={id}
                      channel={ch}
                      color={paletteFor(idx)}
                      pricing={channelPricing[id] || emptyChannelPricing()}
                      onChange={updateChannelPricing(id)}
                    />
                  );
                })}

              {saveError ? <Text style={styles.errorText}>{saveError}</Text> : null}
              {saveMessage ? <Text style={styles.successText}>{saveMessage}</Text> : null}

              <View style={styles.actionRow}>
                <Pressable style={styles.btnCancel} onPress={() => navigation.goBack()}>
                  <Text style={styles.btnCancelText}>Cancel</Text>
                </Pressable>
                <Pressable style={styles.btnPrimary} onPress={handleSave} disabled={saving}>
                  {saving && <ActivityIndicator size={14} color={colors.white} />}
                  <Text style={styles.btnPrimaryText}>
                    {saving ? 'Saving...' : isEdit ? 'Update Product' : 'Save Product'}
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
  centered: { alignItems: 'center', padding: 32, gap: 10 },
  errorText: { color: colors.danger, fontSize: 13 },
  successText: { color: colors.success, fontSize: 13, fontWeight: '700' },

  breadcrumb: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: globalHeight('1.2%') },
  breadcrumbLink: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  breadcrumbCurrent: { fontSize: 13, color: colors.textSecondary },

  formCard: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.surface, padding: 24, ...shadow },
  cardTitle: { fontSize: 17, fontWeight: '800', color: colors.textPrimary, marginBottom: 4 },
  cardSubtitle: { fontSize: 13, color: colors.textSecondary, marginBottom: 24 },

  twoColForm: { flexDirection: 'row', gap: 24, alignItems: 'flex-start' },
  formCol: { flex: 1, gap: 16, minWidth: 0 },

  sectionHeader: {
    fontSize: 15, fontWeight: '800', color: colors.textPrimary,
    marginTop: 4, marginBottom: -4,
    paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border,
  },

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
  inputError: { borderColor: colors.danger },
  inputMulti: { height: 80, paddingTop: 10 },

  typeButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  typeBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  typeBtnText: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  typeBtnTextActive: { color: colors.white, fontWeight: '700' },

  dropdown: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 8,
    backgroundColor: colors.surface, marginTop: 2, ...shadow,
    zIndex: 100, position: 'absolute', left: 0, right: 0,
  },
  dropOpt: { paddingHorizontal: 12, paddingVertical: 10 },
  dropOptActive: { backgroundColor: colors.primary + '15' },
  dropOptText: { fontSize: 13, color: colors.textPrimary },
  dropOptTextActive: { color: colors.primary, fontWeight: '700' },

  imageUploadWrap: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  imagePreview: { width: 72, height: 72, borderRadius: 8, backgroundColor: colors.backgroundColor, flexShrink: 0 },
  imagePlaceholder: {
    width: 72, height: 72, borderRadius: 8, backgroundColor: colors.backgroundColor,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },

  btnOutline: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, alignSelf: 'flex-start' },
  btnOutlineText: { color: colors.primary, fontSize: 13, fontWeight: '700' },

  /* channel selection */
  noChannels: { flexDirection: 'row', gap: 8, alignItems: 'center', padding: 12, backgroundColor: colors.backgroundColor, borderRadius: 8 },
  noChannelsText: { fontSize: 12, color: colors.textMuted },

  channelCheckList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  channelCheckItem: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  channelCheckItemSelected: { borderColor: colors.primary, backgroundColor: colors.primary + '08' },
  checkbox: {
    width: 16, height: 16, borderRadius: 4, borderWidth: 1.5,
    borderColor: colors.border, alignItems: 'center', justifyContent: 'center',
  },
  checkboxSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  channelCheckLabel: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  channelCheckLabelSelected: { color: colors.primary },
  focPill: { backgroundColor: '#E7F8EF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  focPillText: { fontSize: 10, fontWeight: '700', color: colors.success },

  /* pricing section */
  pricingSection: { borderWidth: 1, borderRadius: 8, overflow: 'hidden' },
  pricingSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12 },
  pricingSectionLabel: { fontSize: 14, fontWeight: '800' },
  pricingSectionBody: { padding: 14, borderTopWidth: 1, borderTopColor: colors.border, gap: 12 },
  priceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  priceFieldWrap: { flex: 1, minWidth: 90, gap: 4 },
  priceFieldLabel: { fontSize: 12, color: colors.textSecondary, fontWeight: '700' },
  priceInput: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 6,
    paddingHorizontal: 10, height: 36, fontSize: 13, color: colors.textPrimary,
    backgroundColor: colors.surface, outlineStyle: 'none',
  },
  focRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },

  actionRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border },
  btnPrimary: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary, paddingHorizontal: 18, paddingVertical: 9, borderRadius: 8 },
  btnPrimaryText: { color: colors.white, fontSize: 13, fontWeight: '700' },
  btnCancel: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 8, borderWidth: 1, borderColor: colors.border },
  btnCancelText: { fontSize: 13, color: colors.textSecondary, fontWeight: '700' },
});
