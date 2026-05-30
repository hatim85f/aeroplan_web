import React, { useState, useEffect, useCallback } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import AppShell from '../../components/AppShell';
import { colors } from '../../constants/colors';
import { globalHeight, globalWidth } from '../../constants/globalWidth';
import { getProductById, updateProductStatus, deleteProduct } from '../../store/products/productActions';

const isManager = (role) =>
  ['admin', 'manager', 'senior_manager'].includes(String(role).toLowerCase());

const LINE_PILL_COLORS = [
  { bg: '#EDE9FE', text: '#5B21B6' },
  { bg: '#DBEAFE', text: '#1D4ED8' },
  { bg: '#FEF3C7', text: '#92400E' },
  { bg: '#D1FAE5', text: '#065F46' },
  { bg: '#FCE7F3', text: '#9D174D' },
  { bg: '#FFF3E0', text: '#E65100' },
];
const lineColor = (lineId) => LINE_PILL_COLORS[(lineId || '').charCodeAt(0) % LINE_PILL_COLORS.length];

/* Dynamic channel color palette — same palette as ProductFormScreen */
const ACCENT_PALETTE = [
  { accent: '#1D4ED8', bg: '#EFF6FF', border: '#BFDBFE' },
  { accent: '#15803D', bg: '#F0FDF4', border: '#BBF7D0' },
  { accent: '#C2410C', bg: '#FFF7ED', border: '#FED7AA' },
  { accent: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE' },
  { accent: '#0E7490', bg: '#ECFEFF', border: '#A5F3FC' },
  { accent: '#B45309', bg: '#FFFBEB', border: '#FDE68A' },
];
const paletteFor = (idx) => ACCENT_PALETTE[idx % ACCENT_PALETTE.length];

function InfoRow({ label, value, mono }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, mono && { fontFamily: 'monospace' }]}>{value || '—'}</Text>
    </View>
  );
}

