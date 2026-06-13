import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AppShell from '../../components/AppShell';
import { colors } from '../../constants/colors';
import { globalHeight, globalWidth } from '../../constants/globalWidth';
import { getAccounts } from '../../store/accounts/accountActions';
import { apiRequest } from '../../store/apiClient';
import OrderTargetProgress from './OrderTargetProgress';
import {
  createOrder, getOrderInitData, markOrderEmailSent, getCurrentUser,
} from '../../store/orders/orderActions';

/* ─── Helpers ────────────────────────────────────────────────────────────── */
function fmtUSD(v) {
  if (v === null || v === undefined || v === '') return '—';
  return `$${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtAED(v) {
  if (v === null || v === undefined || v === '') return '—';
  return `AED ${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtN(v) {
  if (v === null || v === undefined || v === '') return '—';
  return Number(v).toLocaleString('en-US');
}
function getInitials(name) {
  return (name || '?').split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase() || '').join('');
}

/** Extract channel-specific price from product.
 *  Products store pricing in 'channelPricing' array, FOC as 'defaultFocPercentage'.
 */
function getChannelPrice(product, channelId) {
  if (!product || !channelId) return { unitCifUsd: 0, unitWholesaleAed: 0, unitRetailAed: 0, focPercentage: 0 };

  // Primary: channelPricing array (used by ProductFormScreen / backend)
  // Fallback: salesChannels / channels (alternative naming)
  const arr = Array.isArray(product.channelPricing)
    ? product.channelPricing
    : Array.isArray(product.salesChannels)
      ? product.salesChannels
      : Array.isArray(product.channels)
        ? product.channels
        : [];

  const match = arr.find((sc) => {
    // channelId may be a plain string ID, a populated object, or stored under 'channel'
    const cid = sc.channelId?._id || sc.channelId?.id || sc.channelId
      || sc.channel?._id  || sc.channel?.id  || sc.channel
      || sc._id || sc.id;
    return String(cid) === String(channelId);
  });

  if (match) {
    return {
      unitCifUsd:       match.cifUsd       ?? match.unitCifUsd  ?? match.price ?? 0,
      unitWholesaleAed: match.wholesaleAed ?? match.unitWholesaleAed ?? 0,
      unitRetailAed:    match.retailAed    ?? match.unitRetailAed    ?? 0,
      // FOC stored as 'defaultFocPercentage' in ProductFormScreen payload
      focPercentage:    match.defaultFocPercentage ?? match.focPercentage ?? match.foc ?? 0,
    };
  }

  // Fallback: top-level product fields (some APIs lift the channel price to root)
  return {
    unitCifUsd:       product.unitCifUsd  ?? product.cifUsd  ?? product.price ?? 0,
    unitWholesaleAed: product.unitWholesaleAed ?? product.wholesaleAed ?? 0,
    unitRetailAed:    product.unitRetailAed    ?? product.retailAed    ?? 0,
    focPercentage:    product.defaultFocPercentage ?? product.focPercentage ?? product.foc ?? 0,
  };
}

/* ─── Step bar ───────────────────────────────────────────────────────────── */
const STEPS = ['Account', 'Channel', 'Products', 'Summary'];

function StepBar({ step }) {
  return (
    <View style={sbStyles.bar}>
      {STEPS.map((label, idx) => {
        const num    = idx + 1;
        const done   = step > num;
        const active = step === num;
        return (
          <React.Fragment key={num}>
            {idx > 0 && (
              <View style={[sbStyles.line, (done || active) && sbStyles.lineActive]} />
            )}
            <View style={sbStyles.item}>
              <View style={[sbStyles.circle, done && sbStyles.circleDone, active && sbStyles.circleActive]}>
                {done
                  ? <Ionicons name="checkmark" size={12} color={colors.white} />
                  : <Text style={[sbStyles.circleText, active && { color: colors.white }]}>{num}</Text>
                }
              </View>
              <Text style={[sbStyles.label, active && sbStyles.labelActive, done && sbStyles.labelDone]}>
                {label}
              </Text>
            </View>
          </React.Fragment>
        );
      })}
    </View>
  );
}
const sbStyles = StyleSheet.create({
  bar:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: globalHeight('2%'), flexWrap: 'wrap', gap: 4 },
  item:         { alignItems: 'center', gap: 6 },
  line:         { flex: 1, height: 2, backgroundColor: colors.border, minWidth: 30, maxWidth: 80, marginTop: -14 },
  lineActive:   { backgroundColor: colors.primary },
  circle:       { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  circleDone:   { backgroundColor: colors.primary, borderColor: colors.primary },
  circleActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  circleText:   { fontSize: 13, fontWeight: '800', color: colors.textMuted },
  label:        { fontSize: globalWidth('0.62%'), color: colors.textMuted, fontWeight: '600' },
  labelActive:  { color: colors.primary, fontWeight: '800' },
  labelDone:    { color: colors.success },
});

/* ─── Email Fallback Modal ───────────────────────────────────────────────── */
function EmailFallbackModal({ data, onClose }) {
  const [copied, setCopied] = useState('');
  const cp = (text, k) => {
    navigator?.clipboard?.writeText(text).catch(() => {});
    setCopied(k);
    setTimeout(() => setCopied(''), 2200);
  };
  return (
    <View style={efStyles.overlay}>
      <View style={efStyles.box}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <Ionicons
            name={data.missingEmail ? 'warning-outline' : 'mail-outline'}
            size={20}
            color={data.missingEmail ? colors.danger : colors.primary}
          />
          <Text style={{ fontSize: 15, fontWeight: '800', color: colors.textPrimary, flex: 1 }}>
            {data.missingEmail ? (data.missingLabel ? 'Salesman email missing' : 'Manager email missing') : 'Email Draft Ready'}
          </Text>
          <Pressable onPress={onClose}><Ionicons name="close" size={18} color={colors.textMuted} /></Pressable>
        </View>

        {data.missingEmail && (
          <View style={efStyles.warnBox}>
            <Ionicons name="warning-outline" size={14} color="#92400E" />
            <Text style={efStyles.warnText}>
              {data.missingLabel || 'Manager email is missing. Please add it before sending the approval email.'}
            </Text>
          </View>
        )}

        <Text style={efStyles.metaText}>To: <Text style={efStyles.metaVal}>{data.managerEmail || '(empty — will open blank mail)'}</Text></Text>
        {data.salesEmails?.length > 0 && (
          <Text style={[efStyles.metaText, { marginBottom: 10 }]}>CC: <Text style={efStyles.metaVal}>{data.salesEmails.join(', ')}</Text></Text>
        )}

        {[
          { key: 'subject', label: 'Subject', val: data.subject },
          { key: 'body',    label: 'Body',    val: data.body },
        ].map(({ key, label, val }) => (
          <View key={key} style={efStyles.block}>
            <View style={efStyles.blockHead}>
              <Text style={efStyles.blockLabel}>{label}</Text>
              <Pressable onPress={() => cp(val, key)} style={efStyles.copyBtn}>
                <Ionicons name={copied === key ? 'checkmark' : 'copy-outline'} size={12} color={copied === key ? colors.success : colors.primary} />
                <Text style={[efStyles.copyBtnText, copied === key && { color: colors.success }]}>
                  {copied === key ? 'Copied' : 'Copy'}
                </Text>
              </Pressable>
            </View>
            <Text style={efStyles.blockText}>{val}</Text>
          </View>
        ))}

        <Pressable
          style={efStyles.copyAll}
          onPress={() => cp(`To: ${data.managerEmail || ''}\nCC: ${data.salesEmails?.join(', ') || ''}\nSubject: ${data.subject}\n\n${data.body}`, 'all')}
        >
          <Ionicons name={copied === 'all' ? 'checkmark' : 'copy-outline'} size={14} color={colors.white} />
          <Text style={{ color: colors.white, fontSize: 13, fontWeight: '700' }}>{copied === 'all' ? 'Copied!' : 'Copy All'}</Text>
        </Pressable>
      </View>
    </View>
  );
}
const efStyles = StyleSheet.create({
  overlay:      { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', zIndex: 999 },
  box:          { backgroundColor: colors.surface, borderRadius: 12, padding: 24, width: globalWidth('44%'), maxWidth: 580, gap: 8, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  warnBox:      { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A', borderRadius: 8, padding: 10 },
  warnText:     { flex: 1, fontSize: 12, color: '#92400E', lineHeight: 18 },
  metaText:     { fontSize: 12, color: colors.textSecondary, marginBottom: 2 },
  metaVal:      { color: colors.textPrimary, fontWeight: '600' },
  block:        { borderWidth: 1, borderColor: colors.border, borderRadius: 8, overflow: 'hidden', marginBottom: 4 },
  blockHead:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 7, backgroundColor: colors.backgroundColor },
  blockLabel:   { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  blockText:    { padding: 12, fontSize: 12, color: colors.textPrimary, fontFamily: 'monospace', lineHeight: 18 },
  copyBtn:      { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: colors.primary, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  copyBtnText:  { fontSize: 11, color: colors.primary, fontWeight: '700' },
  copyAll:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.primary, borderRadius: 8, paddingVertical: 10, marginTop: 4 },
});

/* ─── Product Row ────────────────────────────────────────────────────────── */
function ProductRow({ item, products, channelId, onChangeProduct, onChangeQty, onChangeFoc, onRemove }) {
  const [open,   setOpen]   = useState(false);
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search) return products.slice(0, 60);
    const q = search.toLowerCase();
    return products.filter((p) =>
      (p.productName || '').toLowerCase().includes(q) ||
      (p.productNickname || '').toLowerCase().includes(q)
    ).slice(0, 60);
  }, [search, products]);

  const prices = item.productData ? getChannelPrice(item.productData, channelId) : null;
  const qty    = parseInt(item.quantity) || 0;

  // Use manually set FOC if provided, otherwise fall back to product default
  const isCustomFoc    = item.focPercentage !== null && item.focPercentage !== undefined;
  const effectiveFocPct = isCustomFoc ? item.focPercentage : (prices?.focPercentage ?? 0);
  const estFoc          = qty > 0 ? Math.floor(qty * (effectiveFocPct / 100)) : 0;

  return (
    <View style={prStyles.row}>
      {/* Product picker — INLINE expand (no position:absolute) */}
      <View style={[prStyles.cell, { flex: 2.4 }]}>
        <Pressable style={prStyles.prodTrigger} onPress={() => setOpen((v) => !v)}>
          <View style={{ flex: 1, minWidth: 0 }}>
            {item.productData
              ? <Text style={prStyles.prodSelected} numberOfLines={1}>{item.productData.productName}</Text>
              : <Text style={prStyles.prodPlaceholder}>Select product…</Text>
            }
            {item.productData?.productNickname ? (
              <Text style={prStyles.prodNick} numberOfLines={1}>{item.productData.productNickname}</Text>
            ) : null}
          </View>
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={12} color={colors.textSecondary} />
        </Pressable>
        {open && (
          <View style={prStyles.prodDropdown}>
            <View style={prStyles.prodSearchRow}>
              <Ionicons name="search-outline" size={13} color={colors.textMuted} />
              <TextInput
                style={prStyles.prodSearchInput}
                value={search}
                onChangeText={setSearch}
                placeholder="Search products…"
                placeholderTextColor={colors.textMuted}
                autoFocus
              />
              <Pressable onPress={() => { setOpen(false); setSearch(''); }} style={{ padding: 2 }}>
                <Ionicons name="close" size={13} color={colors.textMuted} />
              </Pressable>
            </View>
            <ScrollView style={{ maxHeight: 200 }} keyboardShouldPersistTaps="handled" nestedScrollEnabled showsVerticalScrollIndicator={false}>
              {filtered.length === 0
                ? <Text style={prStyles.prodEmpty}>No products found</Text>
                : filtered.map((p) => {
                    const pid = p._id || p.id;
                    return (
                      <Pressable
                        key={pid}
                        style={prStyles.prodOpt}
                        onPress={() => { onChangeProduct(p); setOpen(false); setSearch(''); }}
                      >
                        <Text style={prStyles.prodOptName}>{p.productName}</Text>
                        {p.productNickname ? <Text style={prStyles.prodOptNick}>{p.productNickname}</Text> : null}
                      </Pressable>
                    );
                  })
              }
            </ScrollView>
          </View>
        )}
      </View>

      {/* Qty */}
      <View style={[prStyles.cell, { flex: 0.7 }]}>
        <TextInput
          style={[prStyles.qtyInput, !item.productData && { opacity: 0.4 }]}
          value={item.quantity === '' || item.quantity === undefined ? '' : String(item.quantity)}
          onChangeText={(v) => {
            const raw = v.replace(/[^0-9]/g, '');
            onChangeQty(raw === '' ? '' : parseInt(raw));
          }}
          keyboardType="numeric"
          placeholder="Qty"
          placeholderTextColor={colors.textMuted}
          editable={!!item.productData}
        />
      </View>

      {/* Unit CIF */}
      <View style={[prStyles.cell, { flex: 1, alignItems: 'flex-end' }]}>
        <Text style={prStyles.priceText}>{prices ? fmtUSD(prices.unitCifUsd) : '—'}</Text>
      </View>

      {/* Unit Whl */}
      <View style={[prStyles.cell, { flex: 1.1, alignItems: 'flex-end' }]}>
        <Text style={prStyles.priceText}>{prices ? fmtAED(prices.unitWholesaleAed) : '—'}</Text>
      </View>

      {/* FOC % — editable; custom value highlighted */}
      <View style={[prStyles.cell, { flex: 0.7, alignItems: 'center' }]}>
        <View style={prStyles.focInputWrap}>
          <TextInput
            style={[prStyles.focInput, isCustomFoc && prStyles.focInputCustom, !item.productData && { opacity: 0.4 }]}
            value={isCustomFoc ? String(item.focPercentage) : (prices ? String(prices.focPercentage) : '')}
            onChangeText={(v) => {
              if (!item.productData) return;
              const raw = v.replace(/[^0-9]/g, '');
              onChangeFoc(raw === '' ? null : parseInt(raw, 10));
            }}
            keyboardType="numeric"
            placeholder={prices ? `${prices.focPercentage}` : '0'}
            placeholderTextColor={colors.textMuted}
            editable={!!item.productData}
          />
          <Text style={prStyles.focPct}>%</Text>
        </View>
        {isCustomFoc && (
          <Pressable onPress={() => onChangeFoc(null)} style={prStyles.focReset} hitSlop={6}>
            <Ionicons name="refresh-outline" size={9} color={colors.textMuted} />
          </Pressable>
        )}
      </View>

      {/* Est FOC Qty */}
      <View style={[prStyles.cell, { flex: 0.7, alignItems: 'center' }]}>
        <Text style={prStyles.priceText}>{estFoc > 0 ? fmtN(estFoc) : '—'}</Text>
      </View>

      {/* Row total CIF */}
      <View style={[prStyles.cell, { flex: 1.2, alignItems: 'flex-end' }]}>
        <Text style={prStyles.rowTotal}>
          {prices && qty > 0 ? fmtUSD(prices.unitCifUsd * qty) : '—'}
        </Text>
      </View>

      {/* Remove */}
      <Pressable style={prStyles.removeBtn} onPress={onRemove}>
        <Ionicons name="trash-outline" size={14} color={colors.danger} />
      </Pressable>
    </View>
  );
}
const prStyles = StyleSheet.create({
  row:             { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 8, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 8 },
  cell:            { justifyContent: 'flex-start' },
  prodTrigger:     { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: colors.border, borderRadius: 7, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: colors.surface },
  prodSelected:    { fontSize: globalWidth('0.68%'), fontWeight: '700', color: colors.textPrimary },
  prodNick:        { fontSize: globalWidth('0.58%'), color: colors.textSecondary },
  prodPlaceholder: { fontSize: globalWidth('0.68%'), color: colors.textMuted },
  // Inline dropdown — renders in document flow, no position:absolute clipping
  prodDropdown:    { marginTop: 3, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.border, borderRadius: 8, shadowColor: '#000', shadowOpacity: 0.14, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 10 },
  prodSearchRow:   { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  prodSearchInput: { flex: 1, fontSize: globalWidth('0.68%'), color: colors.textPrimary, outlineStyle: 'none', height: 26 },
  prodOpt:         { paddingHorizontal: 12, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: colors.border },
  prodOptName:     { fontSize: globalWidth('0.68%'), fontWeight: '600', color: colors.textPrimary },
  prodOptNick:     { fontSize: globalWidth('0.6%'), color: colors.textSecondary, marginTop: 1 },
  prodEmpty:       { fontSize: globalWidth('0.65%'), color: colors.textMuted, padding: 14, textAlign: 'center' },
  qtyInput:        { borderWidth: 1, borderColor: colors.border, borderRadius: 7, paddingHorizontal: 8, paddingVertical: 7, fontSize: globalWidth('0.72%'), color: colors.textPrimary, outlineStyle: 'none', textAlign: 'center' },
  priceText:       { fontSize: globalWidth('0.65%'), color: colors.textPrimary },
  // FOC input — editable; turns green when a custom value is set
  focInputWrap:    { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: 7, paddingHorizontal: 5, paddingVertical: 5, backgroundColor: colors.surface },
  focInput:        { width: globalWidth('2.4%'), fontSize: globalWidth('0.68%'), color: colors.textPrimary, outlineStyle: 'none', textAlign: 'center' },
  focInputCustom:  { color: '#059669', fontWeight: '700' },
  focPct:          { fontSize: globalWidth('0.6%'), color: colors.textSecondary },
  focReset:        { marginTop: 2, alignSelf: 'center' },
  noneText:        { fontSize: globalWidth('0.6%'), color: colors.textMuted },
  rowTotal:        { fontSize: globalWidth('0.68%'), fontWeight: '700', color: colors.textPrimary },
  removeBtn:       { width: 28, height: 28, borderRadius: 6, borderWidth: 1, borderColor: '#FCA5A5', alignItems: 'center', justifyContent: 'center', marginTop: 4 },
});

/* ─── Main Screen ────────────────────────────────────────────────────────── */
const EMPTY_ITEM = () => ({ productId: '', productData: null, quantity: '', focPercentage: null });

const isManagerRole = (role) =>
  ['admin', 'manager', 'senior_manager'].includes(String(role || '').toLowerCase());

export default function CreateOrderScreen({ navigation, route, userDetails, appMetadata, onSignOut }) {
  const token               = userDetails?.token || userDetails?.data?.token || '';
  const currentUser         = userDetails?.user  || userDetails?.data?.user  || userDetails || {};
  const isManagerUser       = isManagerRole(currentUser.role);
  const resetKey            = route?.params?.resetKey;
  const preselectedAccount  = route?.params?.preselectedAccount || null;

  // ── Step
  const [step, setStep] = useState(1);

  // ── Step 1: Account
  const [accountSearch,   setAccountSearch]   = useState('');
  const [accountResults,  setAccountResults]  = useState([]);
  const [accountLoading,  setAccountLoading]  = useState(false);
  const [showAcctDrop,    setShowAcctDrop]    = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [initData,        setInitData]        = useState(null);
  const [initLoading,     setInitLoading]     = useState(false);
  const [salesHero,       setSalesHero]       = useState([]);
  const [ccSalesTeam,     setCcSalesTeam]     = useState(true);
  const [ccManager,       setCcManager]       = useState(false);

  // ── Step 2: Channel (also fallback from sales-channels API)
  const [fallbackChannels,  setFallbackChannels]  = useState([]);
  const [selectedChannel,   setSelectedChannel]   = useState(null);

  // ── Step 3: Products
  const [products,        setProducts]        = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [orderItems,      setOrderItems]      = useState([EMPTY_ITEM()]);

  // ── Step 4 / Submit
  const [notes,        setNotes]        = useState('');
  const [submitting,   setSubmitting]   = useState(false);
  const [submitError,  setSubmitError]  = useState('');
  const [createdOrder, setCreatedOrder] = useState(null);
  const [emailFallback,setEmailFallback]= useState(null);

  // Reset entire form
  const resetForm = useCallback(() => {
    setStep(1);
    setAccountSearch('');
    setAccountResults([]);
    setShowAcctDrop(false);
    setSelectedAccount(null);
    setInitData(null);
    setSalesHero([]);
    setFallbackChannels([]);
    setSelectedChannel(null);
    setProducts([]);
    setOrderItems([EMPTY_ITEM()]);
    setNotes('');
    setSubmitError('');
    setCreatedOrder(null);
    setEmailFallback(null);
    setCcSalesTeam(true);
    setCcManager(false);
  }, []);

  // Reset when resetKey changes (Add Order clicked from list)
  // Skip if we also have a preselectedAccount — selectAccount handles its own reset
  useEffect(() => {
    if (resetKey && !preselectedAccount) resetForm();
  }, [resetKey]); // eslint-disable-line

  // Auto-select account when launched from AccountDetailScreen
  useEffect(() => {
    if (preselectedAccount) {
      resetForm();                          // clean slate first
      selectAccount(preselectedAccount);    // then auto-select
    }
  }, []); // eslint-disable-line — run once on mount only

  // ── Account search (debounced)
  useEffect(() => {
    if (!accountSearch || accountSearch.length < 2) {
      setAccountResults([]); setShowAcctDrop(false); return;
    }
    let cancelled = false;
    setAccountLoading(true);
    const t = setTimeout(async () => {
      try {
        const { accounts } = await getAccounts(token, { search: accountSearch, limit: 10 });
        if (!cancelled) { setAccountResults(accounts || []); setShowAcctDrop(true); }
      } catch { if (!cancelled) setAccountResults([]); }
      finally { if (!cancelled) setAccountLoading(false); }
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [accountSearch, token]);

  const selectAccount = async (account) => {
    setSelectedAccount(account);
    setShowAcctDrop(false);
    setAccountSearch('');
    setInitData(null);
    setSalesHero([]);
    setFallbackChannels([]);
    setSelectedChannel(null);
    setInitLoading(true);

    const accountId = account._id || account.id;

    try {
      // Fetch init data + sales hero in parallel
      const [initResult, heroResult] = await Promise.allSettled([
        getOrderInitData(token, accountId),
        apiRequest(`/sales-team/account/${accountId}`, { token }),
      ]);

      let initD = null;
      if (initResult.status === 'fulfilled') {
        initD = initResult.value;
        setInitData(initD);
      }

      // Sales Hero
      if (heroResult.status === 'fulfilled') {
        const h = heroResult.value;
        const heroes = h?.data?.members || h?.data?.salesTeam || h?.members
          || h?.salesTeam || (Array.isArray(h?.data) ? h.data : null)
          || (Array.isArray(h) ? h : []);
        setSalesHero(Array.isArray(heroes) ? heroes : []);
      } else if (initD?.salesTeam) {
        setSalesHero(Array.isArray(initD.salesTeam) ? initD.salesTeam : []);
      }

      // Determine channels
      const initChannels = (initD?.availableOrderChannels || []).filter((c) => c.allowRepOrders !== false);
      if (initChannels.length === 0) {
        // Fallback: fetch from sales-channels API
        try {
          const chRes = await apiRequest('/sales-channels?status=active&isActive=true&limit=50', { token });
          const allCh = chRes?.data?.channels || chRes?.channels || (Array.isArray(chRes?.data) ? chRes.data : []);
          const enabled = (Array.isArray(allCh) ? allCh : []).filter((c) => c.allowRepOrders === true);
          setFallbackChannels(enabled);
          autoSelectChannel(enabled);
        } catch { /* silent */ }
      } else {
        autoSelectChannel(initChannels);
      }
    } catch { /* silent */ }
    finally { setInitLoading(false); }
  };

  const autoSelectChannel = (channels) => {
    const direct = channels.find((c) =>
      (c.channelKey || '').toLowerCase() === 'direct' ||
      (c.channelName || '').toLowerCase() === 'direct'
    );
    if (direct) setSelectedChannel(direct);
    else if (channels.length === 1) setSelectedChannel(channels[0]);
    else setSelectedChannel(null);
  };

  // ── Load ALL products for selected channel (pagination)
  const loadChannelProducts = useCallback(async (channelId) => {
    if (!channelId) return;
    setProductsLoading(true);
    try {
      let all  = [];
      let pg   = 1;
      let maxPg = 1;
      do {
        const result = await apiRequest(
          `/products?channelId=${channelId}&channelAvailable=true&page=${pg}&limit=200&status=active`,
          { token }
        );
        const prods = result?.data?.products
          || result?.products
          || (Array.isArray(result?.data) ? result.data : [])
          || [];
        all = [...all, ...(Array.isArray(prods) ? prods : [])];
        const pag = result?.data?.pagination || result?.pagination || {};
        maxPg = pag?.pages || pag?.totalPages || 1;
        pg++;
      } while (pg <= maxPg && pg <= 15); // safety cap
      setProducts(all);
    } catch { setProducts([]); }
    finally { setProductsLoading(false); }
  }, [token]);

  const goToStep = (next) => {
    if (next === 3 && selectedChannel && products.length === 0) {
      loadChannelProducts(selectedChannel._id || selectedChannel.id);
    }
    setStep(next);
  };

  // ── Order item helpers
  const addItem = () => setOrderItems((prev) => [...prev, EMPTY_ITEM()]);
  const removeItem = (idx) => setOrderItems((prev) => prev.filter((_, i) => i !== idx));
  const updateItemProduct = (idx, product) => {
    const id = product._id || product.id;
    setOrderItems((prev) => prev.map((item, i) =>
      // Reset focPercentage to null when a new product is selected
      i === idx ? { ...item, productId: id, productData: product, focPercentage: null } : item
    ));
  };
  const updateItemQty = (idx, qty) => {
    setOrderItems((prev) => prev.map((item, i) =>
      i === idx ? { ...item, quantity: qty } : item
    ));
  };
  const updateItemFoc = (idx, foc) => {
    setOrderItems((prev) => prev.map((item, i) =>
      i === idx ? { ...item, focPercentage: foc } : item
    ));
  };

  // ── Estimated totals (respect per-item manual FOC overrides)
  const totals = useMemo(() => {
    const channelId = selectedChannel?._id || selectedChannel?.id;
    return orderItems.reduce((acc, item) => {
      if (!item.productData) return acc;
      const qty = parseInt(item.quantity) || 0;
      if (qty <= 0) return acc;
      const prices      = getChannelPrice(item.productData, channelId);
      const focPct      = (item.focPercentage !== null && item.focPercentage !== undefined)
        ? item.focPercentage
        : prices.focPercentage;
      const foc         = Math.floor(qty * (focPct / 100));
      return {
        totalQty:          acc.totalQty + qty,
        totalFocQty:       acc.totalFocQty + foc,
        totalCifUsd:       acc.totalCifUsd + qty * prices.unitCifUsd,
        totalWholesaleAed: acc.totalWholesaleAed + qty * prices.unitWholesaleAed,
      };
    }, { totalQty: 0, totalFocQty: 0, totalCifUsd: 0, totalWholesaleAed: 0 });
  }, [orderItems, selectedChannel]);

  const targetProgressItems = useMemo(() => {
    const channelId = selectedChannel?._id || selectedChannel?.id;
    return orderItems.map((item) => {
      if (!item.productData) return null;
      const qty = parseInt(item.quantity) || 0;
      if (qty <= 0) return null;
      const prices = getChannelPrice(item.productData, channelId);
      return {
        productId: item.productId || item.productData?._id || item.productData?.id || '',
        cifUsd: qty * (Number(prices.unitCifUsd) || 0),
        wholesaleAed: qty * (Number(prices.unitWholesaleAed) || 0),
        retailAed: qty * (Number(prices.unitRetailAed) || 0),
      };
    }).filter(Boolean);
  }, [orderItems, selectedChannel]);

  // ── Channels visible in Step 2
  const allChannels = (initData?.availableOrderChannels || []).length > 0
    ? initData.availableOrderChannels
    : fallbackChannels;

  // ── Email trigger (async — branches on creator role)
  const triggerEmail = useCallback(async (order) => {
    const accountName = order._accountName
      || (typeof order.accountId === 'object' ? order.accountId?.accountName : '')
      || order.accountName || '—';

    // Prefer UI-captured items (have full productName); fall back to BE items (may lack productName)
    const sourceItems = (order._emailItems?.length > 0 ? order._emailItems : null)
      || (order.items || []).map((item) => ({
          productName:   item.productName
            || (typeof item.productId === 'object' ? item.productId?.productName : '')
            || 'Product',
          quantity:      item.quantity,
          focPercentage: item.focPercentage ?? 0,
        }));

    const lines = sourceItems.map((item) => {
      const qty    = item.quantity || 0;
      const focPct = item.focPercentage ?? 0;
      const focQty = Math.floor(qty * focPct / 100);
      return `${item.productName} => ${qty} + ${focQty}`;
    });

    let to      = '';
    let cc      = '';
    let subject = '';
    let body    = '';
    let missingEmail = false;

    if (isManagerUser) {
      /* ── Manager created the order → email goes TO the salesman ── */
      // Prefer BE snapshot; fall back to the salesHero we fetched in Step 1
      const salesTeam   = (order.salesTeamSnapshot?.length > 0 ? order.salesTeamSnapshot : null)
        || order._salesHero
        || [];
      const allEmails   = salesTeam.map((m) => m.email).filter(Boolean);
      const toEmail     = allEmails[0] || '';
      const ccEmails    = allEmails.slice(1);

      // Salesman first name (first member of snapshot)
      const salesmanFull = salesTeam[0]?.fullName || salesTeam[0]?.name || '';
      const salesmanFirst = salesmanFull.split(' ')[0] || 'Team';

      subject      = `${accountName} order submission`;
      body         = [
        `Dear Dr. ${salesmanFirst}`,
        '',
        'Kindly submit the following order',
        '',
        ...lines,
        '',
        'Regards',
      ].join('\n');

      to           = toEmail ? encodeURIComponent(toEmail) : '';
      cc           = ccEmails.length ? `&cc=${encodeURIComponent(ccEmails.join(','))}` : '';
      missingEmail = !toEmail;

      // Always try to open mail client
      const url = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}${cc}`;
      try { window.open(url, '_blank') || (window.location.href = url); } catch { /* ignore */ }

      if (missingEmail) {
        setEmailFallback({
          managerEmail: toEmail,
          subject, body,
          salesEmails:  ccEmails,
          accountName,
          missingEmail: true,
          missingLabel: 'No salesman email found for this account.',
        });
      }
    } else {
      /* ── Rep created the order → email goes TO the manager for approval ── */
      let managerEmail     = '';
      let managerFirstName = 'Manager';
      try {
        const me = await getCurrentUser(token);
        managerEmail     = me?.managerEmail || '';
        const full       = me?.managerName || me?.name || '';
        managerFirstName = full.split(' ')[0] || 'Manager';
      } catch { /* use empty */ }

      const doCcSalesTeam = order._ccSalesTeam !== undefined ? order._ccSalesTeam : true;
      const salesEmails   = doCcSalesTeam
        ? (order.salesTeamSnapshot || []).map((m) => m.email).filter(Boolean)
        : [];

      subject      = `${accountName} order approval request`;
      body         = [
        `Dear Dr. ${managerFirstName}`,
        '',
        `Kindly approved the below order for ${accountName}`,
        '',
        ...lines,
        '',
        'Regards',
      ].join('\n');

      to           = managerEmail ? encodeURIComponent(managerEmail) : '';
      cc           = salesEmails.length ? `&cc=${encodeURIComponent(salesEmails.join(','))}` : '';
      missingEmail = !managerEmail;

      const url = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}${cc}`;
      try { window.open(url, '_blank') || (window.location.href = url); } catch { /* ignore */ }

      if (missingEmail) {
        setEmailFallback({ managerEmail, subject, body, salesEmails, accountName, missingEmail: true });
      }
    }
  }, [token, isManagerUser]);

  // ── Submit
  const handleSubmit = async () => {
    const validItems = orderItems.filter((i) => i.productId && parseInt(i.quantity) > 0);
    if (!validItems.length) { setSubmitError('Add at least one product with a valid quantity.'); return; }

    setSubmitting(true); setSubmitError('');

    // Capture before reset
    const capturedAccount    = selectedAccount;
    const capturedCcSalesTeam = ccSalesTeam;

    try {
      const today = new Date().toISOString().split('T')[0];
      const payload = {
        accountId:      capturedAccount._id || capturedAccount.id,
        channelId:      selectedChannel._id || selectedChannel.id,
        channelName:    selectedChannel.channelName || selectedChannel.name || '',
        channelKey:     selectedChannel.channelKey  || '',
        orderDate:      today,
        ccSalesTeam:    capturedCcSalesTeam,
        ccManagerOrKam: ccManager,
        notes:          notes.trim(),
        items:          validItems.map((i) => {
          const entry = { productId: i.productId, quantity: parseInt(i.quantity) };
          // Only send focPercentage when manually overridden by rep
          if (i.focPercentage !== null && i.focPercentage !== undefined) {
            entry.focPercentage = i.focPercentage;
          }
          return entry;
        }),
      };

      const order = await createOrder(token, payload);

      // Enrich with UI-only metadata needed for email (state will be reset below)
      // Capture before state clears
      const capturedSalesHero = salesHero;
      // Build a flat email-friendly item list from UI data (BE response may not populate productName)
      const capturedEmailItems = validItems.map((i) => ({
        productName:   i.productData?.productName || i.productData?.productNickname || 'Product',
        quantity:      parseInt(i.quantity),
        focPercentage: i.focPercentage !== null && i.focPercentage !== undefined
          ? i.focPercentage
          : (i.productData ? getChannelPrice(i.productData, selectedChannel?._id || selectedChannel?.id).focPercentage : 0),
      }));

      const enrichedOrder = {
        ...order,
        _accountName:    capturedAccount?.accountName || capturedAccount?.name || '—',
        _ccSalesTeam:    capturedCcSalesTeam,
        // Fallback: salesHero fetched in Step 1 (salesTeamSnapshot in BE response may be sparse)
        _salesHero:      capturedSalesHero,
        // Fallback: full item names from UI (BE response items only carry productId strings)
        _emailItems:     capturedEmailItems,
      };

      // Reset form state
      setStep(1);
      setAccountSearch('');
      setAccountResults([]);
      setShowAcctDrop(false);
      setSelectedAccount(null);
      setInitData(null);
      setSalesHero([]);
      setFallbackChannels([]);
      setSelectedChannel(null);
      setProducts([]);
      setOrderItems([EMPTY_ITEM()]);
      setNotes('');
      setCcSalesTeam(true);
      setCcManager(false);

      // Show success
      setCreatedOrder(enrichedOrder);

      // Open email client
      await triggerEmail(enrichedOrder);

      // Mark email as generated
      try { await markOrderEmailSent(token, order._id || order.id); } catch { /* silent */ }

    } catch (e) {
      setSubmitError(e.message || 'Failed to create order');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Per-step validation
  const canProceed = () => {
    if (step === 1) return !!selectedAccount && !initLoading;
    if (step === 2) return !!selectedChannel;
    if (step === 3) return orderItems.some((i) => i.productId && parseInt(i.quantity) > 0);
    return true;
  };

  /* ── Success screen ─────────────────────────────────────────────────────── */
  if (createdOrder) {
    const orderId = createdOrder._id || createdOrder.id;
    return (
      <AppShell navigation={navigation} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} activeRoute="CreateOrder">
        {emailFallback && <EmailFallbackModal data={emailFallback} onClose={() => setEmailFallback(null)} />}
        <View style={styles.successCard}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={52} color={colors.success} />
          </View>
          <Text style={styles.successTitle}>Order Created!</Text>
          <Text style={styles.successSub}>
            {createdOrder.orderNumber || 'Your order'} has been submitted successfully.
          </Text>
          {(createdOrder.warnings || []).length > 0 && (
            <View style={styles.warningsList}>
              {createdOrder.warnings.map((w, i) => (
                <View key={i} style={styles.warnItem}>
                  <Ionicons name="warning-outline" size={14} color="#D97706" />
                  <Text style={styles.warnItemText}>{w}</Text>
                </View>
              ))}
            </View>
          )}
          <View style={styles.successActions}>
            <Pressable style={styles.btnEmailDraft} onPress={() => triggerEmail(createdOrder)}>
              <Ionicons name="mail-outline" size={15} color={colors.primary} />
              <Text style={styles.btnEmailDraftText}>Open Email Draft Again</Text>
            </Pressable>
            <Pressable
              style={styles.btnViewOrder}
              onPress={() => navigation.navigate('OrderDetails', { orderId })}
            >
              <Ionicons name="eye-outline" size={15} color={colors.white} />
              <Text style={styles.btnViewOrderText}>View Order</Text>
            </Pressable>
            <Pressable style={styles.btnGoList} onPress={() => navigation.navigate('Orders')}>
              <Text style={styles.btnGoListText}>Back to Orders</Text>
            </Pressable>
          </View>
        </View>
      </AppShell>
    );
  }

  /* ── Wizard ─────────────────────────────────────────────────────────────── */
  return (
    <AppShell navigation={navigation} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} activeRoute="CreateOrder">
      {emailFallback && <EmailFallbackModal data={emailFallback} onClose={() => setEmailFallback(null)} />}

      {/* Page header */}
      <View style={styles.pageHeader}>
        <View>
          <Text style={styles.pageTitle}>Create Order</Text>
          <Text style={styles.pageSubtitle}>Fill in the details to create a new order</Text>
        </View>
        <Pressable style={styles.btnCancel} onPress={() => navigation.goBack()}>
          <Text style={styles.btnCancelText}>Cancel</Text>
        </Pressable>
      </View>

      <StepBar step={step} />

      <View style={styles.stepCard}>

        {/* ────── STEP 1: Account ────── */}
        {step === 1 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Select Account</Text>
            <Text style={styles.stepHint}>Search and select the account for this order.</Text>

            <View style={styles.searchWrap}>
              <Ionicons name="search-outline" size={14} color={colors.textSecondary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Type at least 2 characters to search accounts..."
                placeholderTextColor={colors.textMuted}
                value={accountSearch}
                onChangeText={(t) => { setAccountSearch(t); if (!t) { setAccountResults([]); setShowAcctDrop(false); } }}
              />
              {accountLoading && <ActivityIndicator size={13} color={colors.primary} />}
              {accountSearch ? (
                <Pressable onPress={() => { setAccountSearch(''); setAccountResults([]); setShowAcctDrop(false); }}>
                  <Ionicons name="close-circle" size={14} color={colors.textMuted} />
                </Pressable>
              ) : null}
            </View>

            {showAcctDrop && accountResults.length > 0 && (
              <View style={styles.acctDropdown}>
                {accountResults.map((a) => {
                  const aid = a._id || a.id;
                  const isSelected = selectedAccount && (selectedAccount._id || selectedAccount.id) === aid;
                  return (
                    <Pressable
                      key={aid}
                      style={[styles.acctOpt, isSelected && styles.acctOptSelected]}
                      onPress={() => selectAccount(a)}
                    >
                      <View style={styles.acctOptIcon}>
                        <Ionicons name="business-outline" size={14} color={isSelected ? colors.white : colors.primary} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.acctOptName, isSelected && { color: colors.primary }]} numberOfLines={1}>
                          {a.accountName || a.name}
                        </Text>
                        {a.accountType ? <Text style={styles.acctOptType}>{a.accountType}</Text> : null}
                      </View>
                      {isSelected && <Ionicons name="checkmark-circle" size={16} color={colors.success} />}
                    </Pressable>
                  );
                })}
              </View>
            )}
            {showAcctDrop && accountResults.length === 0 && !accountLoading && accountSearch.length >= 2 && (
              <View style={styles.dropEmpty}><Text style={styles.dropEmptyText}>No accounts found for "{accountSearch}"</Text></View>
            )}

            {/* Selected account card */}
            {selectedAccount && (
              <View style={styles.acctCard}>
                {initLoading ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16 }}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={{ fontSize: 13, color: colors.textSecondary }}>Loading account details…</Text>
                  </View>
                ) : (
                  <>
                    <View style={styles.acctCardHeader}>
                      <View style={styles.acctCardIcon}>
                        <Ionicons name="business-outline" size={18} color={colors.white} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.acctCardName}>{selectedAccount.accountName || selectedAccount.name}</Text>
                        {selectedAccount.accountType ? <Text style={styles.acctCardType}>{selectedAccount.accountType}</Text> : null}
                      </View>
                      <Ionicons name="checkmark-circle" size={20} color={colors.white} />
                    </View>

                    <View style={styles.acctDetails}>
                      {selectedAccount.accountCode || selectedAccount.code ? (
                        <View style={styles.acctDetailRow}>
                          <Text style={styles.acctDetailLabel}>Account Code</Text>
                          <Text style={styles.acctDetailVal}>{selectedAccount.accountCode || selectedAccount.code}</Text>
                        </View>
                      ) : null}
                      {selectedAccount.phoneNumber || selectedAccount.phone ? (
                        <View style={styles.acctDetailRow}>
                          <Text style={styles.acctDetailLabel}>Phone</Text>
                          <Text style={styles.acctDetailVal}>{selectedAccount.phoneNumber || selectedAccount.phone}</Text>
                        </View>
                      ) : null}
                      {(selectedAccount.location?.address || selectedAccount.address) ? (
                        <View style={styles.acctDetailRow}>
                          <Text style={styles.acctDetailLabel}>Address</Text>
                          <Text style={styles.acctDetailVal}>{selectedAccount.location?.address || selectedAccount.address}</Text>
                        </View>
                      ) : null}
                    </View>

                    {/* Sales Hero */}
                    {salesHero.length > 0 && (
                      <View style={styles.salesTeamSection}>
                        <Text style={styles.salesTeamTitle}>Sales Hero</Text>
                        {salesHero.map((m, i) => (
                          <View key={i} style={styles.salesTeamRow}>
                            <View style={styles.salesTeamAvatar}>
                              <Text style={styles.salesTeamAvatarText}>{getInitials(m.fullName || m.name)}</Text>
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.salesTeamName}>{m.fullName || m.name || '—'}</Text>
                              {m.position || m.role ? (
                                <Text style={styles.salesTeamPos}>{m.position || m.role}</Text>
                              ) : null}
                            </View>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* CC Options */}
                    <View style={styles.ccSection}>
                      <Text style={styles.ccSectionTitle}>Email CC Options</Text>
                      <Pressable style={styles.ccRow} onPress={() => setCcSalesTeam((v) => !v)}>
                        <View style={[styles.ccCheck, ccSalesTeam && styles.ccCheckOn]}>
                          {ccSalesTeam && <Ionicons name="checkmark" size={12} color={colors.white} />}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.ccLabel}>CC Sales Team on Order Email</Text>
                          <Text style={styles.ccHint}>Sales team will be CC'd on the approval email</Text>
                        </View>
                      </Pressable>
                      {initData?.manager && (
                        <Pressable style={styles.ccRow} onPress={() => setCcManager((v) => !v)}>
                          <View style={[styles.ccCheck, ccManager && styles.ccCheckOn]}>
                            {ccManager && <Ionicons name="checkmark" size={12} color={colors.white} />}
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.ccLabel}>CC Manager / KAM</Text>
                            <Text style={styles.ccHint}>{initData.manager.email || 'Manager email not set'}</Text>
                          </View>
                        </Pressable>
                      )}
                    </View>
                  </>
                )}
              </View>
            )}
          </View>
        )}

        {/* ────── STEP 2: Channel ────── */}
        {step === 2 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Select Sales Channel</Text>
            <Text style={styles.stepHint}>Choose the sales channel for this order. Only order-enabled channels are selectable.</Text>

            {allChannels.length === 0 && (
              <View style={styles.noChannels}>
                <Ionicons name="warning-outline" size={32} color={colors.textMuted} />
                <Text style={styles.noChannelsTitle}>No order-enabled sales channels available.</Text>
                <Text style={styles.noChannelsText}>Contact your manager to enable order creation for a channel.</Text>
              </View>
            )}

            <View style={styles.channelList}>
              {allChannels.map((ch) => {
                const cid       = ch._id || ch.id;
                const enabled   = ch.allowRepOrders !== false;
                const isSelected = selectedChannel && (selectedChannel._id || selectedChannel.id) === cid;
                return (
                  <Pressable
                    key={cid}
                    style={[
                      styles.channelCard,
                      isSelected && styles.channelCardSelected,
                      !enabled && styles.channelCardDisabled,
                    ]}
                    onPress={() => enabled && setSelectedChannel(ch)}
                    disabled={!enabled}
                  >
                    <View style={[styles.channelRadio, isSelected && styles.channelRadioActive]}>
                      {isSelected && <View style={styles.channelRadioDot} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={[styles.channelName, !enabled && { color: colors.textMuted }]}>
                          {ch.channelName || ch.name}
                        </Text>
                        <View style={[styles.channelBadge, { backgroundColor: enabled ? '#ECFDF5' : '#FEF2F2' }]}>
                          <Text style={[styles.channelBadgeText, { color: enabled ? '#059669' : '#DC2626' }]}>
                            {enabled ? 'Order Enabled' : 'Disabled'}
                          </Text>
                        </View>
                      </View>
                      {ch.description ? <Text style={styles.channelDesc}>{ch.description}</Text> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {/* ────── STEP 3: Products ────── */}
        {step === 3 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Add Products</Text>
            <Text style={styles.stepHint}>
              Products available in{' '}
              <Text style={{ fontWeight: '700', color: colors.primary }}>
                {selectedChannel?.channelName}
              </Text>. Select a product and enter quantity.
            </Text>

            {productsLoading ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 16 }}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                  Loading products ({products.length} loaded so far)…
                </Text>
              </View>
            ) : (
              <>
                {/* Table head */}
                <View style={styles.prodTableHead}>
                  <Text style={[styles.prodTh, { flex: 2.4 }]}>Product</Text>
                  <Text style={[styles.prodTh, { flex: 0.7, textAlign: 'center' }]}>Qty</Text>
                  <Text style={[styles.prodTh, { flex: 1, textAlign: 'right' }]}>Unit CIF</Text>
                  <Text style={[styles.prodTh, { flex: 1.1, textAlign: 'right' }]}>Unit Whl</Text>
                  <Text style={[styles.prodTh, { flex: 0.7, textAlign: 'center' }]}>FOC%</Text>
                  <Text style={[styles.prodTh, { flex: 0.7, textAlign: 'center' }]}>Est FOC</Text>
                  <Text style={[styles.prodTh, { flex: 1.2, textAlign: 'right' }]}>Row Total</Text>
                  <Text style={[styles.prodTh, { flex: 0.4 }]}> </Text>
                </View>

                {orderItems.map((item, idx) => (
                  <ProductRow
                    key={idx}
                    item={item}
                    products={products}
                    channelId={selectedChannel?._id || selectedChannel?.id}
                    onChangeProduct={(p) => updateItemProduct(idx, p)}
                    onChangeQty={(q) => updateItemQty(idx, q)}
                    onChangeFoc={(foc) => updateItemFoc(idx, foc)}
                    onRemove={() => removeItem(idx)}
                  />
                ))}

                <Pressable style={styles.addProductBtn} onPress={addItem}>
                  <Ionicons name="add-circle-outline" size={16} color={colors.primary} />
                  <Text style={styles.addProductBtnText}>Add Another Product</Text>
                </Pressable>

                {/* Subtotals */}
                {totals.totalQty > 0 && (
                  <View style={styles.estTotals}>
                    <Text style={styles.estTotalsTitle}>Estimated Subtotals</Text>
                    <View style={styles.estTotalsRow}>
                      {[
                        { label: 'Qty',         value: fmtN(totals.totalQty) },
                        { label: 'Est FOC Qty', value: fmtN(totals.totalFocQty) },
                        { label: 'CIF (USD)',    value: fmtUSD(totals.totalCifUsd) },
                        { label: 'Whl (AED)',    value: fmtAED(totals.totalWholesaleAed) },
                      ].map(({ label, value }) => (
                        <View key={label} style={styles.estTotalCard}>
                          <Text style={styles.estTotalLabel}>{label}</Text>
                          <Text style={styles.estTotalVal}>{value}</Text>
                        </View>
                      ))}
                    </View>
                    <Text style={styles.estNote}>
                      * Estimates only. Backend is the source of truth for final FOC and totals.
                    </Text>
                  </View>
                )}
              </>
            )}
          </View>
        )}

        {/* ────── STEP 4: Summary ────── */}
        {step === 4 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Order Summary</Text>
            <Text style={styles.stepHint}>Review and submit your order.</Text>

            <View style={styles.twoColSummary}>
              {/* Left */}
              <View style={styles.summaryCol}>
                <View style={styles.summarySection}>
                  <Text style={styles.summarySectionTitle}>Order Details</Text>
                  {[
                    { label: 'Account',       value: selectedAccount?.accountName || selectedAccount?.name },
                    { label: 'Sales Channel', value: selectedChannel?.channelName },
                    { label: 'Order Date',    value: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) },
                    { label: 'CC Sales Team', value: ccSalesTeam ? 'Yes' : 'No' },
                  ].map(({ label, value }) => (
                    <View key={label} style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>{label}</Text>
                      <Text style={styles.summaryVal}>{value || '—'}</Text>
                    </View>
                  ))}
                </View>

                <OrderTargetProgress
                  channelId={selectedChannel?._id || selectedChannel?.id}
                  items={targetProgressItems}
                  token={token}
                  userDetails={userDetails}
                />

                <View style={styles.summarySection}>
                  <Text style={styles.summarySectionTitle}>Notes (Optional)</Text>
                  <TextInput
                    style={styles.notesInput}
                    value={notes}
                    onChangeText={setNotes}
                    placeholder="Add any notes for this order..."
                    placeholderTextColor={colors.textMuted}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                </View>
              </View>

              {/* Right */}
              <View style={styles.summaryCol}>
                <View style={styles.summarySection}>
                  <Text style={styles.summarySectionTitle}>Estimated Totals</Text>
                  {[
                    { label: 'Total Qty',      value: fmtN(totals.totalQty) },
                    { label: 'Est. FOC Qty',   value: fmtN(totals.totalFocQty) },
                    { label: 'Total CIF (USD)', value: fmtUSD(totals.totalCifUsd) },
                    { label: 'Total Whl (AED)', value: fmtAED(totals.totalWholesaleAed) },
                  ].map(({ label, value }) => (
                    <View key={label} style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>{label}</Text>
                      <Text style={[styles.summaryVal, { fontWeight: '700', color: colors.primary }]}>{value}</Text>
                    </View>
                  ))}
                </View>

                <View style={styles.summarySection}>
                  <Text style={styles.summarySectionTitle}>
                    Items ({orderItems.filter((i) => i.productId && parseInt(i.quantity) > 0).length})
                  </Text>
                  {orderItems.filter((i) => i.productId && parseInt(i.quantity) > 0).map((item, idx) => (
                    <View key={idx} style={styles.itemRecap}>
                      <Text style={styles.itemRecapName} numberOfLines={1}>
                        {item.productData?.productName || '—'}
                      </Text>
                      <Text style={styles.itemRecapQty}>× {fmtN(parseInt(item.quantity))}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>

            {submitError ? (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle-outline" size={15} color={colors.danger} />
                <Text style={styles.errorBannerText}>{submitError}</Text>
              </View>
            ) : null}
          </View>
        )}

        {/* ── Step navigation ── */}
        <View style={styles.stepNav}>
          {step > 1 && (
            <Pressable style={styles.btnBack} onPress={() => setStep(step - 1)}>
              <Ionicons name="arrow-back" size={14} color={colors.textSecondary} />
              <Text style={styles.btnBackText}>Back</Text>
            </Pressable>
          )}
          <View style={{ flex: 1 }} />
          {step < 4 ? (
            <Pressable
              style={[styles.btnNext, !canProceed() && styles.btnNextDisabled]}
              onPress={() => canProceed() && goToStep(step + 1)}
              disabled={!canProceed()}
            >
              <Text style={styles.btnNextText}>{step === 3 ? 'Next: Summary' : 'Next'}</Text>
              <Ionicons name="arrow-forward" size={14} color={colors.white} />
            </Pressable>
          ) : (
            <Pressable
              style={[styles.btnSubmit, submitting && { opacity: 0.7 }]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting && <ActivityIndicator size={14} color={colors.white} />}
              <Ionicons name="checkmark-circle-outline" size={15} color={colors.white} />
              <Text style={styles.btnSubmitText}>{submitting ? 'Saving…' : 'Save Order'}</Text>
            </Pressable>
          )}
        </View>
      </View>
    </AppShell>
  );
}

/* ─── Styles ─────────────────────────────────────────────────────────────── */
const shadow = { shadowColor: '#11224A', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.1, shadowRadius: 14, elevation: 3 };

const styles = StyleSheet.create({
  pageHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    marginBottom: globalHeight('1.8%'),
  },
  pageTitle:    { fontSize: globalWidth('1.35%'), fontWeight: '800', color: colors.textPrimary },
  pageSubtitle: { fontSize: globalWidth('0.7%'), color: colors.textSecondary, marginTop: 3 },
  btnCancel:    { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 18, paddingVertical: 9 },
  btnCancelText:{ fontSize: 13, color: colors.textSecondary, fontWeight: '700' },

  stepCard:    { backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, ...shadow },
  stepContent: { padding: globalWidth('1.5%'), gap: 18 },
  stepTitle:   { fontSize: globalWidth('1.0%'), fontWeight: '800', color: colors.textPrimary },
  stepHint:    { fontSize: globalWidth('0.7%'), color: colors.textSecondary, marginTop: -8 },

  // Account search
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderColor: colors.border, borderRadius: 9,
    paddingHorizontal: 14, height: 46, backgroundColor: colors.backgroundColor,
  },
  searchInput: { flex: 1, fontSize: 13, color: colors.textPrimary, outlineStyle: 'none' },

  acctDropdown: { borderWidth: 1, borderColor: colors.border, borderRadius: 9, backgroundColor: colors.surface, ...shadow },
  acctOpt: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  acctOptSelected: { backgroundColor: colors.primaryLight + '40' },
  acctOptIcon:  { width: 28, height: 28, borderRadius: 7, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  acctOptName:  { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  acctOptType:  { fontSize: 11, color: colors.textSecondary, marginTop: 1 },
  dropEmpty:    { padding: 14, alignItems: 'center' },
  dropEmptyText:{ fontSize: 12, color: colors.textMuted },

  acctCard: {
    borderWidth: 1, borderColor: colors.primaryLight, borderRadius: 10,
    backgroundColor: colors.surface, overflow: 'hidden',
  },
  acctCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: colors.primary },
  acctCardIcon:   { width: 38, height: 38, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  acctCardName:   { fontSize: 15, fontWeight: '800', color: colors.white },
  acctCardType:   { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 },

  acctDetails:     { padding: 14, gap: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
  acctDetailRow:   { flexDirection: 'row', gap: 8 },
  acctDetailLabel: { width: 110, fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  acctDetailVal:   { flex: 1, fontSize: 12, color: colors.textPrimary },

  salesTeamSection: { padding: 14, gap: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  salesTeamTitle:   { fontSize: 11, fontWeight: '800', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  salesTeamRow:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
  salesTeamAvatar:  { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  salesTeamAvatarText: { fontSize: 11, fontWeight: '800', color: colors.primary },
  salesTeamName:    { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  salesTeamPos:     { fontSize: 11, color: colors.textSecondary, marginTop: 1 },

  ccSection:      { padding: 14, gap: 10 },
  ccSectionTitle: { fontSize: 11, fontWeight: '800', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  ccRow:          { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  ccCheck:        { width: 20, height: 20, borderRadius: 5, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', marginTop: 1, flexShrink: 0 },
  ccCheckOn:      { backgroundColor: colors.primary, borderColor: colors.primary },
  ccLabel:        { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  ccHint:         { fontSize: 11, color: colors.textSecondary, marginTop: 2 },

  // Channel step
  channelList: { gap: 10 },
  channelCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 14,
  },
  channelCardSelected: { borderColor: colors.primary, backgroundColor: colors.primaryLight + '20' },
  channelCardDisabled: { opacity: 0.5 },
  channelRadio:        { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', marginTop: 2, flexShrink: 0 },
  channelRadioActive:  { borderColor: colors.primary },
  channelRadioDot:     { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  channelName:         { fontSize: 14, fontWeight: '800', color: colors.textPrimary },
  channelDesc:         { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
  channelBadge:        { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  channelBadgeText:    { fontSize: 11, fontWeight: '700' },
  noChannels:          { alignItems: 'center', paddingVertical: 32, gap: 8 },
  noChannelsTitle:     { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  noChannelsText:      { fontSize: 13, color: colors.textSecondary, textAlign: 'center' },

  // Products step
  prodTableHead:   { flexDirection: 'row', paddingHorizontal: 10, paddingVertical: 9, backgroundColor: colors.backgroundColor, borderRadius: 8, gap: 8 },
  prodTh:          { fontSize: globalWidth('0.58%'), fontWeight: '700', color: colors.textMuted, textTransform: 'uppercase' },
  addProductBtn:   { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.primary, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 9, alignSelf: 'flex-start', marginTop: 4 },
  addProductBtnText:{ color: colors.primary, fontSize: 13, fontWeight: '700' },

  estTotals:     { borderWidth: 1, borderColor: '#BFDBFE', borderRadius: 10, backgroundColor: '#F0F5FF', padding: 14, gap: 10, marginTop: 8 },
  estTotalsTitle:{ fontSize: 13, fontWeight: '800', color: colors.primary },
  estTotalsRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  estTotalCard:  { flex: 1, minWidth: globalWidth('9%'), backgroundColor: colors.white, borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#DBEAFE' },
  estTotalLabel: { fontSize: globalWidth('0.56%'), color: colors.textMuted, fontWeight: '600', marginBottom: 3 },
  estTotalVal:   { fontSize: globalWidth('0.82%'), fontWeight: '800', color: colors.primary },
  estNote:       { fontSize: 11, color: colors.textMuted, fontStyle: 'italic' },

  // Summary step
  twoColSummary: { flexDirection: 'row', gap: 20, alignItems: 'flex-start' },
  summaryCol:    { flex: 1, gap: 14 },
  summarySection:{ borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 14, gap: 8 },
  summarySectionTitle: { fontSize: 12, fontWeight: '800', color: colors.textSecondary, textTransform: 'uppercase', marginBottom: 4, letterSpacing: 0.4 },
  summaryRow:    { flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  summaryLabel:  { flex: 1, fontSize: 13, color: colors.textSecondary },
  summaryVal:    { flex: 1.5, fontSize: 13, color: colors.textPrimary, textAlign: 'right' },
  notesInput:    { borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10, height: 80, fontSize: 13, color: colors.textPrimary, outlineStyle: 'none' },
  itemRecap:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: colors.border },
  itemRecapName: { flex: 1, fontSize: 12, color: colors.textPrimary, fontWeight: '600' },
  itemRecapQty:  { fontSize: 12, color: colors.primary, fontWeight: '700' },
  errorBanner:   { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FCA5A5', borderRadius: 8, padding: 12 },
  errorBannerText:{ flex: 1, fontSize: 13, color: colors.danger },

  // Step nav
  stepNav:      { flexDirection: 'row', alignItems: 'center', padding: globalWidth('1%'), borderTopWidth: 1, borderTopColor: colors.border },
  btnBack:      { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 9 },
  btnBackText:  { fontSize: 13, color: colors.textSecondary, fontWeight: '700' },
  btnNext:      { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 20, paddingVertical: 9 },
  btnNextDisabled:{ opacity: 0.4 },
  btnNextText:  { color: colors.white, fontSize: 13, fontWeight: '700' },
  btnSubmit:    { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.success, borderRadius: 8, paddingHorizontal: 20, paddingVertical: 9 },
  btnSubmitText:{ color: colors.white, fontSize: 13, fontWeight: '700' },

  // Success
  successCard:    { alignItems: 'center', backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 48, gap: 14, ...shadow },
  successIcon:    { width: 88, height: 88, borderRadius: 44, backgroundColor: '#ECFDF5', alignItems: 'center', justifyContent: 'center' },
  successTitle:   { fontSize: globalWidth('1.3%'), fontWeight: '800', color: colors.textPrimary },
  successSub:     { fontSize: globalWidth('0.72%'), color: colors.textSecondary, textAlign: 'center' },
  warningsList:   { borderWidth: 1, borderColor: '#FDE68A', backgroundColor: '#FFFBEB', borderRadius: 8, padding: 12, gap: 6, width: '80%' },
  warnItem:       { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  warnItemText:   { flex: 1, fontSize: 12, color: '#92400E', lineHeight: 18 },
  successActions: { flexDirection: 'row', gap: 10, marginTop: 8, flexWrap: 'wrap', justifyContent: 'center' },
  btnEmailDraft:  { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.primary, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10 },
  btnEmailDraftText:{ color: colors.primary, fontSize: 13, fontWeight: '700' },
  btnViewOrder:   { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10 },
  btnViewOrderText:{ color: colors.white, fontSize: 13, fontWeight: '700' },
  btnGoList:      { borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10 },
  btnGoListText:  { color: colors.textSecondary, fontSize: 13, fontWeight: '700' },
});
