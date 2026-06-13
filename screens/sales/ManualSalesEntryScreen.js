import React, { useEffect, useState, useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AppShell from '../../components/AppShell';
import { colors } from '../../constants/colors';
import { globalWidth } from '../../constants/globalWidth';
import { getAccounts } from '../../store/accounts/accountActions';
import { getProductById, listProducts } from '../../store/products/productActions';
import { listSalesChannels } from '../../store/salesChannels/salesChannelActions';
import { createManualSales } from '../../store/sales/salesActions';

const PAD = globalWidth('1.2%');
const shadow = { shadowColor: '#11224A', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 14, elevation: 3 };
const isManager = (role) => ['admin', 'manager', 'senior_manager'].includes(String(role || '').toLowerCase());
const THIS_YEAR = new Date().getFullYear();
const THIS_MONTH = new Date().getMonth() + 1;
const PRICE_BASIS_OPTIONS = [
  { value: 'cifUsd', label: 'CIF USD', currency: 'USD' },
  { value: 'wholesaleAed', label: 'Wholesale AED', currency: 'AED' },
  { value: 'retailAed', label: 'Retail AED', currency: 'AED' },
];
const makeProductLine = () => ({
  productId: '',
  channelId: '',
  priceBasis: '',
  quantity: '',
  freeQuantity: '0',
});
const toNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};
const fmtMoney = (value, currency) => `${toNumber(value).toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency || ''}`.trim();
const getBasisCurrency = (basis) => PRICE_BASIS_OPTIONS.find((opt) => opt.value === basis)?.currency || 'AED';
const getChannelId = (entry) => entry?.channelId?._id || entry?.channelId || entry?.channel || '';