function SectionCard({ title, children }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

const TARGET_BASIS_LABELS = {
  cifUsd:       'CIF USD',
  wholesaleAed: 'Wholesale AED',
  retailAed:    'Retail AED',
};

function ChannelPricingCard({ entry, colorIdx }) {
  const c = paletteFor(colorIdx);
  const fields = [
    { label: 'CIF USD', value: entry.cifUsd       != null ? `$${Number(entry.cifUsd).toFixed(2)}`       : null },
    { label: 'WS AED',  value: entry.wholesaleAed != null ? `${Number(entry.wholesaleAed).toFixed(2)}`  : null },
    { label: 'RP AED',  value: entry.retailAed    != null ? `${Number(entry.retailAed).toFixed(2)}`     : null },
  ];
  const hasFoc = entry.defaultFocPercentage != null && entry.defaultFocPercentage !== '';
  const basisLabel   = TARGET_BASIS_LABELS[entry.targetValueBasis] || entry.targetValueBasis || 'CIF USD';
  const targetCurrency = entry.targetCurrency || 'USD';

  return (
    <View style={[styles.pricingCard, { backgroundColor: c.bg, borderColor: c.border }]}>
      <View style={styles.pricingCardHeader}>
        <Text style={[styles.pricingChannelLabel, { color: c.accent }]}>
          {entry.channelName || entry.channelKey || 'Channel'}
        </Text>
        {hasFoc && (
          <View style={[styles.focBadge, { backgroundColor: c.accent + '20' }]}>
            <Text style={[styles.focBadgeText, { color: c.accent }]}>
              FOC {entry.defaultFocPercentage}%
            </Text>
          </View>
        )}
      </View>
      {fields.map(({ label, value }) => (
        <View key={label} style={styles.pricingRow}>
          <Text style={styles.pricingLabel}>{label}</Text>
          <Text style={[styles.pricingValue, { color: value ? c.accent : colors.textMuted }]}>
            {value || '—'}
          </Text>
        </View>
      ))}
      {entry.focNotes ? (
        <Text style={[styles.focNotes, { color: c.accent }]}>{entry.focNotes}</Text>
      ) : null}
      <View style={[styles.targetCalcRow, { borderColor: c.border }]}>
        <Text style={styles.targetCalcLabel}>Target Calculation</Text>
        <Text style={[styles.targetCalcValue, { color: c.accent }]}>
          {basisLabel} / {targetCurrency}
        </Text>
      </View>
    </View>
  );
}

export default function ProductDetailScreen({ navigation, route, userDetails, appMetadata, onSignOut }) {
  const productId = route?.params?.productId;
  const user = userDetails?.user || userDetails?.data?.user || userDetails || {};
  const token = userDetails?.token || userDetails?.data?.token || '';
  const role = user.role || '';
  const managerRole = isManager(role);

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toggling, setToggling] = useState(false);

  const fetchProduct = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getProductById(token, productId);
      setProduct(data);
    } catch (e) {
      setError(e.message || 'Failed to load product');
    } finally {
      setLoading(false);
    }
  }, [token, productId]);

  useEffect(() => { fetchProduct(); }, [fetchProduct]);

  const handleToggleStatus = async () => {
    const currentlyActive = product?.isActive !== false && product?.status !== 'inactive';
    setToggling(true);
    try {
      await updateProductStatus(token, productId, {
        status: currentlyActive ? 'inactive' : 'active',
        isActive: !currentlyActive,
      });
      fetchProduct();
    } catch (e) {
      alert(e.message || 'Failed to update status');
    } finally {
      setToggling(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this product? This action cannot be undone.')) return;
    try {
      await deleteProduct(token, productId);
      navigation.navigate('Products');
    } catch (e) {
      alert(e.message || 'Failed to delete product');
    }
  };

  if (loading) {
    return (
      <AppShell navigation={navigation} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} activeRoute="Products">
        <View style={styles.centered}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.loadingText}>Loading product...</Text>
        </View>
      </AppShell>
    );
  }

  if (error || !product) {
    return (
      <AppShell navigation={navigation} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} activeRoute="Products">
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error || 'Product not found'}</Text>
          <Pressable style={styles.retryBtn} onPress={fetchProduct}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      </AppShell>
    );
  }

  const name = product.productName || product.name || 'Unnamed';
  const nickname = product.productNickname || product.nickname || '';
  const description = product.description || '';
  const lineId = product.lineId || product.line?.lineId || '';
  const lineName = product.lineName || product.line?.lineName || product.line?.name || lineId;
  const active = product.isActive !== false && product.status !== 'inactive';
  const lc = lineColor(lineId);

  /* channelPricing — new array format; fall back to empty if absent */
  const channelPricingList = Array.isArray(product.channelPricing) ? product.channelPricing : [];

  return (
    <AppShell navigation={navigation} userDetails={userDetails} appMetadata={appMetadata} onSignOut={onSignOut} activeRoute="Products">
      {/* Breadcrumb */}
      <View style={styles.breadcrumb}>
        <Pressable onPress={() => navigation.navigate('Products')}>
          <Text style={styles.breadcrumbLink}>Products</Text>
        </Pressable>
        <Ionicons name="chevron-forward" size={13} color={colors.textMuted} />
        <Text style={styles.breadcrumbCurrent} numberOfLines={1}>{name}</Text>
      </View>

      {/* Page header */}
      <View style={styles.pageHeader}>
        <View style={styles.pageHeaderLeft}>
          {product.imageUrl ? (
            <Image source={{ uri: product.imageUrl }} style={styles.productImage} resizeMode="cover" />
          ) : (
            <View style={styles.productImagePlaceholder}>
              <Ionicons name="cube-outline" size={28} color={colors.primary} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <View style={styles.nameRow}>
              <Text style={styles.pageTitle}>{name}</Text>
              {lineName ? (
                <View style={[styles.linePill, { backgroundColor: lc.bg }]}>
                  <Text style={[styles.linePillText, { color: lc.text }]}>{lineName}</Text>
                </View>
              ) : null}
              {managerRole && (
                <>
                  <View style={[styles.statusDot, { backgroundColor: active ? colors.success : colors.danger }]} />
                  <Text style={[styles.statusText, { color: active ? colors.success : colors.danger }]}>
                    {active ? 'Active' : 'Inactive'}
                  </Text>
                </>
              )}
            </View>
            {nickname ? <Text style={styles.nicknameText}>{nickname}</Text> : null}
            {description ? <Text style={styles.pageSubtitle}>{description}</Text> : null}
          </View>
        </View>

        {managerRole && (
          <View style={styles.headerActions}>
            <Pressable
              style={[styles.btnOutline, { borderColor: active ? colors.danger : colors.success }]}
              onPress={handleToggleStatus}
              disabled={toggling}
            >
              {toggling
                ? <ActivityIndicator size={13} color={active ? colors.danger : colors.success} />
                : <Ionicons name={active ? 'pause-circle-outline' : 'play-circle-outline'} size={14} color={active ? colors.danger : colors.success} />}
              <Text style={[styles.btnOutlineText, { color: active ? colors.danger : colors.success }]}>
                {active ? 'Deactivate' : 'Activate'}
              </Text>
            </Pressable>
            <Pressable
              style={styles.btnPrimary}
              onPress={() => navigation.navigate('ProductForm', { mode: 'edit', productId })}
            >
              <Ionicons name="pencil-outline" size={14} color={colors.white} />
              <Text style={styles.btnPrimaryText}>Edit Product</Text>
            </Pressable>
            <Pressable style={styles.btnDanger} onPress={handleDelete}>
              <Ionicons name="trash-outline" size={14} color={colors.danger} />
              <Text style={[styles.btnOutlineText, { color: colors.danger }]}>Delete</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* Two-column layout */}
      <View style={styles.twoCol}>
        {/* Left: Basic info */}
        <View style={styles.leftCol}>
          <SectionCard title="Product Information">
            <InfoRow label="Product Name" value={name} />
            <InfoRow label="Nickname" value={nickname} mono />
            <InfoRow label="Description" value={description} />
            <InfoRow label="Line" value={lineName} />
            {managerRole && <InfoRow label="Status" value={active ? 'Active' : 'Inactive'} />}
          </SectionCard>
        </View>

        {/* Right: Dynamic channel pricing */}
        <View style={styles.rightCol}>
          <SectionCard title="Pricing by Channel">
            {channelPricingList.length === 0 ? (
              <View style={styles.noPricing}>
                <Ionicons name="pricetags-outline" size={24} color={colors.textMuted} />
                <Text style={styles.noPricingText}>No channel pricing configured.</Text>
              </View>
            ) : (
              <View style={styles.pricingGrid}>
                {channelPricingList.map((entry, idx) => (
                  <ChannelPricingCard
                    key={entry.channelId || idx}
                    entry={entry}
                    colorIdx={idx}
                  />
                ))}
              </View>
            )}
          </SectionCard>
        </View>
      </View>
    </AppShell>
  );
}

const shadow = { shadowColor: '#0B2B66', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } };

const styles = StyleSheet.create({
  centered: { alignItems: 'center', padding: 40, gap: 10 },
  loadingText: { color: colors.textSecondary, fontSize: 13 },
  errorText: { color: colors.danger, fontSize: 13 },
  retryBtn: { borderWidth: 1, borderColor: colors.primary, borderRadius: 6, paddingHorizontal: 14, paddingVertical: 7 },
  retryText: { color: colors.primary, fontSize: 13, fontWeight: '700' },

  breadcrumb: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: globalHeight('1.2%') },
  breadcrumbLink: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  breadcrumbCurrent: { fontSize: 13, color: colors.textSecondary },

  pageHeader: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    marginBottom: globalHeight('1.5%'), flexWrap: 'wrap', gap: 12,
  },
  pageHeaderLeft: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, flex: 1, minWidth: 200 },
  productImage: { width: 64, height: 64, borderRadius: 10, backgroundColor: colors.backgroundColor, flexShrink: 0 },
  productImagePlaceholder: {
    width: 64, height: 64, borderRadius: 10, backgroundColor: colors.primary + '12',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  pageTitle: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
  nicknameText: { fontSize: 12, color: colors.textSecondary, fontFamily: 'monospace', marginTop: 2 },
  pageSubtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: '600' },
  linePill: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  linePillText: { fontSize: 11, fontWeight: '700' },

  headerActions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  btnPrimary: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  btnPrimaryText: { color: colors.white, fontSize: 13, fontWeight: '700' },
  btnOutline: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  btnOutlineText: { fontSize: 13, fontWeight: '700' },
  btnDanger: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: colors.danger, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },

  twoCol: { flexDirection: 'row', gap: globalWidth('1.5%'), alignItems: 'flex-start' },
  leftCol: { flex: 0.35, gap: globalHeight('1.2%') },
  rightCol: { flex: 0.65, gap: globalHeight('1.2%') },

  card: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, backgroundColor: colors.surface, padding: 18, ...shadow },
  cardHeader: { marginBottom: 14 },
  cardTitle: { fontSize: 14, fontWeight: '800', color: colors.textPrimary },

  infoRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  infoLabel: { width: 120, fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
  infoValue: { flex: 1, fontSize: 13, color: colors.textPrimary },

  noPricing: { alignItems: 'center', paddingVertical: 24, gap: 8 },
  noPricingText: { fontSize: 13, color: colors.textMuted },

  pricingGrid: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  pricingCard: { flex: 1, minWidth: 160, borderWidth: 1, borderRadius: 10, padding: 14 },
  pricingCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  pricingChannelLabel: { fontSize: 14, fontWeight: '800' },
  focBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  focBadgeText: { fontSize: 11, fontWeight: '700' },
  focNotes: { fontSize: 11, marginTop: 8, fontStyle: 'italic' },
  targetCalcRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 10, paddingTop: 8, borderTopWidth: 1,
  },
  targetCalcLabel: { fontSize: 11, fontWeight: '700', color: colors.textSecondary },
  targetCalcValue: { fontSize: 11, fontWeight: '800' },
  pricingRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  pricingLabel: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
  pricingValue: { fontSize: 13, fontWeight: '700' },
});