function SelectBox({ label, value, options, onChange, placeholder }) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  return (
    <View style={{ flex: 1, minWidth: 180, gap: 6, position: 'relative', zIndex: open ? 50 : 1 }}>
      <Text style={styles.label}>{label}</Text>
      <Pressable style={styles.inputLike} onPress={() => setOpen((v) => !v)}>
        <Text style={styles.inputLikeText} numberOfLines={1}>{selected?.label || placeholder || 'Select'}</Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={12} color={colors.textMuted} />
      </Pressable>
      {open && (
        <View style={styles.dropdown}>
          <ScrollView style={{ maxHeight: 220 }} nestedScrollEnabled>
            {options.map((opt) => (
              <Pressable key={String(opt.value)} style={styles.dropOpt} onPress={() => { onChange(opt.value); setOpen(false); }}>
                <Text style={styles.dropOptText}>{opt.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

export default function ManualSalesEntryScreen({ navigation, userDetails, appMetadata, onSignOut }) {
  const token = userDetails?.token || userDetails?.data?.token || '';
  const user = userDetails?.user || userDetails?.data?.user || userDetails || {};
  const manager = isManager(user.role);

  const [accounts, setAccounts] = useState([]);
  const [products, setProducts] = useState([]);
  const [productDetails, setProductDetails] = useState({});
  const [channels, setChannels] = useState([]);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);
  const [form, setForm] = useState({
    invoiceNumber: '',
    salesDate: new Date().toISOString().slice(0, 10),
    month: String(THIS_MONTH),
    year: String(THIS_YEAR),
    accountId: '',
    notes: '',
  });
  const [productLines, setProductLines] = useState([makeProductLine()]);

  useEffect(() => {
    getAccounts(token, { limit: 300 }).then((r) => setAccounts(r.accounts || r.data || [])).catch(() => {});
    listProducts(token, { limit: 300, status: 'active' }).then((r) => setProducts(r.products || [])).catch(() => {});
    listSalesChannels(token, { status: 'active', limit: 500 }).then((r) => setChannels(r.channels || [])).catch(() => {});
  }, [token]);

  const getVisibleChannels = (productId) => {
    return channels;
  };
  const getPricingEntry = (line) => {
    const product = productDetails[line.productId] || products.find((p) => (p._id || p.id || p.productId) === line.productId);
    const pricing = Array.isArray(product?.channelPricing) ? product.channelPricing : [];
    if (line.channelId) {
      const matched = pricing.find((entry) => String(getChannelId(entry)) === String(line.channelId));
      if (matched) return matched;
    }
    return pricing[0] || product || {};
  };
  const getPriceOptions = (line) => {
    const entry = getPricingEntry(line);
    return PRICE_BASIS_OPTIONS
      .filter((opt) => entry?.[opt.value] !== undefined && entry?.[opt.value] !== null && entry?.[opt.value] !== '')
      .map((opt) => ({ ...opt, label: `${opt.label} - ${fmtMoney(entry[opt.value], opt.currency)}` }));
  };
  const getEffectiveBasis = (line) => {
    const entry = getPricingEntry(line);
    if (line.priceBasis && entry?.[line.priceBasis] !== undefined && entry?.[line.priceBasis] !== null && entry?.[line.priceBasis] !== '') return line.priceBasis;
    if (entry?.targetValueBasis && entry?.[entry.targetValueBasis] !== undefined && entry?.[entry.targetValueBasis] !== null && entry?.[entry.targetValueBasis] !== '') return entry.targetValueBasis;
    return getPriceOptions(line)[0]?.value || '';
  };
  const getUnitPrice = (line) => toNumber(getPricingEntry(line)?.[getEffectiveBasis(line)]);
  const getLineValue = (line) => getUnitPrice(line) * toNumber(line.quantity);
  const getLineCurrency = (line) => getBasisCurrency(getEffectiveBasis(line));

  const set = (key) => (value) => setForm((prev) => ({ ...prev, [key]: value }));
  const setLine = (index, key, value) => {
    setProductLines((prev) => prev.map((line, i) => (i === index ? { ...line, [key]: value } : line)));
  };
  const handleProductSelect = async (index, productId) => {
    setProductLines((prev) => prev.map((line, i) => (i === index ? { ...line, productId, channelId: '', priceBasis: '' } : line)));
    if (!productId || productDetails[productId]) return;
    try {
      const detail = await getProductById(token, productId);
      setProductDetails((prev) => ({ ...prev, [productId]: detail }));
    } catch (e) {
      // The list row may still contain enough pricing to proceed.
    }
  };
  const addLine = () => setProductLines((prev) => [...prev, makeProductLine()]);
  const removeLine = (index) => setProductLines((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)));
  const totalsByCurrency = productLines.reduce((acc, line) => {
    const currency = getLineCurrency(line);
    acc[currency] = (acc[currency] || 0) + getLineValue(line);
    return acc;
  }, {});

  const submit = async () => {
    if (!form.month || !form.year || !form.accountId) {
      alert('Month, year, and account are required.');
      return;
    }
    const invalidLine = productLines.some((line) => !line.productId || line.quantity === '' || !getEffectiveBasis(line));
    if (invalidLine) {
      alert('Each product line needs a product, value basis, and quantity.');
      return;
    }
    setSaving(true); setResult(null);
    try {
      const linePayload = productLines.map((line) => ({
        productId: line.productId,
        channelId: line.channelId || undefined,
        quantity: Number(line.quantity),
        freeQuantity: Number(line.freeQuantity || 0),
        uploadedSalesValue: getLineValue(line),
        uploadedCurrency: getLineCurrency(line),
      }));
      const payload = {
        invoiceNumber: form.invoiceNumber.trim() || undefined,
        salesDate: form.salesDate || undefined,
        month: Number(form.month),
        year: Number(form.year),
        accountId: form.accountId,
        channelId: linePayload.find((line) => line.channelId)?.channelId,
        notes: form.notes.trim() || undefined,
        products: linePayload,
      };
      const created = await createManualSales(token, payload);
      setResult(created);
    } catch (e) {
      alert(e.message || 'Manual sales entry failed');
    } finally {
      setSaving(false);
    }
  };

  if (!manager) {
    return <AppShell navigation={navigation} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} activeRoute="SalesOverview"><View style={styles.centered}><Text style={styles.errorText}>Manual sales entry is manager/admin only.</Text></View></AppShell>;
  }

  return (
    <AppShell navigation={navigation} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} activeRoute="ManualSalesEntry">
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.pageHeader}>
          <View><Text style={styles.pageTitle}>Manual Sales Entry</Text><Text style={styles.pageSubtitle}>Add a sales record when a sheet is missing or wrong</Text></View>
        </View>

        <View style={styles.card}>
          <View style={styles.formRow}>
            <Field label="Invoice Number" value={form.invoiceNumber} onChangeText={set('invoiceNumber')} placeholder="MANUAL-001" />
            <Field label="Sales Date" value={form.salesDate} onChangeText={set('salesDate')} placeholder="YYYY-MM-DD" />
            <Field label="Month *" value={form.month} onChangeText={set('month')} />
            <Field label="Year *" value={form.year} onChangeText={set('year')} />
          </View>
          <View style={styles.formRow}>
            <SelectBox label="Account *" value={form.accountId} onChange={set('accountId')} options={accounts.map((a) => ({ value: a._id || a.id, label: a.accountName || a.name || a._id }))} />
          </View>

          <View style={styles.linesHeader}>
            <View>
              <Text style={styles.sectionTitle}>Products</Text>
              <Text style={styles.sectionSubtitle}>All product lines will be sent under the selected account.</Text>
            </View>
            <Pressable style={styles.btnSecondary} onPress={addLine}>
              <Ionicons name="add-outline" size={14} color={colors.primary} />
              <Text style={styles.btnSecondaryText}>Add Product</Text>
            </Pressable>
          </View>

          {productLines.map((line, index) => {
            const visibleChannels = getVisibleChannels(line.productId);
            const priceOptions = getPriceOptions(line);
            const effectiveBasis = getEffectiveBasis(line);
            const lineCurrency = getLineCurrency(line);
            return (
              <View key={index} style={styles.lineCard}>
                <View style={styles.lineTitleRow}>
                  <Text style={styles.lineTitle}>Product {index + 1}</Text>
                  <Pressable style={[styles.iconBtn, productLines.length === 1 && { opacity: 0.4 }]} onPress={() => removeLine(index)} disabled={productLines.length === 1}>
                    <Ionicons name="trash-outline" size={15} color={colors.danger} />
                  </Pressable>
                </View>
                <View style={styles.formRow}>
                  <SelectBox
                    label="Product *"
                    value={line.productId}
                    onChange={(v) => handleProductSelect(index, v)}
                    options={products.map((p) => ({ value: p._id || p.id || p.productId, label: p.productName || p.name || p.productNickname || p._id }))}
                  />
                  <SelectBox
                    label="Channel"
                    value={line.channelId}
                    onChange={(v) => {
                      setLine(index, 'channelId', v);
                      setLine(index, 'priceBasis', '');
                    }}
                    options={[{ value: '', label: 'No channel' }, ...visibleChannels.map((c) => ({ value: c._id || c.id || c.channelId, label: c.channelName || c.channelKey || c.name || c._id }))]}
                  />
                  <SelectBox
                    label="Value Basis *"
                    value={effectiveBasis}
                    onChange={(v) => setLine(index, 'priceBasis', v)}
                    placeholder={line.productId ? 'No product price found' : 'Select product first'}
                    options={priceOptions}
                  />
                </View>
                <View style={styles.formRow}>
                  <Field label="Quantity *" value={line.quantity} onChangeText={(v) => setLine(index, 'quantity', v)} />
                  <Field label="Free Quantity" value={line.freeQuantity} onChangeText={(v) => setLine(index, 'freeQuantity', v)} />
                </View>
                <View style={styles.lineValueRow}>
                  <Text style={styles.lineValueLabel}>Line value</Text>
                  <Text style={styles.lineValueText}>
                    {fmtMoney(getLineValue(line), lineCurrency)}
                    {getUnitPrice(line) ? ` (${fmtMoney(getUnitPrice(line), lineCurrency)} x ${toNumber(line.quantity)})` : ''}
                  </Text>
                </View>
              </View>
            );
          })}

          <View style={styles.totalBox}>
            <Text style={styles.totalLabel}>Total uploaded entry value</Text>
            <View style={styles.totalValues}>
              {Object.entries(totalsByCurrency).map(([currency, value]) => (
                <Text key={currency} style={styles.totalValue}>{fmtMoney(value, currency)}</Text>
              ))}
            </View>
          </View>

          <Field label="Notes" value={form.notes} onChangeText={set('notes')} placeholder="Manual sales entry notes" />
          <View style={styles.actions}>
            <Pressable style={[styles.btnPrimary, saving && { opacity: 0.6 }]} onPress={submit} disabled={saving}>
              {saving ? <ActivityIndicator size={13} color="#fff" /> : <Ionicons name="checkmark-outline" size={14} color="#fff" />}
              <Text style={styles.btnPrimaryText}>{saving ? 'Saving...' : `Create ${productLines.length} Manual Sale${productLines.length > 1 ? 's' : ''}`}</Text>
            </Pressable>
          </View>
        </View>

        {result && (
          <View style={styles.card}>
            <Text style={styles.resultTitle}>Manual Sales Processed</Text>
            <Text style={styles.resultText}>Batch: {result.batch?._id || result.batch?.id || '-'}</Text>
            <Text style={styles.resultText}>Created: {result.summary?.createdCount ?? result.records?.length ?? '-'}</Text>
            <Text style={styles.resultText}>Failed: {result.summary?.failedCount ?? result.failedItems?.length ?? 0}</Text>
            <Text style={styles.resultText}>
              Submitted Value: {Object.entries(totalsByCurrency).map(([currency, value]) => fmtMoney(value, currency)).join(' / ')}
            </Text>
            {Array.isArray(result.failedItems) && result.failedItems.length > 0 ? (
              <View style={styles.failedBox}>
                {result.failedItems.map((item, idx) => (
                  <Text key={idx} style={styles.failedText}>{item.message || item.error || `Line ${idx + 1} failed`}</Text>
                ))}
              </View>
            ) : null}
          </View>
        )}
      </ScrollView>
    </AppShell>
  );
}

function Field({ label, value, onChangeText, placeholder }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={styles.input} value={value} onChangeText={onChangeText} placeholder={placeholder || label} placeholderTextColor={colors.textMuted} />
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: PAD, gap: 16, paddingBottom: 48 },
  pageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  pageTitle: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  pageSubtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  card: { gap: 14, padding: 16, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.surface, ...shadow },
  formRow: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  field: { flex: 1, minWidth: 180, gap: 6 },
  label: { fontSize: 11, color: colors.textSecondary, fontWeight: '800', textTransform: 'uppercase' },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 9, color: colors.textPrimary },
  inputLike: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 9 },
  inputLikeText: { flex: 1, fontSize: 13, color: colors.textPrimary, fontWeight: '600' },
  dropdown: { marginTop: 4, borderWidth: 1, borderColor: colors.border, borderRadius: 8, backgroundColor: colors.surface, ...shadow },
  dropOpt: { paddingHorizontal: 12, paddingVertical: 9 },
  dropOptText: { fontSize: 13, color: colors.textPrimary },
  linesHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 14 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: colors.textPrimary },
  sectionSubtitle: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  lineCard: { gap: 12, padding: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.backgroundColor },
  lineTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  lineTitle: { fontSize: 13, color: colors.textPrimary, fontWeight: '800' },
  iconBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 7, backgroundColor: '#FEF2F2' },
  lineValueRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
  lineValueLabel: { fontSize: 12, color: colors.textSecondary, fontWeight: '700' },
  lineValueText: { fontSize: 13, color: colors.textPrimary, fontWeight: '800' },
  totalBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: 12, borderRadius: 10, backgroundColor: colors.primary + '0C', borderWidth: 1, borderColor: colors.primary + '24' },
  totalLabel: { fontSize: 13, color: colors.textSecondary, fontWeight: '800' },
  totalValues: { alignItems: 'flex-end', gap: 2 },
  totalValue: { fontSize: 16, color: colors.primary, fontWeight: '900' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end' },
  btnPrimary: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8 },
  btnPrimaryText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  btnSecondary: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  btnSecondaryText: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  resultTitle: { fontSize: 15, color: colors.textPrimary, fontWeight: '800' },
  resultText: { fontSize: 13, color: colors.textSecondary },
  failedBox: { gap: 4, padding: 10, borderWidth: 1, borderColor: '#FCA5A5', borderRadius: 8, backgroundColor: '#FEF2F2' },
  failedText: { fontSize: 12, color: colors.danger, fontWeight: '600' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30 },
  errorText: { color: colors.danger, fontSize: 14 },
});
